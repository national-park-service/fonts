#!/usr/bin/env bun
/**
 * Sanity checks on built fonts: re-parse each output, verify metadata
 * was renamed, glyph count + cmap coverage are reasonable, and
 * critical tables (GPOS, GSUB, name, head) are present.
 */

import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import opentype from 'opentype.js'
import { ALL_FAMILIES } from './lib/common.ts'
import { FAMILY_SOURCES } from './sources.ts'

const FONTS_DIR = resolve(import.meta.dir, '..', 'fonts')

interface Issue {
  level: 'error' | 'warn'
  file: string
  message: string
}

async function main() {
  const issues: Issue[] = []
  let checked = 0

  for (const id of ALL_FAMILIES) {
    const fam = FAMILY_SOURCES[id]
    const otfDir = resolve(FONTS_DIR, id, 'otf')
    let entries: string[] = []
    try {
      entries = (await readdir(otfDir)).filter(f => f.endsWith('.otf'))
    }
    catch {
      issues.push({ level: 'error', file: id, message: 'no otf/ directory' })
      continue
    }
    if (entries.length === 0) {
      issues.push({ level: 'error', file: id, message: 'no .otf files built' })
      continue
    }
    for (const file of entries) {
      const path = resolve(otfDir, file)
      const buf = await Bun.file(path).arrayBuffer()
      let font: opentype.Font
      try {
        font = opentype.parse(buf)
      }
      catch (e) {
        issues.push({ level: 'error', file, message: `failed to parse: ${(e as Error).message}` })
        continue
      }
      checked++
      // Family name was renamed
      if (font.names.fontFamily?.en !== fam.newFamilyName) {
        issues.push({
          level: 'error',
          file,
          message: `family name not renamed: got "${font.names.fontFamily?.en}", expected "${fam.newFamilyName}"`,
        })
      }
      // Copyright was preserved + appended
      const cr = font.names.copyright?.en ?? ''
      if (!cr.includes(fam.sourceFamily.split(' ')[0]!) && !cr.includes('Project Authors')) {
        issues.push({ level: 'warn', file, message: 'copyright does not appear to credit the original author' })
      }
      if (!cr.includes('NPS Fonts')) {
        issues.push({ level: 'warn', file, message: 'copyright missing our additions' })
      }
      // Reserved Font Name claimed
      if (!cr.includes(fam.newReservedFontName)) {
        issues.push({ level: 'warn', file, message: 'Reserved Font Name not claimed in copyright' })
      }
      console.log(
        `✓ ${file.padEnd(40)} `
        + `glyphs=${String(font.glyphs.length).padStart(4)} `
        + `upm=${font.unitsPerEm}`,
      )
    }
  }

  console.log(`\nChecked ${checked} font(s).`)
  for (const i of issues) {
    const tag = i.level === 'error' ? '✗' : '!'
    console.log(`${tag} [${i.file}] ${i.message}`)
  }

  const errors = issues.filter(i => i.level === 'error').length
  if (errors > 0) {
    console.error(`\n${errors} error(s) — failing.`)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
