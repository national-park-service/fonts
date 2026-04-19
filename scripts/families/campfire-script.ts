/**
 * Campfire Script — casual brush script, single weight.
 *
 * v0.1 uses sheared sans skeletons with brush-flavored overrides for
 * the most distinctive script glyphs. True brush forms / connections
 * are still TODO and the work of an actual script designer.
 */

import { buildGlyphs } from '../lib/build-glyphs.ts'
import { FAMILY_DISPLAY, STROKE } from '../lib/common.ts'
import { SCRIPT_KERNING } from '../lib/kerning.ts'
import { ITALIC_OVERRIDES } from '../lib/letters.ts'
import type { FamilySpec, MasterSpec } from '../lib/types.ts'

const DISPLAY = FAMILY_DISPLAY['campfire-script']

function buildMaster(): MasterSpec {
  const stroke = STROKE.Medium
  const ctx = {
    stroke,
    italic: true,
    capHeight: 700,
    xHeight: 500,
    ascenderHeight: 820,
    descenderDepth: -220,
    serifLen: 0,
    sidebearing: 40,
    slant: (16 * Math.PI) / 180,
    condense: 0.95,
    overshoot: Math.max(stroke * 0.2, 14),
    contrast: 0.85,
    bracketed: false,
    geometric: false,
  }
  return {
    styleName: 'Regular',
    weight: 'Regular',
    italic: true,
    ctx,
    glyphs: buildGlyphs(ctx, {
      italic: true,
      // Use italic structural overrides for distinctive letters
      overrides: { ...ITALIC_OVERRIDES },
    }),
  }
}

export const family: FamilySpec = {
  id: 'campfire-script',
  familyName: DISPLAY.display,
  fileStem: DISPLAY.file,
  copyright: 'Copyright (c) 2026, NPS Fonts contributors. With Reserved Font Name "Campfire Script".',
  designer: 'NPS Fonts contributors',
  designerURL: 'https://github.com/stacksjs/nps-fonts',
  manufacturer: 'NPS Fonts',
  vendorID: 'NPSF',
  version: '0.1.0',
  license: 'This Font Software is licensed under the SIL Open Font License, Version 1.1.',
  licenseURL: 'https://openfontlicense.org',
  unitsPerEm: 1000,
  ascender: 820,
  descender: -220,
  capHeight: 700,
  xHeight: 500,
  kerningPairs: SCRIPT_KERNING,
  masters: [buildMaster()],
}
