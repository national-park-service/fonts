/**
 * Build smoke tests — verify each family produces all expected
 * artifacts and that they re-parse as valid sfnt fonts.
 */

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'bun:test'
import opentype from 'opentype.js'
import { ALL_FAMILIES } from '../scripts/lib/common.ts'
import { FAMILIES } from '../scripts/families/index.ts'

const FONTS_DIR = resolve(import.meta.dir, '..', 'fonts')

function basename(family: typeof FAMILIES[keyof typeof FAMILIES], styleName: string): string {
  return `${family.fileStem}-${styleName.replace(/\s+/g, '')}`
}

describe('built artifacts exist', () => {
  for (const id of ALL_FAMILIES) {
    const family = FAMILIES[id]
    for (const m of family.masters) {
      const base = basename(family, m.styleName)
      test(`${id}/${base}.otf`, () => {
        expect(existsSync(resolve(FONTS_DIR, id, 'otf', `${base}.otf`))).toBe(true)
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

describe('OTF re-parses cleanly', () => {
  for (const id of ALL_FAMILIES) {
    const family = FAMILIES[id]
    for (const m of family.masters) {
      const base = basename(family, m.styleName)
      test(`${id}/${m.styleName}`, async () => {
        const buf = await Bun.file(resolve(FONTS_DIR, id, 'otf', `${base}.otf`)).arrayBuffer()
        const font = opentype.parse(buf)
        expect(font.unitsPerEm).toBe(1000)
        expect(font.glyphs.length).toBeGreaterThan(60)
        expect(font.names.fontFamily?.en).toBe(family.familyName)
      })
    }
  }
})

describe('Latin-1 coverage', () => {
  // The most-common Latin-1 codepoints all families should cover.
  const required = [
    0x00A0, 0x00A1, 0x00A9, 0x00AE, 0x00B0, 0x00BF,
    0x00C1, 0x00C9, 0x00CD, 0x00D3, 0x00DA, // ÁÉÍÓÚ
    0x00E1, 0x00E9, 0x00ED, 0x00F3, 0x00FA, // áéíóú
    0x00DF, 0x00C7, 0x00E7, 0x00D1, 0x00F1, // ßÇçÑñ
  ]
  for (const id of ALL_FAMILIES) {
    const family = FAMILIES[id]
    test(`${id} has Latin-1 coverage`, async () => {
      const m = family.masters[0]!
      const base = basename(family, m.styleName)
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

describe('kerning is present', () => {
  for (const id of ALL_FAMILIES) {
    const family = FAMILIES[id]
    if (!family.kerningPairs || Object.keys(family.kerningPairs).length === 0) continue
    test(`${id} has kerning pairs`, async () => {
      const m = family.masters[0]!
      const base = basename(family, m.styleName)
      const buf = await Bun.file(resolve(FONTS_DIR, id, 'otf', `${base}.otf`)).arrayBuffer()
      const font = opentype.parse(buf)
      const pairCount = Object.keys(font.kerningPairs ?? {}).length
      expect(pairCount).toBeGreaterThan(20)
    })
  }
})

describe('ligature glyphs exist (Wayfinder families)', () => {
  for (const id of ['wayfinder-sans', 'wayfinder-serif'] as const) {
    const family = FAMILIES[id]
    test(`${id} has fi/fl ligatures`, async () => {
      const m = family.masters[0]!
      const base = basename(family, m.styleName)
      const buf = await Bun.file(resolve(FONTS_DIR, id, 'otf', `${base}.otf`)).arrayBuffer()
      const font = opentype.parse(buf)
      const names = new Set<string>()
      for (let i = 0; i < font.glyphs.length; i++) {
        const g = font.glyphs.get(i) as opentype.Glyph
        if (g?.name) names.add(g.name)
      }
      expect(names.has('fi')).toBe(true)
      expect(names.has('fl')).toBe(true)
    })
  }
})

describe('vertical metrics consistent across weights', () => {
  for (const id of ALL_FAMILIES) {
    const family = FAMILIES[id]
    test(`${id} metrics`, async () => {
      const upms: Set<number> = new Set()
      const ascenders: Set<number> = new Set()
      const descenders: Set<number> = new Set()
      for (const m of family.masters) {
        const base = basename(family, m.styleName)
        const buf = await Bun.file(resolve(FONTS_DIR, id, 'otf', `${base}.otf`)).arrayBuffer()
        const font = opentype.parse(buf)
        upms.add(font.unitsPerEm)
        ascenders.add(font.ascender)
        descenders.add(font.descender)
      }
      expect(upms.size).toBe(1)
      expect(ascenders.size).toBe(1)
      expect(descenders.size).toBe(1)
    })
  }
})
