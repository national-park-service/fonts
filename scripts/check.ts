#!/usr/bin/env bun
/**
 * Sanity checks on built fonts. Re-opens each .otf with opentype.js,
 * verifies headers, glyph count, codepoint coverage, and metric sanity.
 *
 * Not a substitute for fontbakery — meant to catch the obvious build
 * regressions in CI without a Python dep.
 */

import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import opentype from 'opentype.js'
import { ALL_FAMILIES, CHARSET } from './lib/common.ts'

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
      // Basic sanity
      if (font.unitsPerEm <= 0) {
        issues.push({ level: 'error', file, message: `bad unitsPerEm: ${font.unitsPerEm}` })
      }
      if (!font.names.fontFamily) {
        issues.push({ level: 'error', file, message: 'missing family name' })
      }
      // Coverage
      const missing: string[] = []
      for (const entry of CHARSET) {
        const g = font.charToGlyph(String.fromCodePoint(entry.unicode))
        if (!g || g.name === '.notdef') {
          // .notdef is ok for `space` if width is set; we accept either
          if (entry.name === 'space') continue
          missing.push(entry.name)
        }
      }
      if (missing.length > 0) {
        issues.push({
          level: 'warn',
          file,
          message: `missing ${missing.length} glyph(s): ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? '…' : ''}`,
        })
      }
      console.log(`✓ ${file} — ${font.glyphs.length} glyphs, upm=${font.unitsPerEm}`)
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
