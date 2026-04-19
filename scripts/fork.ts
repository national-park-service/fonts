#!/usr/bin/env bun
/**
 * Fork pipeline: download an OFL-licensed source font from
 * google/fonts, rename its `name` table to our family/style identity
 * (preserving original copyright + adding ours per OFL §1), and emit
 * .otf / .ttf / .woff / .woff2 under fonts/<our-id>/.
 *
 *   bun run scripts/fork.ts --all
 *   bun run scripts/fork.ts --family wayfinder-sans
 */

import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { ALL_FAMILIES, type FamilyId } from './lib/common.ts'
import { buildNameTable, NAME_ID, readNameTable } from './lib/name-table.ts'
import { parseSfnt, replaceTable, tableData } from './lib/sfnt.ts'
import { sfntToWoff } from './lib/woff.ts'
import {
  encodeFilename,
  FAMILY_SOURCES,
  ofltxtUrl,
  sanitizeFilename,
  type FamilySource,
  type FontSource,
} from './sources.ts'

const wawoff2 = await import('wawoff2')

const ROOT = resolve(import.meta.dir, '..')
const VENDOR = resolve(ROOT, 'vendor')
const FONTS = resolve(ROOT, 'fonts')

interface BuildOutputs {
  otf: string
  ttf: string
  woff: string
  woff2: string
  bytes: number
}

async function downloadIfMissing(url: string, dst: string): Promise<void> {
  if (existsSync(dst)) return
  await mkdir(dirname(dst), { recursive: true })
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`)
  await writeFile(dst, Buffer.from(await res.arrayBuffer()))
}

function buildOverrides(fam: FamilySource, source: FontSource, version: string) {
  const styleSuffix = source.styleName.replace(/\s+/g, '')
  const psName = `${fam.newFileStem}-${styleSuffix}`
  const fullName = `${fam.newFamilyName} ${source.styleName}`
  const styleMap = (() => {
    const bold = source.weight === 'Bold' || source.weight === 'Black' || source.weight === 'ExtraBold'
    if (bold && source.italic) return 'Bold Italic'
    if (bold) return 'Bold'
    if (source.italic) return 'Italic'
    return 'Regular'
  })()
  return {
    [NAME_ID.COPYRIGHT]: [
      fam.sourceCopyright + '.',
      `Modified copyright (c) 2026 NPS Fonts contributors`,
      `(https://github.com/stacksjs/nps-fonts).`,
      `Reserved Font Name "${fam.newReservedFontName}".`,
      `Forked from ${fam.sourceFamily} under the SIL Open Font License v1.1.`,
    ].join(' '),
    [NAME_ID.FAMILY]: `${fam.newFamilyName} ${styleMap === 'Bold' || styleMap === 'Bold Italic' ? '' : ''}`.trim() || fam.newFamilyName,
    [NAME_ID.SUBFAMILY]: styleMap,
    [NAME_ID.UNIQUE_ID]: `NPSFonts: ${fam.newFamilyName} ${source.styleName} v${version}`,
    [NAME_ID.FULL_NAME]: fullName,
    [NAME_ID.VERSION]: `Version ${version}`,
    [NAME_ID.POSTSCRIPT_NAME]: psName,
    [NAME_ID.TRADEMARK]: '',
    [NAME_ID.MANUFACTURER]: 'NPS Fonts contributors',
    [NAME_ID.DESIGNER]: `Original: ${fam.sourceAuthor}. Adapted by NPS Fonts contributors.`,
    [NAME_ID.DESCRIPTION]: `${fam.newFamilyName} — open-source typeface inspired by U.S. National Park Service signage. Forked from ${fam.sourceFamily} (${fam.sourceLicense}). Independent project, unaffiliated with the NPS.`,
    [NAME_ID.VENDOR_URL]: 'https://github.com/stacksjs/nps-fonts',
    [NAME_ID.DESIGNER_URL]: fam.sourceRepo,
    [NAME_ID.LICENSE]: 'This Font Software is licensed under the SIL Open Font License, Version 1.1. This license is available with a FAQ at https://openfontlicense.org. Original work licensed under the same terms.',
    [NAME_ID.LICENSE_URL]: 'https://openfontlicense.org',
    [NAME_ID.PREFERRED_FAMILY]: fam.newFamilyName,
    [NAME_ID.PREFERRED_SUBFAMILY]: source.styleName,
  } as Record<number, string>
}

