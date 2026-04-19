#!/usr/bin/env bun
/**
 * Campmate Script — rounded upright script with brush-style ligatures.
 *
 * Outlines live in `sources/campmate-script/outlines.json`. The source
 * carries 19 designer ligature glyphs (named `xy.liga`, `xyz.liga`) but
 * the extractor doesn't preserve GSUB. We rebuild the `liga` GSUB feature
 * in opentype.js by parsing each ligature glyph name back into its
 * component letters.
 */
import { resolve } from 'node:path'
import opentype from 'opentype.js'
import {
  brandNameTable,
  loadOutlines,
  writeFamilyOutputs,
  type FontData,
} from './lib/extracted.ts'
import { PIPELINES } from './lib/transforms.ts'
import { FAMILY_DISPLAY } from './lib/common.ts'

const ROOT = resolve(import.meta.dir, '..')
const FONTS = resolve(ROOT, 'fonts', 'campmate-script')

const META = FAMILY_DISPLAY['campmate-script']
const COPYRIGHT = `Copyright (c) 2026, NPS Fonts contributors. ${META.display} — released under the SIL Open Font License 1.1.`
const DESCRIPTION = `${META.display} — rounded upright script with brush ligatures via OpenType liga GSUB.`
const VERSION = 'Version 1.000'

interface SubstitutionAdd {
  add: (feature: string, entry: { sub: number[], by: number }) => void
}

/** Reconstruct GSUB `liga` rules from glyph naming convention `<chars>.liga`. */
function addLigatureRules(font: opentype.Font, src: opentype.Font): number {
  // Build name → glyph index lookup
  const idxByName = new Map<string, number>()
  for (let i = 0; i < font.glyphs.length; i++) {
    const g = font.glyphs.get(i)
    if (g.name) idxByName.set(g.name, i)
  }

  // Look up letters via the SOURCE font's cmap (the rebuilt font's cmap
  // is generated lazily at toArrayBuffer time, so font.charToGlyph would
  // return notdef here). Indices are preserved 1:1 by buildOtfFromTtfBuf,
  // so the source's index is also valid in the rebuilt font.
  const letterIdx = (ch: string): number | undefined => {
    const g = src.charToGlyph(ch)
    if (!g || g.index === 0) return undefined
    return g.index
  }

  const sub = font.substitution as unknown as SubstitutionAdd
  let added = 0
  for (let i = 0; i < src.glyphs.length; i++) {
    const g = src.glyphs.get(i)
    const m = g.name?.match(/^([a-z]+)\.liga$/)
    if (!m) continue
    const chars = m[1]!
    const ligIdx = idxByName.get(g.name!)
    if (ligIdx == null || ligIdx === 0) continue
    const subIndices: number[] = []
    let valid = true
    for (const ch of chars) {
      const idx = letterIdx(ch)
      if (idx == null) { valid = false; break }
      subIndices.push(idx)
    }
    if (!valid) continue
    sub.add('liga', { sub: subIndices, by: ligIdx })
    added++
  }
  return added
}

export async function buildCampmateScript() {
  const data = await loadOutlines('sources/campmate-script/outlines.json')
  PIPELINES['campmate-script']!(data)

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
  brandNameTable(data, branding)

  let ligaCount = 0
  const out = await writeFamilyOutputs({
    outDir: FONTS,
    fileStem: `${META.file}-Regular`,
    ttfObject: data as unknown as Parameters<typeof writeFamilyOutputs>[0]['ttfObject'],
    branding,
    woffFromOtf: true,
    configureOtf: (font, src) => { ligaCount = addLigatureRules(font, src) },
  })

  return { glyphCount: (data as FontData).glyf.length, ligaCount, ...out }
}

const r = await buildCampmateScript()
console.log(
  `✓ ${META.display}: ${r.glyphCount} glyphs (${r.ligaCount} ligatures) · `
  + `TTF ${(r.ttf.length / 1024).toFixed(1)}KB · OTF ${(r.otf.length / 1024).toFixed(1)}KB · `
  + `WOFF2 ${(r.woff2.length / 1024).toFixed(1)}KB`,
)
