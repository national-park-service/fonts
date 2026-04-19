/**
 * Cairn — bold geometric all-caps signage display. Two weights.
 *
 * All-caps: lowercase letters reuse the uppercase outlines (smaller cap
 * height for visual differentiation in small caps style not done in
 * v0.0.1; lowercase is identical to uppercase shape for now).
 */

import { CHARSET, FAMILY_DISPLAY, STROKE } from '../lib/common.ts'
import { DEFAULT_DRAWERS, widthFor } from '../lib/letters.ts'
import type { FamilySpec, GlyphSpec, MasterSpec } from '../lib/types.ts'

const DISPLAY = FAMILY_DISPLAY.cairn

function buildMaster(weight: 'Regular' | 'Bold'): MasterSpec {
  const ctx = {
    stroke: weight === 'Bold' ? STROKE.Black : STROKE.Bold,
    italic: false,
    capHeight: 720,
    xHeight: 720, // intentional — lowercase reuses uppercase shapes at cap height
    ascenderHeight: 760,
    descenderDepth: -120,
    serifLen: 0,
    sidebearing: 80,
    slant: 0,
    condense: 1.0,
  }
  const glyphs: GlyphSpec[] = CHARSET.map((entry) => {
    const lookup = entry.name.length === 1 && entry.name >= 'a' && entry.name <= 'z'
      ? entry.name.toUpperCase()
      : entry.name
    const drawer = DEFAULT_DRAWERS[lookup]
    if (!drawer) throw new Error(`Cairn missing drawer for ${entry.name}`)
    return {
      name: entry.name,
      unicode: entry.unicode,
      advanceWidth: widthFor(lookup, ctx),
      draw: drawer,
    }
  })
  return {
    styleName: weight,
    weight,
    italic: false,
    ctx,
    glyphs,
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
  version: '0.0.1',
  license: 'This Font Software is licensed under the SIL Open Font License, Version 1.1.',
  licenseURL: 'https://openfontlicense.org',
  unitsPerEm: 1000,
  ascender: 760,
  descender: -120,
  capHeight: 720,
  xHeight: 720,
  masters: [buildMaster('Regular'), buildMaster('Bold')],
}
