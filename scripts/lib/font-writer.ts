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
  let otfBuf: Buffer = Buffer.from(font.toArrayBuffer() as ArrayBuffer)
  // opentype.js doesn't write the legacy kern table; inject it manually.
  const kernPairs = (font as opentype.Font & { kerningPairs?: Record<string, number> }).kerningPairs
  if (kernPairs && Object.keys(kernPairs).length > 0) {
    otfBuf = injectKernTable(otfBuf, kernPairs)
  }

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
    const unicodes = Array.isArray(spec.unicode)
      ? spec.unicode
      : (spec.unicode === undefined ? [] : [spec.unicode])
    const glyph = new opentype.Glyph({
      name: spec.name,
      unicode: unicodes[0],
      advanceWidth: spec.advanceWidth,
      path,
    })
    if (unicodes.length > 1) {
      // opentype.js Glyph supports multiple cmap entries via the unicodes array
      ;(glyph as opentype.Glyph & { unicodes: number[] }).unicodes = unicodes
    }
    glyphs.push(glyph)
  }

  // Apply kerning pairs to font.kerningPairs (translates glyph names → indices).
  const kerning = master.kerningPairs ?? family.kerningPairs
  if (kerning) {
    queueKerning(glyphs, kerning, master.weight === 'Bold' || master.weight === 'Black' ? 1.1 : 1)
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

  // Wire the standard ligatures (`liga` feature) if the corresponding glyphs exist.
  const sub = (font as opentype.Font & { substitution?: { add?: (f: string, l: { sub: number[], by: number }) => void } }).substitution
  if (sub?.add) {
    const idxOf = (name: string): number | undefined => {
      const total = font.glyphs.length
      for (let i = 0; i < total; i++) {
        if ((font.glyphs.get(i) as opentype.Glyph)?.name === name) return i
      }
      return undefined
    }
    const liga = (a: string, b: string, joined: string) => {
      const ai = idxOf(a)
      const bi = idxOf(b)
      const ji = idxOf(joined)
      if (ai === undefined || bi === undefined || ji === undefined) return
      try { sub.add!('liga', { sub: [ai, bi], by: ji }) } catch { /* opentype.js may throw on duplicate; ignore */ }
    }
    liga('f', 'i', 'fi')
    liga('f', 'l', 'fl')
  }

  // Materialize queued kerning pairs into font.kerningPairs (uses glyph indices).
  const queued = pendingKerning
  pendingKerning = null
  if (queued) {
    const byName = new Map<string, number>()
    const total = font.glyphs.length
    for (let i = 0; i < total; i++) {
      const gl = font.glyphs.get(i) as opentype.Glyph | undefined
      if (gl?.name) byName.set(gl.name, i)
    }
    const pairs: Record<string, number> = {}
    for (const [pair, value] of Object.entries(queued.pairs)) {
      const [a, b] = pair.split(',')
      const li = byName.get(a!)
      const ri = byName.get(b!)
      if (li === undefined || ri === undefined) continue
      pairs[`${li},${ri}`] = Math.round(value * queued.scale)
    }
    ;(font as opentype.Font & { kerningPairs: Record<string, number> }).kerningPairs = pairs
  }

  return font
}

