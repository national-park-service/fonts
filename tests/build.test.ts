/**
 * Build smoke tests for the fork pipeline.
 */

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'bun:test'
import opentype from 'opentype.js'
import { ALL_FAMILIES } from '../scripts/lib/common.ts'
import { FAMILY_SOURCES } from '../scripts/sources.ts'

const FONTS_DIR = resolve(import.meta.dir, '..', 'fonts')

function basename(stem: string, styleName: string): string {
  return `${stem}-${styleName.replace(/\s+/g, '')}`
}

describe('built artifacts exist', () => {
  for (const id of ALL_FAMILIES) {
    const fam = FAMILY_SOURCES[id]
    for (const m of fam.sources) {
      const base = basename(fam.newFileStem, m.styleName)
      test(`${id}/${base}.otf`, () => {
        expect(existsSync(resolve(FONTS_DIR, id, 'otf', `${base}.otf`))).toBe(true)
      })
      test(`${id}/${base}.ttf`, () => {
        expect(existsSync(resolve(FONTS_DIR, id, 'ttf', `${base}.ttf`))).toBe(true)
      })
      test(`${id}/${base}.woff`, () => {
        expect(existsSync(resolve(FONTS_DIR, id, 'woff', `${base}.woff`))).toBe(true)
      })
      test(`${id}/${base}.woff2`, () => {
        expect(existsSync(resolve(FONTS_DIR, id, 'woff2', `${base}.woff2`))).toBe(true)
      })
    }
  }
})

describe('fonts re-parse cleanly', () => {
  for (const id of ALL_FAMILIES) {
    const fam = FAMILY_SOURCES[id]
    for (const m of fam.sources) {
      const base = basename(fam.newFileStem, m.styleName)
      test(`${id}/${m.styleName}`, async () => {
        const buf = await Bun.file(resolve(FONTS_DIR, id, 'otf', `${base}.otf`)).arrayBuffer()
        const font = opentype.parse(buf)
        expect(font.unitsPerEm).toBeGreaterThan(0)
        expect(font.glyphs.length).toBeGreaterThan(50)
      })
    }
  }
})

describe('rename: family name updated', () => {
  for (const id of ALL_FAMILIES) {
    const fam = FAMILY_SOURCES[id]
    test(`${id}`, async () => {
      const m = fam.sources[0]!
      const base = basename(fam.newFileStem, m.styleName)
      const buf = await Bun.file(resolve(FONTS_DIR, id, 'otf', `${base}.otf`)).arrayBuffer()
      const font = opentype.parse(buf)
      expect(font.names.fontFamily?.en).toBe(fam.newFamilyName)
    })
  }
})

describe('attribution: copyright preserved + ours appended', () => {
  for (const id of ALL_FAMILIES) {
    const fam = FAMILY_SOURCES[id]
    test(`${id}`, async () => {
      const m = fam.sources[0]!
      const base = basename(fam.newFileStem, m.styleName)
      const buf = await Bun.file(resolve(FONTS_DIR, id, 'otf', `${base}.otf`)).arrayBuffer()
      const font = opentype.parse(buf)
      const cr = font.names.copyright?.en ?? ''
      // Mentions either "Project Authors" (the OFL convention) or the source author surname
      expect(cr.length).toBeGreaterThan(50)
      expect(cr).toContain('NPS Fonts')
      expect(cr).toContain(fam.newReservedFontName)
    })
  }
})

describe('cmap: covers Latin-1 supplement', () => {
  const required = [0xC1, 0xC9, 0xCD, 0xD3, 0xDA, 0xE1, 0xE9, 0xED, 0xF3, 0xFA, 0xC7, 0xE7, 0xD1, 0xF1]
  for (const id of ALL_FAMILIES) {
    const fam = FAMILY_SOURCES[id]
    test(`${id}`, async () => {
      const m = fam.sources[0]!
      const base = basename(fam.newFileStem, m.styleName)
      const buf = await Bun.file(resolve(FONTS_DIR, id, 'otf', `${base}.otf`)).arrayBuffer()
      const font = opentype.parse(buf)
      const missing: string[] = []
      for (const cp of required) {
        const g = font.charToGlyph(String.fromCodePoint(cp))
        if (!g || g.name === '.notdef')
          missing.push(`U+${cp.toString(16).padStart(4, '0').toUpperCase()}`)
      }
      expect(missing).toEqual([])
    })
  }
})
