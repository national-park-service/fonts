#!/usr/bin/env bun
/**
 * Sequoia Sans — humanist display sans for park field guides.
 *
 * The source family ships its uppercase and lowercase shapes in separate
 * weight masters (Thin/Light/Wide carry uppercase only; Regular carries
 * lowercase only). This script merges each pairing into a static cut:
 *
 *   - Regular: Regular lowercase + Light uppercase
 *   - Wide:    Regular lowercase + Wide uppercase
 *   - Light:   Light uppercase (caps only — display)
 *   - Thin:    Thin uppercase (caps only — display)
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
const FONTS = resolve(ROOT, 'fonts', 'sequoia-sans')

const META = FAMILY_DISPLAY['sequoia-sans']
const COPYRIGHT = `Copyright (c) 2026, NPS Fonts contributors. ${META.display} — released under the SIL Open Font License 1.1.`
const DESCRIPTION = `${META.display} — humanist sans cut for park field guides.`
const VERSION = 'Version 1.000'

// Source paths (relative to project root)
const SRC_REGULAR = 'sources/sequoia-sans/outlines.json'
const SRC_LIGHT = 'sources/sequoia-sans/outlines-light.json'
const SRC_THIN = 'sources/sequoia-sans/outlines-thin.json'
const SRC_WIDE = 'sources/sequoia-sans/outlines-wide.json'

interface CutSpec {
  styleName: string
  weightClass: number
  widthClass: number
  /** Lowercase-glyph source path (or null = uppercase-only display cut). */
  lower: string | null
  /** Uppercase-glyph source path. */
  upper: string
}

const CUTS: CutSpec[] = [
  { styleName: 'Regular', weightClass: 400, widthClass: 5, lower: SRC_REGULAR, upper: SRC_LIGHT },
  { styleName: 'Wide',    weightClass: 400, widthClass: 7, lower: SRC_REGULAR, upper: SRC_WIDE },
  { styleName: 'Light',   weightClass: 300, widthClass: 5, lower: null,        upper: SRC_LIGHT },
  { styleName: 'Thin',    weightClass: 100, widthClass: 5, lower: null,        upper: SRC_THIN },
]

async function buildCut(cut: CutSpec) {
  const base = cut.lower ? await loadOutlines(cut.lower) : await loadOutlines(cut.upper)
  if (cut.lower) {
    const upper = await loadOutlines(cut.upper)
    mergeUppercaseFrom(base, upper)
  }
  PIPELINES['sequoia-sans']!(base)

  const branding = {
    family: META.display,
    postscript: META.file,
    styleName: cut.styleName,
    copyright: COPYRIGHT,
    description: DESCRIPTION,
    version: VERSION,
    weightClass: cut.weightClass,
    widthClass: cut.widthClass,
  }
  brandNameTable(base, branding)

  const out = await writeFamilyOutputs({
    outDir: FONTS,
    fileStem: `${META.file}-${cut.styleName}`,
    ttfObject: base as unknown as Parameters<typeof writeFamilyOutputs>[0]['ttfObject'],
    branding,
  })

  return { glyphCount: (base as FontData).glyf.length, ...out }
}

export async function buildSequoiaSans() {
  const results = []
  for (const cut of CUTS) {
    const r = await buildCut(cut)
    results.push({ cut: cut.styleName, ...r })
    console.log(
      `✓ ${META.display} ${cut.styleName}: ${r.glyphCount} glyphs · `
      + `TTF ${(r.ttf.length / 1024).toFixed(1)}KB · OTF ${(r.otf.length / 1024).toFixed(1)}KB · `
      + `WOFF2 ${(r.woff2.length / 1024).toFixed(1)}KB`,
    )
  }
  return results
}

await buildSequoiaSans()
