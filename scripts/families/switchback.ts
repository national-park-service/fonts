/**
 * Switchback — rugged condensed slab display, single weight.
 */

import { CHARSET, FAMILY_DISPLAY, STROKE } from '../lib/common.ts'
import { DEFAULT_DRAWERS, widthFor } from '../lib/letters.ts'
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
    serifLen: stroke * 2.4,
    serifThickness: Math.max(stroke * 0.7, 50),
    sidebearing: 50,
    slant: 0,
    condense: 0.78, // condensed
  }
  return {
    styleName: 'Regular',
    weight: 'Bold',
    italic: false,
    ctx,
    glyphs: CHARSET.map((entry) => {
      const drawer = DEFAULT_DRAWERS[entry.name]
      if (!drawer) throw new Error(`Switchback missing drawer for ${entry.name}`)
      return {
        name: entry.name,
        unicode: entry.unicode,
        advanceWidth: widthFor(entry.name, ctx),
        draw: drawer,
      }
    }),
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
  version: '0.0.1',
  license: 'This Font Software is licensed under the SIL Open Font License, Version 1.1.',
  licenseURL: 'https://openfontlicense.org',
  unitsPerEm: 1000,
  ascender: 800,
  descender: -180,
  capHeight: 720,
  xHeight: 520,
  masters: [buildMaster()],
}