// ---------------------------------------------------------------------------
// Kerning queue (passed from glyph-build phase to font-construction phase)
// ---------------------------------------------------------------------------
let pendingKerning: { pairs: Record<string, number>, scale: number } | null = null
function queueKerning(
  _glyphs: opentype.Glyph[],
  pairs: Record<string, number>,
  scale: number,
): void {
  pendingKerning = { pairs, scale }
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

// ---------------------------------------------------------------------------
// kern table injection (format 0)
// ---------------------------------------------------------------------------
// opentype.js can read but not write the legacy `kern` table. We assemble
// one ourselves and splice it into the sfnt directory.

function buildKernTable(pairs: Record<string, number>): Buffer {
  // Sort by left index, then right index (required by format 0 binary search).
  const entries = Object.entries(pairs)
    .map(([k, v]) => {
      const [a, b] = k.split(',').map(Number)
      return [a!, b!, v] as [number, number, number]
    })
    .sort((p, q) => p[0] - q[0] || p[1] - q[1])

  const nPairs = entries.length
  const subtableLen = 14 + nPairs * 6
  const tableLen = 4 + subtableLen
  const buf = Buffer.alloc(tableLen)
  // kern header
  buf.writeUInt16BE(0, 0)         // version
  buf.writeUInt16BE(1, 2)         // nTables
  // subtable
  let o = 4
  buf.writeUInt16BE(0, o); o += 2 // subtable version
  buf.writeUInt16BE(subtableLen, o); o += 2
  buf.writeUInt16BE(0x0001, o); o += 2 // coverage: horizontal
  buf.writeUInt16BE(nPairs, o); o += 2
  // searchRange / entrySelector / rangeShift (per spec)
  let sr = 1
  let es = 0
  while (sr * 2 <= nPairs) { sr *= 2; es++ }
  const searchRange = sr * 6
  const rangeShift = nPairs * 6 - searchRange
  buf.writeUInt16BE(searchRange, o); o += 2
  buf.writeUInt16BE(es, o); o += 2
  buf.writeUInt16BE(rangeShift, o); o += 2
  // pair records
  for (const [l, r, v] of entries) {
    buf.writeUInt16BE(l, o); o += 2
    buf.writeUInt16BE(r, o); o += 2
    buf.writeInt16BE(v, o); o += 2
  }
  return buf
}

/** Compute the sfnt table checksum: sum of big-endian uint32, padded to 4 bytes. */
function tableChecksum(data: Buffer): number {
  const padded = pad4(data.length)
  let sum = 0
  for (let i = 0; i < padded; i += 4) {
    let v = 0
    for (let j = 0; j < 4; j++) {
      const idx = i + j
      v = (v << 8) >>> 0
      if (idx < data.length) v = (v | data[idx]!) >>> 0
    }
    sum = (sum + v) >>> 0
  }
  return sum
}

function injectKernTable(otf: Buffer, pairs: Record<string, number>): Buffer {
  const kernData = buildKernTable(pairs)
  const kernChecksum = tableChecksum(kernData)
  const kernTag = Buffer.from('kern', 'ascii').readUInt32BE(0)

  const sfntVersion = otf.readUInt32BE(0)
  const numTables = otf.readUInt16BE(4)

  interface Entry { tag: number, checksum: number, offset: number, length: number }
  const entries: Entry[] = []
  for (let i = 0; i < numTables; i++) {
    const off = 12 + i * 16
    entries.push({
      tag: otf.readUInt32BE(off),
      checksum: otf.readUInt32BE(off + 4),
      offset: otf.readUInt32BE(off + 8),
      length: otf.readUInt32BE(off + 12),
    })
  }
  // Insert kern entry sorted alphabetically by tag.
  entries.push({ tag: kernTag, checksum: kernChecksum, offset: 0, length: kernData.length })
  entries.sort((a, b) => a.tag - b.tag)

  const newNumTables = entries.length
  const newDirSize = 12 + newNumTables * 16

  // Compute new offsets — pack tables in their original order on disk so we
  // don't have to re-pad. Easiest: keep relative order, append kern at end.
  const oldDataStart = 12 + numTables * 16
  // Group existing entries by their original on-disk order.
  const existing = entries.filter(e => e.tag !== kernTag).map((e) => {
    const data = otf.subarray(e.offset, e.offset + e.length)
    return { ...e, data }
  })
  existing.sort((a, b) => a.offset - b.offset)

  // Lay out: header + new directory + each existing table data + kern data
  let runningOffset = newDirSize
  const placements: { entry: Entry, data: Buffer, newOffset: number }[] = []
  for (const e of existing) {
    placements.push({ entry: e, data: e.data, newOffset: runningOffset })
    runningOffset += pad4(e.length)
  }
  // kern at end
  const kernPlacement = { entry: entries.find(e => e.tag === kernTag)!, data: kernData, newOffset: runningOffset }
  placements.push(kernPlacement)
  runningOffset += pad4(kernData.length)

  const totalLen = runningOffset
  void oldDataStart
  const out = Buffer.alloc(totalLen)
  // sfnt header
  out.writeUInt32BE(sfntVersion, 0)
  out.writeUInt16BE(newNumTables, 4)
  // searchRange, entrySelector, rangeShift
  let sr = 1
  let es = 0
  while (sr * 2 <= newNumTables) { sr *= 2; es++ }
  const searchRange = sr * 16
  const rangeShift = newNumTables * 16 - searchRange
  out.writeUInt16BE(searchRange, 6)
  out.writeUInt16BE(es, 8)
  out.writeUInt16BE(rangeShift, 10)

  // Directory in tag order.
  const sortedForDir = [...entries].sort((a, b) => a.tag - b.tag)
  for (let i = 0; i < sortedForDir.length; i++) {
    const e = sortedForDir[i]!
    const placement = placements.find(p => p.entry.tag === e.tag)!
    const o2 = 12 + i * 16
    out.writeUInt32BE(e.tag, o2)
    out.writeUInt32BE(e.checksum, o2 + 4)
    out.writeUInt32BE(placement.newOffset, o2 + 8)
    out.writeUInt32BE(e.length, o2 + 12)
  }

  // Table data
  for (const p of placements) {
    p.data.copy(out, p.newOffset)
  }

  // Recompute head.checkSumAdjustment.
  const headEntry = sortedForDir.find(e => e.tag === Buffer.from('head').readUInt32BE(0))
  if (headEntry) {
    const headPlacement = placements.find(p => p.entry.tag === headEntry.tag)!
    // Zero the checkSumAdjustment field in the working buffer first.
    out.writeUInt32BE(0, headPlacement.newOffset + 8)
    let totalSum = 0
    for (let i = 0; i < pad4(totalLen); i += 4) {
      let v = 0
      for (let j = 0; j < 4; j++) {
        const idx = i + j
        v = (v << 8) >>> 0
        if (idx < totalLen) v = (v | out[idx]!) >>> 0
      }
      totalSum = (totalSum + v) >>> 0
    }
    const adjustment = (0xB1B0AFBA - totalSum) >>> 0
    out.writeUInt32BE(adjustment, headPlacement.newOffset + 8)
  }

  return out
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
