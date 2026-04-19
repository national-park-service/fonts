#!/usr/bin/env bun
/**
 * Redwood Serif — old-style transitional serif with stroke contrast.
 *
 * Outlines live in `sources/redwood-serif/outlines.json` (lowercase shapes)
 * and `sources/redwood-serif/outlines-wide.json` (uppercase shapes). The
 * source family ships its lowercase and uppercase shapes in two separate
 * weight masters; we merge them so Redwood Serif Regular carries both
 * cases at their correct codepoints.
 */
import { resolve } from 'node:path'
import {
  brandNameTable,
  loadOutlines,
  mergeUppercaseFrom,
  writeFamilyOutputs,
  type FontData,
} from './lib/extracted.ts'
import { PIPELINES } from './lib/transforms.ts'
import { FAMILY_DISPLAY } from './lib/common.ts'

const ROOT = resolve(import.meta.dir, '..')
const FONTS = resolve(ROOT, 'fonts', 'redwood-serif')

const META = FAMILY_DISPLAY['redwood-serif']
const COPYRIGHT = `Copyright (c) 2026, NPS Fonts contributors. ${META.display} — released under the SIL Open Font License 1.1.`
const DESCRIPTION = `${META.display} — old-style serif with bracketed serifs and stroke contrast.`
const VERSION = 'Version 1.000'

export async function buildRedwoodSerif() {
  const lower = await loadOutlines('sources/redwood-serif/outlines.json')
  const upper = await loadOutlines('sources/redwood-serif/outlines-wide.json')
  mergeUppercaseFrom(lower, upper)
  PIPELINES['redwood-serif']!(lower)

  const branding = {
    family: META.display,
    postscript: META.file,
    styleName: 'Regular',
    copyright: COPYRIGHT,
    description: DESCRIPTION,
    version: VERSION,
    weightClass: 400,
    widthClass: 5,
  }
  brandNameTable(lower, branding)

  const out = await writeFamilyOutputs({
    outDir: FONTS,
    fileStem: `${META.file}-Regular`,
    ttfObject: lower as unknown as Parameters<typeof writeFamilyOutputs>[0]['ttfObject'],
    branding,
  })

  return { glyphCount: (lower as FontData).glyf.length, ...out }
}

const r = await buildRedwoodSerif()
console.log(
  `✓ ${META.display}: ${r.glyphCount} glyphs · TTF ${(r.ttf.length / 1024).toFixed(1)}KB `
  + `· OTF ${(r.otf.length / 1024).toFixed(1)}KB · WOFF2 ${(r.woff2.length / 1024).toFixed(1)}KB`,
)
