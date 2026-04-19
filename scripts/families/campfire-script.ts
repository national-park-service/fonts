/**
 * Campfire Script — casual brush script, single weight.
 *
 * v0.0.1 uses the default sans drawers with a 16-degree forward slant
 * applied as a post-shear in the font writer. Connection between
 * letters / true script forms are TODO.
 */

import { CHARSET, FAMILY_DISPLAY, STROKE } from '../lib/common.ts'
import { DEFAULT_DRAWERS, widthFor } from '../lib/letters.ts'
import type { FamilySpec, MasterSpec } from '../lib/types.ts'

const DISPLAY = FAMILY_DISPLAY['campfire-script']

function buildMaster(): MasterSpec {
  const stroke = STROKE.Medium
  const ctx = {
    stroke,
    italic: true, // shear applied at write time
    capHeight: 700,
    xHeight: 500,
    ascenderHeight: 820,
    descenderDepth: -220,
    serifLen: 0,
    sidebearing: 40,
    slant: (16 * Math.PI) / 180,
    condense: 0.95,
  }
  return {
    styleName: 'Regular',
    weight: 'Regular',
    italic: true,
    ctx,
    glyphs: CHARSET.map((entry) => {
      const drawer = DEFAULT_DRAWERS[entry.name]
      if (!drawer) throw new Error(`Campfire Script missing drawer for ${entry.name}`)
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
  id: 'campfire-script',
  familyName: DISPLAY.display,
  fileStem: DISPLAY.file,
  copyright: 'Copyright (c) 2026, NPS Fonts contributors. With Reserved Font Name "Campfire Script".',
  designer: 'NPS Fonts contributors',
  designerURL: 'https://github.com/stacksjs/nps-fonts',
  manufacturer: 'NPS Fonts',
  vendorID: 'NPSF',
  version: '0.0.1',
  license: 'This Font Software is licensed under the SIL Open Font License, Version 1.1.',
  licenseURL: 'https://openfontlicense.org',
  unitsPerEm: 1000,
  ascender: 820,
  descender: -220,
  capHeight: 700,
  xHeight: 500,
  masters: [buildMaster()],
}
