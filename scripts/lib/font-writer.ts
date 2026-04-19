/**
 * Convert a FamilySpec → opentype.js Font → on-disk .otf, .woff, .woff2.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { deflateSync } from 'node:zlib'
import opentype from 'opentype.js'
import { WEIGHT_CLASS } from './common.ts'
import type { FamilySpec, MasterSpec } from './types.ts'

const wawoff2 = await import('wawoff2')

export interface BuildOutputs {
  otf: string
  woff: string
  woff2: string
}

/** Build all formats for one master. Returns absolute paths. */
export async function buildMaster(
  family: FamilySpec,
  master: MasterSpec,
  fontsDir: string,
): Promise<BuildOutputs> {
  const font = createFont(family, master)
  const otfBuf = Buffer.from(font.toArrayBuffer())

  const styleSuffix = master.styleName.replace(/\s+/g, '')
  const baseName = `${family.fileStem}-${styleSuffix}`

  const otfPath = join(fontsDir, family.id, 'otf', `${baseName}.otf`)
  const woffPath = join(fontsDir, family.id, 'woff', `${baseName}.woff`)
  const woff2Path = join(fontsDir, family.id, 'woff2', `${baseName}.woff2`)

  await mkdir(dirname(otfPath), { recursive: true })
  await mkdir(dirname(woffPath), { recursive: true })
  await mkdir(dirname(woff2Path), { recursive: true })

  await writeFile(otfPath, otfBuf)

  const woffBuf = sfntToWoff(otfBuf)
  await writeFile(woffPath, woffBuf)

  const woff2Buf = Buffer.from(await wawoff2.compress(otfBuf))
  await writeFile(woff2Path, woff2Buf)

  return { otf: otfPath, woff: woffPath, woff2: woff2Path }
}

function createFont(family: FamilySpec, master: MasterSpec): opentype.Font {
  // Required first glyph: .notdef
  const notdef = new opentype.Glyph({
    name: '.notdef',
    unicode: 0,
    advanceWidth: 600,
    path: new opentype.Path(),
  })

  const slant = (master.ctx.slant as number | undefined) ?? 0

  const glyphs: opentype.Glyph[] = [notdef]
  for (const spec of master.glyphs) {
    const path = new opentype.Path()
    spec.draw(path, master.ctx)
    if (slant !== 0) shearPath(path, slant)
    glyphs.push(
      new opentype.Glyph({
        name: spec.name,
        unicode: spec.unicode,
        advanceWidth: spec.advanceWidth,
        path,
      }),
    )
  }

  const font = new opentype.Font({
    familyName: family.familyName,
    styleName: master.styleName,
    unitsPerEm: family.unitsPerEm,
    ascender: family.ascender,
    descender: family.descender,
    designer: family.designer,
    designerURL: family.designerURL,
    manufacturer: family.manufacturer,
    license: family.license,
    licenseURL: family.licenseURL,
    version: family.version,
    description: `${family.familyName} — open-source typeface inspired by U.S. National Park Service signage. Unaffiliated with the NPS.`,
    copyright: family.copyright,
    trademark: '',
    glyphs,
  })

  // OS/2 weight class — opentype.js defaults to 400; override for non-Regular masters.
  const wcls = WEIGHT_CLASS[master.weight]
  if (font.tables.os2) {
    font.tables.os2.usWeightClass = wcls
    font.tables.os2.achVendID = family.vendorID
    font.tables.os2.fsSelection = computeFsSelection(master)
  }
  if (font.tables.head) {
    font.tables.head.macStyle = computeMacStyle(master)
  }
  if (font.tables.post) {
    font.tables.post.italicAngle = master.italic ? -10 : 0
  }

  return font
}

function computeFsSelection(master: MasterSpec): number {
  // OS/2 fsSelection bits.
  // bit 0: italic, bit 5: bold, bit 6: regular, bit 7: USE_TYPO_METRICS
  let bits = 0
  const bold = master.weight === 'Bold' || master.weight === 'Black'
  if (master.italic) bits |= 1 << 0
  if (bold) bits |= 1 << 5
  if (!bold && !master.italic) bits |= 1 << 6
  bits |= 1 << 7 // USE_TYPO_METRICS
  return bits
}

function computeMacStyle(master: MasterSpec): number {
  // head.macStyle bits.
  // bit 0: bold, bit 1: italic
  let bits = 0
  const bold = master.weight === 'Bold' || master.weight === 'Black'
  if (bold) bits |= 1 << 0
  if (master.italic) bits |= 1 << 1
  return bits
}

