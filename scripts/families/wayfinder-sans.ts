/**
 * Wayfinder Sans — humanist sans-serif. Five weights + matching italics.
 */

import { CHARSET, FAMILY_DISPLAY, STROKE, type WeightName } from '../lib/common.ts'
import { DEFAULT_DRAWERS, widthFor } from '../lib/letters.ts'
import type { FamilySpec, MasterSpec } from '../lib/types.ts'

const DISPLAY = FAMILY_DISPLAY['wayfinder-sans']

function buildMaster(weight: WeightName, italic: boolean): MasterSpec {
  const ctx = {
    stroke: STROKE[weight],
    italic,
    capHeight: 700,
    xHeight: 500,
    ascenderHeight: 800,
    descenderDepth: -200,
    serifLen: 0,
    sidebearing: 60,
    slant: italic ? (12 * Math.PI) / 180 : 0,
    condense: 1,
  }
  const styleName = italic
    ? (weight === 'Regular' ? 'Italic' : `${weight} Italic`)
    : weight
  return {
    styleName,
    weight,
    italic,
    ctx,
    glyphs: CHARSET.map((entry) => {
      const drawer = DEFAULT_DRAWERS[entry.name]
      if (!drawer) throw new Error(`Wayfinder Sans missing drawer for ${entry.name}`)
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
  id: 'wayfinder-sans',
  familyName: DISPLAY.display,
  fileStem: DISPLAY.file,
  copyright: 'Copyright (c) 2026, NPS Fonts contributors. With Reserved Font Name "Wayfinder Sans".',
  designer: 'NPS Fonts contributors',
  designerURL: 'https://github.com/stacksjs/nps-fonts',
  manufacturer: 'NPS Fonts',
  vendorID: 'NPSF',
  version: '0.0.1',
  license: 'This Font Software is licensed under the SIL Open Font License, Version 1.1.',
  licenseURL: 'https://openfontlicense.org',
  unitsPerEm: 1000,
  ascender: 800,
  descender: -200,
  capHeight: 700,
  xHeight: 500,
  masters: (['Light', 'Regular', 'Medium', 'Bold', 'Black'] as const).flatMap((w) => [
    buildMaster(w, false),
    buildMaster(w, true),
  ]),
}
