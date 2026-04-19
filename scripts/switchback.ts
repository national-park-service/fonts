#!/usr/bin/env bun
/**
 * Switchback — routed-trail display caps in two sibling cuts:
 * "Regular" (clean machine-routed) and "Rough" (chiseled with surface
 * texture). Outlines live in
 * `sources/switchback/outlines-{clean,rough}.json`.
 */
import { resolve } from 'node:path'
import {
  brandNameTable,
  loadOutlines,
  writeFamilyOutputs,
  type FontData,
} from './lib/extracted.ts'
import { PIPELINES } from './lib/transforms.ts'
import { FAMILY_DISPLAY } from './lib/common.ts'

const ROOT = resolve(import.meta.dir, '..')
const FONTS = resolve(ROOT, 'fonts', 'switchback')

const META = FAMILY_DISPLAY['switchback']
const COPYRIGHT = `Copyright (c) 2026, NPS Fonts contributors. ${META.display} — released under the SIL Open Font License 1.1.`
const DESCRIPTION = `${META.display} — routed-trail display caps with Clean and Rough sibling cuts.`
const VERSION = 'Version 1.000'

interface Variant {
  styleName: string
  src: string
  pipelineKey: 'switchback-clean' | 'switchback-rough'
}

const VARIANTS: Variant[] = [
  { styleName: 'Regular', src: 'sources/switchback/outlines-clean.json', pipelineKey: 'switchback-clean' },
  { styleName: 'Rough',   src: 'sources/switchback/outlines-rough.json', pipelineKey: 'switchback-rough' },
]

async function buildVariant(v: Variant) {
  const data = await loadOutlines(v.src)
  PIPELINES[v.pipelineKey]!(data)
  const branding = {
    family: META.display,
    postscript: META.file,
    styleName: v.styleName,
    copyright: COPYRIGHT,
    description: DESCRIPTION,
    version: VERSION,
    weightClass: 400,
    widthClass: 5,
  }
  brandNameTable(data, branding)

  const out = await writeFamilyOutputs({
    outDir: FONTS,
    fileStem: `${META.file}-${v.styleName}`,
    ttfObject: data as unknown as Parameters<typeof writeFamilyOutputs>[0]['ttfObject'],
    branding,
  })

  return { glyphCount: (data as FontData).glyf.length, ...out }
}

export async function buildSwitchback() {
  const results = []
  for (const v of VARIANTS) {
    const r = await buildVariant(v)
    results.push({ variant: v.styleName, ...r })
    console.log(
      `✓ ${META.display} ${v.styleName}: ${r.glyphCount} glyphs · `
      + `TTF ${(r.ttf.length / 1024).toFixed(1)}KB · OTF ${(r.otf.length / 1024).toFixed(1)}KB · `
      + `WOFF2 ${(r.woff2.length / 1024).toFixed(1)}KB`,
    )
  }
  return results
}

await buildSwitchback()