// ---------------------------------------------------------------------------
// WOFF 1.0 wrapper
// ---------------------------------------------------------------------------
// Spec: https://www.w3.org/TR/WOFF/
// WOFF wraps an existing sfnt (TTF/OTF) file by zlib-compressing each table
// individually if compression saves bytes.

function sfntToWoff(sfnt: Buffer): Buffer {
  const sfntVersion = sfnt.readUInt32BE(0)
  const numTables = sfnt.readUInt16BE(4)

  interface TableEntry {
    tag: number
    checksum: number
    origOffset: number
    origLength: number
    data: Buffer
    compData: Buffer
  }

  const tables: TableEntry[] = []
  let totalSfntSize = 12 + numTables * 16
  for (let i = 0; i < numTables; i++) {
    const dirOffset = 12 + i * 16
    const tag = sfnt.readUInt32BE(dirOffset)
    const checksum = sfnt.readUInt32BE(dirOffset + 4)
    const origOffset = sfnt.readUInt32BE(dirOffset + 8)
    const origLength = sfnt.readUInt32BE(dirOffset + 12)
    const data = sfnt.subarray(origOffset, origOffset + origLength)
    const compressed = deflateSync(data)
    // Use compressed only if smaller than original.
    const compData = compressed.length < origLength ? compressed : data
    tables.push({ tag, checksum, origOffset, origLength, data, compData })
    totalSfntSize += pad4(origLength)
  }

  // WOFF header: 44 bytes
  // table directory: 20 bytes per table
  const headerSize = 44
  const directorySize = numTables * 20
  let dataOffset = headerSize + directorySize

  // Compute total compressed size
  let totalCompSize = headerSize + directorySize
  const compEntries: { offset: number, comp: Buffer }[] = []
  for (const t of tables) {
    const padded = pad4(t.compData.length)
    compEntries.push({ offset: totalCompSize, comp: t.compData })
    totalCompSize += padded
  }

  const out = Buffer.alloc(totalCompSize)
  // Header
  out.write('wOFF', 0, 'ascii')
  out.writeUInt32BE(sfntVersion, 4)
  out.writeUInt32BE(totalCompSize, 8)
  out.writeUInt16BE(numTables, 12)
  out.writeUInt16BE(0, 14) // reserved
  out.writeUInt32BE(totalSfntSize, 16)
  out.writeUInt16BE(1, 20) // major version
  out.writeUInt16BE(0, 22) // minor version
  out.writeUInt32BE(0, 24) // metaOffset
  out.writeUInt32BE(0, 28) // metaLength
  out.writeUInt32BE(0, 32) // metaOrigLength
  out.writeUInt32BE(0, 36) // privOffset
  out.writeUInt32BE(0, 40) // privLength

  // Directory
  for (let i = 0; i < tables.length; i++) {
    const t = tables[i]!
    const e = compEntries[i]!
    const dir = headerSize + i * 20
    out.writeUInt32BE(t.tag, dir)
    out.writeUInt32BE(e.offset, dir + 4)
    out.writeUInt32BE(e.comp.length, dir + 8)
    out.writeUInt32BE(t.origLength, dir + 12)
    out.writeUInt32BE(t.checksum, dir + 16)
  }

  // Table data
  for (let i = 0; i < tables.length; i++) {
    const e = compEntries[i]!
    e.comp.copy(out, e.offset)
    // remaining padding bytes are already 0 from Buffer.alloc
    void dataOffset
  }

  return out
}

function pad4(n: number): number {
  return (n + 3) & ~3
}

/**
 * Shear an opentype.js Path in-place by `slant` radians around the
 * baseline (y=0). Positive slant tilts the top of the glyph forward
 * (italic).
 */
function shearPath(path: opentype.Path, slant: number): void {
  const tan = Math.tan(slant)
  type Cmd = { type: string, x?: number, y?: number, x1?: number, y1?: number, x2?: number, y2?: number }
  const cmds = path.commands as unknown as Cmd[]
  for (const c of cmds) {
    if (c.type === 'Z') continue
    if (c.x !== undefined && c.y !== undefined) c.x += c.y * tan
    if (c.x1 !== undefined && c.y1 !== undefined) c.x1 += c.y1 * tan
    if (c.x2 !== undefined && c.y2 !== undefined) c.x2 += c.y2 * tan
  }
}
