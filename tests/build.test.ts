/**
 * Build smoke tests — make sure each family produces all expected
 * artifacts at the expected paths and that they re-parse as valid
 * sfnt fonts.
 */

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'bun:test'
import opentype from 'opentype.js'
import { ALL_FAMILIES, CHARSET } from '../scripts/lib/common.ts'
import { FAMILIES } from '../scripts/families/index.ts'

const FONTS_DIR = resolve(import.meta.dir, '..', 'fonts')

describe('built artifacts exist', () => {
  for (const id of ALL_FAMILIES) {
    const family = FAMILIES[id]
    for (const m of family.masters) {
      const styleSuffix = m.styleName.replace(/\s+/g, '')
      const base = `${family.fileStem}-${styleSuffix}`
      test(`${id}/${m.styleName}.otf`, () => {
        expect(existsSync(resolve(FONTS_DIR, id, 'otf', `${base}.otf`))).toBe(true)
      })
      test(`${id}/${m.styleName}.woff`, () => {
        expect(existsSync(resolve(FONTS_DIR, id, 'woff', `${base}.woff`))).toBe(true)
      })
      test(`${id}/${m.styleName}.woff2`, () => {
        expect(existsSync(resolve(FONTS_DIR, id, 'woff2', `${base}.woff2`))).toBe(true)
      })
    }
  }
})

describe('OTF re-parses cleanly', () => {
  for (const id of ALL_FAMILIES) {
    const family = FAMILIES[id]
    for (const m of family.masters) {
      const styleSuffix = m.styleName.replace(/\s+/g, '')
      const base = `${family.fileStem}-${styleSuffix}`
      test(`${id}/${m.styleName}`, async () => {
        const buf = await Bun.file(resolve(FONTS_DIR, id, 'otf', `${base}.otf`)).arrayBuffer()
        const font = opentype.parse(buf)
        expect(font.unitsPerEm).toBe(1000)
        expect(font.glyphs.length).toBeGreaterThan(CHARSET.length)
        expect(font.names.fontFamily?.en).toBe(family.familyName)
      })
    }
  }
})
