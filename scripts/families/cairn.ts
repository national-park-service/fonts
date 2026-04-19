/**
 * Cairn — pure geometric all-caps signage display. Two weights.
 *
 * No stress, no overshoot, no serifs. Lowercase reuses uppercase outlines
 * so the typeface reads "all caps" everywhere it's typed.
 */

import { buildGlyphs } from '../lib/build-glyphs.ts'
import { FAMILY_DISPLAY, STROKE } from '../lib/common.ts'
import { DISPLAY_KERNING } from '../lib/kerning.ts'
import type { FamilySpec, MasterSpec } from '../lib/types.ts'

const DISPLAY = FAMILY_DISPLAY.cairn

function buildMaster(weight: 'Regular' | 'Bold'): MasterSpec {
  const stroke = weight === 'Bold' ? STROKE.Black : STROKE.Bold
  const ctx = {
    stroke,
    italic: false,
    capHeight: 720,
    xHeight: 720,
    ascenderHeight: 760,
    descenderDepth: -120,
    serifLen: 0,
    sidebearing: 80,
    slant: 0,
    condense: 1.0,
    overshoot: 0, // pure geometric
    contrast: 1,
    bracketed: false,
    geometric: true,
  }
  return {
    styleName: weight,
    weight,
    italic: false,
    ctx,
    // Lowercase letters reuse uppercase shapes (and uppercase widths)
    glyphs: buildGlyphs(ctx, {
      remap: (name) => {
        if (name.length === 1 && name >= 'a' && name <= 'z') return name.toUpperCase()
        return name
      },
    }),
  }
}

export const family: FamilySpec = {
  id: 'cairn',
  familyName: DISPLAY.display,
  fileStem: DISPLAY.file,
  copyright: 'Copyright (c) 2026, NPS Fonts contributors. With Reserved Font Name "Cairn".',
  designer: 'NPS Fonts contributors',
  designerURL: 'https://github.com/stacksjs/nps-fonts',
  manufacturer: 'NPS Fonts',
  vendorID: 'NPSF',
  version: '0.1.0',
  license: 'This Font Software is licensed under the SIL Open Font License, Version 1.1.',
  licenseURL: 'https://openfontlicense.org',
  unitsPerEm: 1000,
  ascender: 760,
  descender: -120,
  capHeight: 720,
  xHeight: 720,
  kerningPairs: DISPLAY_KERNING,
  masters: [buildMaster('Regular'), buildMaster('Bold')],
}