async function processOne(fam: FamilySource, source: FontSource, version: string): Promise<BuildOutputs> {
  const url = fam.baseUrl + encodeFilename(source.filename)
  const local = resolve(VENDOR, fam.id, sanitizeFilename(source.filename))
  await downloadIfMissing(url, local)

  const ttfBuf = Buffer.from(await Bun.file(local).arrayBuffer())

  const parsed = parseSfnt(ttfBuf)
  const nameData = tableData(parsed, 'name')
  if (!nameData) throw new Error(`No name table in ${source.filename}`)

  const existingRecords = readNameTable(nameData)
  const overrides = buildOverrides(fam, source, version)
  const newName = buildNameTable(existingRecords, overrides)
  const renamed = replaceTable(ttfBuf, 'name', newName)

  const styleSuffix = source.styleName.replace(/\s+/g, '')
  const baseName = `${fam.newFileStem}-${styleSuffix}`
  const otf = resolve(FONTS, fam.id, 'otf', `${baseName}.otf`)
  const ttf = resolve(FONTS, fam.id, 'ttf', `${baseName}.ttf`)
  const woff = resolve(FONTS, fam.id, 'woff', `${baseName}.woff`)
  const woff2 = resolve(FONTS, fam.id, 'woff2', `${baseName}.woff2`)

  await Promise.all([
    mkdir(dirname(otf), { recursive: true }),
    mkdir(dirname(ttf), { recursive: true }),
    mkdir(dirname(woff), { recursive: true }),
    mkdir(dirname(woff2), { recursive: true }),
  ])

  await writeFile(otf, renamed)
  await writeFile(ttf, renamed)
  await writeFile(woff, sfntToWoff(renamed))
  const woff2Buf = Buffer.from(await wawoff2.compress(renamed))
  await writeFile(woff2, woff2Buf)

  return { otf, ttf, woff, woff2, bytes: renamed.length }
}

async function processFamily(fam: FamilySource, version: string): Promise<{ count: number, bytes: number }> {
  console.log(`\n[${fam.newFamilyName}] forking from ${fam.sourceFamily}`)
  // Cache the source's OFL.txt for attribution.
  const oflLocal = resolve(VENDOR, fam.id, 'OFL.txt')
  try { await downloadIfMissing(ofltxtUrl(fam), oflLocal) }
  catch { /* not all families have OFL.txt at the expected path; non-fatal */ }

  let count = 0
  let bytes = 0
  for (const source of fam.sources) {
    const t0 = performance.now()
    const out = await processOne(fam, source, version)
    const dt = (performance.now() - t0).toFixed(0)
    const otfSize = (await Bun.file(out.otf).arrayBuffer()).byteLength
    const woffSize = (await Bun.file(out.woff).arrayBuffer()).byteLength
    const woff2Size = (await Bun.file(out.woff2).arrayBuffer()).byteLength
    console.log(
      `  ✓ ${source.styleName.padEnd(16)} `
      + `otf=${kb(otfSize)} woff=${kb(woffSize)} woff2=${kb(woff2Size)} `
      + `(${dt}ms)`,
    )
    count++
    bytes += otfSize + woffSize + woff2Size
  }
  return { count, bytes }
}

function kb(n: number): string {
  return `${(n / 1024).toFixed(1)}KB`
}

interface Args {
  all: boolean
  families: FamilyId[]
}
function parseArgs(argv: string[]): Args {
  const args: Args = { all: false, families: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--all') args.all = true
    else if (a === '--family') {
      const v = argv[++i]
      if (!v) throw new Error('--family requires a value')
      if (!(ALL_FAMILIES as readonly string[]).includes(v))
        throw new Error(`Unknown family: ${v}. Known: ${ALL_FAMILIES.join(', ')}`)
      args.families.push(v as FamilyId)
    }
  }
  if (!args.all && args.families.length === 0) args.all = true
  return args
}

async function main() {
  const args = parseArgs(Bun.argv.slice(2))
  const targets: FamilyId[] = args.all ? [...ALL_FAMILIES] : args.families
  const pkg = await Bun.file(resolve(ROOT, 'package.json')).json()
  const version = pkg.version

  const start = performance.now()
  let total = 0
  let totalBytes = 0
  for (const id of targets) {
    const fam = FAMILY_SOURCES[id]
    const r = await processFamily(fam, version)
    total += r.count
    totalBytes += r.bytes
  }
  const dt = ((performance.now() - start) / 1000).toFixed(1)
  console.log(
    `\nForked ${total} masters across ${targets.length} families `
    + `(${kb(totalBytes)} total) in ${dt}s.`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
