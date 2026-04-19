/**
 * Per-family glyph-list builder. Takes a DrawContext and produces the
 * full GlyphSpec[] for one master, including:
 *
 *   - Basic Latin from CHARSET
 *   - Latin-1 Supplement (composites + specials)
 *   - Ligatures (fi, fl)
 *   - Italic overrides (when ctx.italic and overrides provided)
 *   - Glyph-name de-duplication (NBSP shares the space glyph)
 */

import { CHARSET } from './common.ts'
import { EXTENDED_DRAWERS, EXTENDED_ITALIC_OVERRIDES, LIGATURES } from './extended.ts'
import { DEFAULT_DRAWERS, ITALIC_OVERRIDES, widthFor } from './letters.ts'
import type { DrawContext, GlyphDraw, GlyphSpec } from './types.ts'

export interface BuildOpts {
  /** When true, prefer ITALIC_OVERRIDES + EXTENDED_ITALIC_OVERRIDES for affected glyphs. */
  italic?: boolean
  /** Extra per-glyph drawer overrides (per-family flavor). */
  overrides?: Record<string, GlyphDraw>
  /** Glyph-name remappings (e.g. Cairn lowercase → uppercase). */
  remap?: (name: string) => string
}

export function buildGlyphs(ctx: DrawContext, opts: BuildOpts = {}): GlyphSpec[] {
  const lookup = (name: string): GlyphDraw | undefined => {
    if (opts.overrides?.[name]) return opts.overrides[name]
    if (opts.italic) {
      if (ITALIC_OVERRIDES[name]) return ITALIC_OVERRIDES[name]
      if (EXTENDED_ITALIC_OVERRIDES[name]) return EXTENDED_ITALIC_OVERRIDES[name]
    }
    if (DEFAULT_DRAWERS[name]) return DEFAULT_DRAWERS[name]
    if (EXTENDED_DRAWERS[name]) return EXTENDED_DRAWERS[name]
    return undefined
  }

  // Group CHARSET entries by glyph name → collect all unicodes per glyph.
  const byName = new Map<string, { unicodes: number[], drawer: GlyphDraw }>()
  for (const entry of CHARSET) {
    const glyphName = opts.remap ? opts.remap(entry.name) : entry.name
    const drawer = lookup(glyphName)
    if (!drawer) {
      // Skip unknown glyphs rather than failing — keeps families that
      // intentionally drop a glyph functional.
      continue
    }
    if (!byName.has(glyphName)) {
      byName.set(glyphName, { unicodes: [], drawer })
    }
    byName.get(glyphName)!.unicodes.push(entry.unicode)
  }

  const out: GlyphSpec[] = []
  for (const [name, { unicodes, drawer }] of byName) {
    out.push({
      name,
      unicode: unicodes.length === 1 ? unicodes[0]! : unicodes,
      advanceWidth: widthFor(opts.remap ? name : name, ctx),
      draw: drawer,
    })
  }

  // Ligatures (no unicode mapping — accessed via the `liga` OpenType feature).
  for (const [name, drawer] of Object.entries(LIGATURES)) {
    out.push({
      name,
      unicode: undefined,
      advanceWidth: widthFor(name === 'fi' ? 'i' : 'l', ctx) + widthFor('f', ctx),
      draw: drawer,
    })
  }

  return out
}
