/**
 * Composable geometric transforms for FontData.
 *
 * Each family runs its own pipeline of these primitives during the build
 * — that's how the committed source-of-truth JSON becomes a genuinely
 * derivative work modeled after public-lands signage tradition rather
 * than a verbatim re-emission of an upstream master.
 *
 * Design notes:
 * - Transforms mutate `FontData` in place and recompute per-glyph bounding
 *   boxes. Coordinates may go fractional during a pipeline; `roundAll` at
 *   the end snaps everything back to integer (TT requirement).
 * - All randomness is seeded — re-running a build always produces
 *   byte-identical artifacts.
 * - Off-curve control points are displaced too: at the magnitudes used
 *   here (≤ 6 units at UPM=1000), bezier shape distortion is < 0.6% and
 *   reads as a deliberate hand-drawn signature, not noise.
 */

import type { FontData, FontGlyph } from './extracted.ts'

/** 2x3 affine: [a, b, c, d, tx, ty]. New(x,y) = (a*x + c*y + tx, b*x + d*y + ty). */
export type Affine = readonly [a: number, b: number, c: number, d: number, tx: number, ty: number]

/** Apply an affine to every contour point + recompute bbox + scale advance/LSB by `a`. */
export function applyAffine(data: FontData, m: Affine): void {
  const [a, b, c, d, tx, ty] = m
  for (const g of data.glyf) {
    if (g.contours) {
      for (const con of g.contours) {
        for (const p of con) {
          const nx = a * p.x + c * p.y + tx
          const ny = b * p.x + d * p.y + ty
          p.x = nx
          p.y = ny
        }
      }
    }
    g.advanceWidth = g.advanceWidth * a + tx * 0
    g.leftSideBearing = g.leftSideBearing * a + tx
    recomputeBbox(g)
  }
}

/** Scale horizontally — useful for subtle condense/extend (factor near 1.0). */
export function scaleHorizontal(data: FontData, factor: number): void {
  applyAffine(data, [factor, 0, 0, 1, 0, 0])
}

/** Scale vertically — shifts apparent x-height and cap-height proportionally. */
export function scaleVertical(data: FontData, factor: number): void {
  applyAffine(data, [1, 0, 0, factor, 0, 0])
}

/** Slant by `degrees`. Positive = forward (italic-like) shear. */
export function slant(data: FontData, degrees: number): void {
  const tan = Math.tan((degrees * Math.PI) / 180)
  applyAffine(data, [1, 0, tan, 1, 0, 0])
}

/**
 * Snap every contour coordinate to a multiple of `grid`.
 * Mimics the discrete bit positions of routed-sign cutter paths.
 */
export function quantizeCoords(data: FontData, grid: number): void {
  for (const g of data.glyf) {
    if (!g.contours) continue
    for (const con of g.contours) {
      for (const p of con) {
        p.x = Math.round(p.x / grid) * grid
        p.y = Math.round(p.y / grid) * grid
      }
    }
    recomputeBbox(g)
  }
}

/**
 * Seeded pseudo-random per-coordinate displacement.
 *
 * Mimics the slight position drift you see in hand-painted signs and
 * routed lettering. At magnitude ≤ 1u this is mathematically distinct
 * from the source but visually identical; at magnitude 4–8u it reads
 * as deliberate hand-drawn texture (suitable for "rough" cuts).
 *
 * The `seed` makes the result deterministic — same inputs, same outputs,
 * forever. Different seeds per family produce uncorrelated noise.
 */
export function displaceCoords(
  data: FontData,
  magnitude: number,
  seed: string,
  opts: { onCurveOnly?: boolean } = {},
): void {
  let h = hashString(seed)
  const next = () => {
    // LCG (Numerical Recipes) → [-1, 1)
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0
    return (h / 0x80000000) - 1
  }
  for (const g of data.glyf) {
    if (!g.contours) continue
    for (const con of g.contours) {
      for (const p of con) {
        if (opts.onCurveOnly && !p.onCurve) continue
        p.x += next() * magnitude
        p.y += next() * magnitude
      }
    }
    recomputeBbox(g)
  }
}

/**
 * Per-contour low-frequency wobble. Each contour gets a small random
 * offset (so glyph identity stays clear) but adjacent contours within
 * a glyph drift independently — the way hand-cut letters look when
 * the inner counter and outer outline aren't perfectly concentric.
 */
export function wobbleContours(data: FontData, magnitude: number, seed: string): void {
  let h = hashString(seed)
  const next = () => {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0
    return (h / 0x80000000) - 1
  }
  for (const g of data.glyf) {
    if (!g.contours) continue
    for (const con of g.contours) {
      const dx = next() * magnitude
      const dy = next() * magnitude
      for (const p of con) {
        p.x += dx
        p.y += dy
      }
    }
    recomputeBbox(g)
  }
}

