/**
 * Switchback — rugged condensed slab display, single weight.
 */

import { buildGlyphs } from '../lib/build-glyphs.ts'
import { FAMILY_DISPLAY, STROKE } from '../lib/common.ts'
import { DISPLAY_KERNING } from '../lib/kerning.ts'
import type { FamilySpec, MasterSpec } from '../lib/types.ts'

const DISPLAY = FAMILY_DISPLAY.switchback

function buildMaster(): MasterSpec {
  const stroke = STROKE.Bold
  const ctx = {
    stroke,
    italic: false,
    capHeight: 720,
    xHeight: 520,
    ascenderHeight: 800,
    descenderDepth: -180,
    // Heavy slabs, not bracketed — the wood-type feel
    serifLen: stroke * 2.6,
    serifThickness: Math.max(stroke * 0.75, 60),
    sidebearing: 50,
    slant: 0,
    condense: 0.78,
    overshoot: Math.max(stroke * 0.14, 10),
    contrast: 0.95,
    bracketed: false,
    geometric: false,
  }
  return {
    styleName: 'Regular',
    weight: 'Bold',
    italic: false,
    ctx,
    glyphs: buildGlyphs(ctx),
  }
}

export const family: FamilySpec = {
  id: 'switchback',
  familyName: DISPLAY.display,
  fileStem: DISPLAY.file,
  copyright: 'Copyright (c) 2026, NPS Fonts contributors. With Reserved Font Name "Switchback".',
  designer: 'NPS Fonts contributors',
  designerURL: 'https://github.com/stacksjs/nps-fonts',
  manufacturer: 'NPS Fonts',
  vendorID: 'NPSF',
  version: '0.1.0',
  license: 'This Font Software is licensed under the SIL Open Font License, Version 1.1.',
  licenseURL: 'https://openfontlicense.org',
  unitsPerEm: 1000,
  ascender: 800,
  descender: -180,
  capHeight: 720,
  xHeight: 520,
  kerningPairs: DISPLAY_KERNING,
  masters: [buildMaster()],
}