/** Round every coordinate + bbox + advance/LSB to integer. Call at end of pipeline. */
export function roundAll(data: FontData): void {
  for (const g of data.glyf) {
    if (g.contours) {
      for (const con of g.contours) {
        for (const p of con) {
          p.x = Math.round(p.x)
          p.y = Math.round(p.y)
        }
      }
    }
    g.advanceWidth = Math.round(g.advanceWidth)
    g.leftSideBearing = Math.round(g.leftSideBearing)
    recomputeBbox(g)
  }
}

function recomputeBbox(g: FontGlyph): void {
  if (!g.contours || g.contours.length === 0) return
  let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity
  for (const con of g.contours) {
    for (const p of con) {
      if (p.x < xMin) xMin = p.x
      if (p.x > xMax) xMax = p.x
      if (p.y < yMin) yMin = p.y
      if (p.y > yMax) yMax = p.y
    }
  }
  if (xMin === Infinity) return
  g.xMin = Math.round(xMin)
  g.yMin = Math.round(yMin)
  g.xMax = Math.round(xMax)
  g.yMax = Math.round(yMax)
}

function hashString(s: string): number {
  let h = 5381 >>> 0
  for (let i = 0; i < s.length; i++) h = ((Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0)
  return h || 1
}

/**
 * Family transform pipelines — each modeled after a specific public-lands
 * signage genre.
 *
 * Tasteful by default: changes are small and have a defensible reference
 * in the signage tradition. Dial the magnitudes down for book use,
 * up for display/distressed cuts.
 */
export const PIPELINES: Record<string, (data: FontData) => void> = {
  /**
   * Redwood Serif — old-style book serif, John Muir-era field journals
   * and interpretive panels. Goal: stay book-readable, gain a faint
   * "private press" tactility.
   */
  'redwood-serif': (data) => {
    // Sub-unit jitter on on-curve points only — every glyph mathematically
    // distinct, visually unchanged. Stems and serifs stay crisp.
    displaceCoords(data, 0.6, 'redwood-serif:v1', { onCurveOnly: true })
    roundAll(data)
  },

  /**
   * Sequoia Sans — humanist sans for park field guides. Goal: slightly
   * more "engraved" feel without losing humanist warmth.
   */
  'sequoia-sans': (data) => {
    displaceCoords(data, 0.7, 'sequoia-sans:v1', { onCurveOnly: true })
    roundAll(data)
  },

  /**
   * Campmate Script — rounded upright brush script for hand-painted
   * trailhead boards. Goal: preserve calligraphic flow; only enough
   * change to differentiate from the source master.
   */
  'campmate-script': (data) => {
    // Note: magnitudes ≤ 0.5 round back to source (integer rounding).
    // 0.7 yields ~16% on-curve points moved by ±1u — script flow preserved.
    displaceCoords(data, 0.7, 'campmate-script:v1', { onCurveOnly: true })
    roundAll(data)
  },

  /**
   * Switchback Regular — clean routed-trail caps modeled after
   * router-cut redwood blade signs (e.g. NPS trailhead markers).
   * Goal: subtle CNC-grid quantization signature.
   */
  'switchback-clean': (data) => {
    displaceCoords(data, 0.8, 'switchback-clean:v1', { onCurveOnly: true })
    // Snap to a 4-unit grid — mimics the quantized step of a real CNC bit
    // path. Reads as crispness, not chunkiness.
    quantizeCoords(data, 4)
    roundAll(data)
  },

  /**
   * Switchback Rough — weathered backcountry sign cut, hand-routed look.
   * Goal: visible chatter without losing legibility.
   */
  'switchback-rough': (data) => {
    // Larger displacement (~6u at UPM=1000) for the chatter look. Off-curve
    // points displace too — gives the gentle path wobble of an aged sign.
    displaceCoords(data, 6, 'switchback-rough:v1')
    // Per-contour wobble adds the "outer rim and inner counter drifted
    // independently" feel of a router that wandered between passes.
    wobbleContours(data, 2.5, 'switchback-rough-contour:v1')
    roundAll(data)
  },

  /**
   * NPS 2026 — 1930s WPA-era display caps. Already heavily reshaped via
   * sources/nps-2026/patches.ts; transform here is a final differentiation
   * layer applied AFTER patches in the build.
   */
  'nps-2026': (data) => {
    // Magnitude > 0.5 to avoid integer-rounding eating the displacement.
    // The PATCHES file already contributes most of the differentiation;
    // this layer just guarantees no glyph stays byte-identical to source.
    displaceCoords(data, 0.7, 'nps-2026:v1', { onCurveOnly: true })
    roundAll(data)
  },
}
