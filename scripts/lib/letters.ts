/**
 * Parametric letter library. One drawer per glyph, configured via the
 * DrawContext passed in. The same drawers are used by all five families;
 * the per-family scripts only override individual glyphs when they need
 * a different shape (e.g. script forms, all-caps shortcuts).
 *
 * Geometry conventions
 * --------------------
 * Origin: glyph baseline at y=0, advance starts at x=0.
 * The drawer uses the cap_height, x_height, stroke from ctx.
 * It does NOT set advanceWidth — that's set by the caller in the GlyphSpec.
 */

import type { Path } from 'opentype.js'
import { CAP_HEIGHT, X_HEIGHT } from './common.ts'
import {
  arc,
  ellipse,
  KAPPA,
  polygon,
  rect,
  roundRect,
  slab,
  strokeH,
  strokeLine,
  strokeV,
} from './primitives.ts'
import type { DrawContext, GlyphDraw } from './types.ts'

// Default per-master geometry. Per-family can override via ctx.
function geom(ctx: DrawContext) {
  const stroke = ctx.stroke
  const cap = (ctx.capHeight as number | undefined) ?? CAP_HEIGHT
  const xh = (ctx.xHeight as number | undefined) ?? X_HEIGHT
  const ascender = (ctx.ascenderHeight as number | undefined) ?? cap + 100
  const descender = (ctx.descenderDepth as number | undefined) ?? -200
  const condense = (ctx.condense as number | undefined) ?? 1
  const serifLen = (ctx.serifLen as number | undefined) ?? 0
  const serifThickness = (ctx.serifThickness as number | undefined) ?? Math.max(stroke * 0.6, 30)
  const sidebearing = (ctx.sidebearing as number | undefined) ?? 60
  const slant = (ctx.slant as number | undefined) ?? 0 // radians
  return { stroke, cap, xh, ascender, descender, condense, serifLen, serifThickness, sidebearing, slant }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function topSerif(p: Path, x: number, y: number, ctx: DrawContext): void {
  const g = geom(ctx)
  if (g.serifLen <= 0) return
  rect(p, x - g.serifLen / 2, y - g.serifThickness, g.serifLen, g.serifThickness)
}
function bottomSerif(p: Path, x: number, y: number, ctx: DrawContext): void {
  const g = geom(ctx)
  if (g.serifLen <= 0) return
  rect(p, x - g.serifLen / 2, y, g.serifLen, g.serifThickness)
}

/** Standard advance width helpers — used by the per-family spec to size each glyph. */
export function advance(width: number, ctx: DrawContext): number {
  const g = geom(ctx)
  return Math.round(width * g.condense + g.sidebearing * 2)
}

// Width returned to the caller when registering a glyph; depends only on geom params.
export function widthFor(name: string, ctx: DrawContext): number {
  const g = geom(ctx)
  const w = baseWidth(name, ctx) * g.condense
  return Math.round(w + g.sidebearing * 2)
}

// Base width per-glyph (without sidebearings or condense) used both for sizing
// and as input to the drawers (so the visible shape sits inside [0, baseWidth]).
function baseWidth(name: string, ctx: DrawContext): number {
  const g = geom(ctx)
  const s = g.stroke
  // Defaults derived from cap_height to keep proportions consistent.
  const wide = g.cap * 0.95
  const med = g.cap * 0.78
  const narrow = g.cap * 0.55
  const veryNarrow = g.cap * 0.32
  // Lookup with sensible defaults.
  const map: Record<string, number> = {
    // uppercase
    A: med, B: med, C: med, D: med, E: narrow + s, F: narrow + s,
    G: med, H: med, I: s + 80, J: narrow + s, K: med, L: narrow + s,
    M: wide, N: med, O: wide * 0.92, P: med, Q: wide * 0.92, R: med,
    S: med, T: med, U: med, V: med, W: wide, X: med, Y: med, Z: med,
    // lowercase
    a: med * 0.85, b: med * 0.8, c: med * 0.8, d: med * 0.8, e: med * 0.8,
    f: narrow, g: med * 0.8, h: med * 0.8, i: s + 40, j: narrow,
    k: med * 0.8, l: s + 40, m: wide * 0.95, n: med * 0.8, o: med * 0.85,
    p: med * 0.8, q: med * 0.8, r: narrow + s, s: med * 0.7, t: narrow,
    u: med * 0.8, v: med * 0.85, w: wide * 0.95, x: med * 0.85, y: med * 0.85,
    z: med * 0.7,
    // digits
    zero: med, one: narrow, two: med, three: med, four: med, five: med,
    six: med, seven: med, eight: med, nine: med,
    // punctuation
    space: g.cap * 0.5,
    exclam: s + 30, period: s + 20, comma: s + 30, colon: s + 20, semicolon: s + 30,
    hyphen: med * 0.5, underscore: med * 0.7, slash: med * 0.5, backslash: med * 0.5,
    parenleft: narrow * 0.6, parenright: narrow * 0.6,
    bracketleft: narrow * 0.5, bracketright: narrow * 0.5,
    braceleft: narrow * 0.6, braceright: narrow * 0.6,
    quotesingle: s + 20, quotedbl: s * 2 + 60,
    numbersign: med, dollar: med, percent: wide * 0.95, ampersand: wide * 0.9,
    asterisk: med * 0.7, plus: med * 0.7, equal: med * 0.7,
    less: med * 0.6, greater: med * 0.6, question: med * 0.7,
    at: wide, asciicircum: med * 0.6, grave: narrow * 0.5,
    bar: s + 40, asciitilde: med * 0.7,
  }
  return map[name] ?? med
}

// ---------------------------------------------------------------------------
// Uppercase letters
// ---------------------------------------------------------------------------

const uppers: Record<string, GlyphDraw> = {
  A: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('A', ctx)
    const x0 = g.sidebearing
    const apex = x0 + w / 2
    const left = x0
    const right = x0 + w
    const bar = g.cap * 0.42
    strokeLine(p, left, 0, apex, g.cap, g.stroke)
    strokeLine(p, apex, g.cap, right, 0, g.stroke)
    // crossbar
    const bx1 = left + (apex - left) * (bar / g.cap)
    const bx2 = right - (right - apex) * (bar / g.cap)
    strokeH(p, bx1 - g.stroke / 4, bar, bx2 - bx1 + g.stroke / 2, g.stroke * 0.7)
    bottomSerif(p, left + g.stroke / 2, 0, ctx)
    bottomSerif(p, right - g.stroke / 2, 0, ctx)
  },
  B: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('B', ctx)
    const x0 = g.sidebearing
    const stem = x0
    const right = x0 + w
    strokeV(p, stem + g.stroke / 2, 0, g.cap, g.stroke)
    // top bowl
    const midY = g.cap / 2 - g.stroke / 4
    arc(p, stem + g.stroke / 2, (g.cap + midY) / 2, (right - stem) - g.stroke, (g.cap - midY) / 2, g.stroke, 'right')
    // bottom bowl
    arc(p, stem + g.stroke / 2, midY / 2, (right - stem) - g.stroke * 0.8, midY / 2, g.stroke, 'right')
    // small caps to close
    strokeH(p, stem, g.cap - g.stroke / 2, (right - stem) - g.stroke * 0.5, g.stroke)
    strokeH(p, stem, g.stroke / 2, (right - stem) - g.stroke * 0.4, g.stroke)
    strokeH(p, stem, midY, (right - stem) - g.stroke * 0.6, g.stroke * 0.85)
    topSerif(p, stem + g.stroke / 2, g.cap, ctx)
    bottomSerif(p, stem + g.stroke / 2, 0, ctx)
  },
  C: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('C', ctx)
    const x0 = g.sidebearing
    const cx = x0 + w / 2
    const cy = g.cap / 2
    const rx = w / 2
    const ry = g.cap / 2
    // outer
    ellipse(p, cx, cy, rx, ry)
    ellipse(p, cx, cy, rx - g.stroke, ry - g.stroke, { hole: true })
    // open the right side: cover with a rectangle (not a true approach but visually OK)
    rect(p, cx + rx * 0.35, cy - ry * 0.45, rx, ry * 0.9)
  },
  D: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('D', ctx)
    const x0 = g.sidebearing
    const stem = x0
    const right = x0 + w
    strokeV(p, stem + g.stroke / 2, 0, g.cap, g.stroke)
    // semicircle outline
    arc(p, stem + g.stroke / 2, g.cap / 2, (right - stem) - g.stroke, g.cap / 2, g.stroke, 'right')
    strokeH(p, stem, g.cap - g.stroke / 2, (right - stem) - g.stroke * 0.5, g.stroke)
    strokeH(p, stem, g.stroke / 2, (right - stem) - g.stroke * 0.5, g.stroke)
    topSerif(p, stem + g.stroke / 2, g.cap, ctx)
    bottomSerif(p, stem + g.stroke / 2, 0, ctx)
  },
  E: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('E', ctx)
    const x0 = g.sidebearing
    const stem = x0 + g.stroke / 2
    strokeV(p, stem, 0, g.cap, g.stroke)
    strokeH(p, x0, g.cap - g.stroke / 2, w, g.stroke)
    strokeH(p, x0, g.cap / 2, w * 0.85, g.stroke * 0.85)
    strokeH(p, x0, g.stroke / 2, w, g.stroke)
    topSerif(p, stem, g.cap, ctx)
    bottomSerif(p, stem, 0, ctx)
  },
  F: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('F', ctx)
    const x0 = g.sidebearing
    const stem = x0 + g.stroke / 2
    strokeV(p, stem, 0, g.cap, g.stroke)
    strokeH(p, x0, g.cap - g.stroke / 2, w, g.stroke)
    strokeH(p, x0, g.cap / 2, w * 0.8, g.stroke * 0.85)
    topSerif(p, stem, g.cap, ctx)
    bottomSerif(p, stem, 0, ctx)
  },
  G: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('G', ctx)
    const x0 = g.sidebearing
    const cx = x0 + w / 2
    const cy = g.cap / 2
    const rx = w / 2
    const ry = g.cap / 2
    ellipse(p, cx, cy, rx, ry)
    ellipse(p, cx, cy, rx - g.stroke, ry - g.stroke, { hole: true })
    // open right
    rect(p, cx + rx * 0.4, cy - ry * 0.35, rx, ry * 0.4)
    // crossbar
    strokeH(p, cx + rx * 0.15, cy * 0.7, rx * 0.55, g.stroke)
    strokeV(p, x0 + w - g.stroke / 2, 0, cy * 0.75, g.stroke)
  },
  H: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('H', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + g.stroke / 2, 0, g.cap, g.stroke)
    strokeV(p, x0 + w - g.stroke / 2, 0, g.cap, g.stroke)
    strokeH(p, x0, g.cap / 2, w, g.stroke * 0.9)
    topSerif(p, x0 + g.stroke / 2, g.cap, ctx)
    topSerif(p, x0 + w - g.stroke / 2, g.cap, ctx)
    bottomSerif(p, x0 + g.stroke / 2, 0, ctx)
    bottomSerif(p, x0 + w - g.stroke / 2, 0, ctx)
  },
  I: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('I', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + w / 2, 0, g.cap, g.stroke)
    if (g.serifLen > 0) {
      topSerif(p, x0 + w / 2, g.cap, ctx)
      bottomSerif(p, x0 + w / 2, 0, ctx)
    }
  },
  J: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('J', ctx)
    const x0 = g.sidebearing
    const stem = x0 + w - g.stroke / 2
    strokeV(p, stem, g.cap * 0.2, g.cap * 0.8, g.stroke)
    // hook
    arc(p, stem - w * 0.4, g.cap * 0.2, w * 0.4, g.cap * 0.2, g.stroke, 'bottom')
    strokeH(p, x0, g.cap * 0.2 - g.stroke / 2, w * 0.55, g.stroke)
    topSerif(p, stem, g.cap, ctx)
  },
  K: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('K', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + g.stroke / 2, 0, g.cap, g.stroke)
    const j = g.cap * 0.45
    strokeLine(p, x0 + g.stroke, j, x0 + w, g.cap, g.stroke)
    strokeLine(p, x0 + g.stroke, j, x0 + w, 0, g.stroke)
    topSerif(p, x0 + g.stroke / 2, g.cap, ctx)
    bottomSerif(p, x0 + g.stroke / 2, 0, ctx)
  },
  L: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('L', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + g.stroke / 2, 0, g.cap, g.stroke)
    strokeH(p, x0, g.stroke / 2, w, g.stroke)
    topSerif(p, x0 + g.stroke / 2, g.cap, ctx)
  },
  M: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('M', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + g.stroke / 2, 0, g.cap, g.stroke)
    strokeV(p, x0 + w - g.stroke / 2, 0, g.cap, g.stroke)
    strokeLine(p, x0 + g.stroke, g.cap, x0 + w / 2, g.cap * 0.2, g.stroke)
    strokeLine(p, x0 + w / 2, g.cap * 0.2, x0 + w - g.stroke, g.cap, g.stroke)
    bottomSerif(p, x0 + g.stroke / 2, 0, ctx)
    bottomSerif(p, x0 + w - g.stroke / 2, 0, ctx)
  },
  N: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('N', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + g.stroke / 2, 0, g.cap, g.stroke)
    strokeV(p, x0 + w - g.stroke / 2, 0, g.cap, g.stroke)
    strokeLine(p, x0 + g.stroke, g.cap, x0 + w - g.stroke, 0, g.stroke)
    bottomSerif(p, x0 + g.stroke / 2, 0, ctx)
    topSerif(p, x0 + w - g.stroke / 2, g.cap, ctx)
  },
  O: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('O', ctx)
    const x0 = g.sidebearing
    const cx = x0 + w / 2
    const cy = g.cap / 2
    ellipse(p, cx, cy, w / 2, g.cap / 2)
    ellipse(p, cx, cy, w / 2 - g.stroke, g.cap / 2 - g.stroke, { hole: true })
  },
  P: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('P', ctx)
    const x0 = g.sidebearing
    const stem = x0 + g.stroke / 2
    strokeV(p, stem, 0, g.cap, g.stroke)
    const midY = g.cap * 0.55
    arc(p, stem, (g.cap + midY) / 2, w - g.stroke, (g.cap - midY) / 2, g.stroke, 'right')
    strokeH(p, x0, g.cap - g.stroke / 2, w - g.stroke * 0.4, g.stroke)
    strokeH(p, x0, midY, w - g.stroke * 0.6, g.stroke * 0.9)
    topSerif(p, stem, g.cap, ctx)
    bottomSerif(p, stem, 0, ctx)
  },
  Q: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('Q', ctx)
    const x0 = g.sidebearing
    const cx = x0 + w / 2
    const cy = g.cap / 2
    ellipse(p, cx, cy, w / 2, g.cap / 2)
    ellipse(p, cx, cy, w / 2 - g.stroke, g.cap / 2 - g.stroke, { hole: true })
    strokeLine(p, cx + w * 0.1, g.cap * 0.2, cx + w * 0.42, -g.cap * 0.05, g.stroke)
  },
  R: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('R', ctx)
    const x0 = g.sidebearing
    const stem = x0 + g.stroke / 2
    strokeV(p, stem, 0, g.cap, g.stroke)
    const midY = g.cap * 0.55
    arc(p, stem, (g.cap + midY) / 2, w - g.stroke, (g.cap - midY) / 2, g.stroke, 'right')
    strokeH(p, x0, g.cap - g.stroke / 2, w - g.stroke * 0.4, g.stroke)
    strokeH(p, x0, midY, w - g.stroke * 0.6, g.stroke * 0.9)
    // leg
    strokeLine(p, stem + w * 0.45, midY, x0 + w, 0, g.stroke)
    topSerif(p, stem, g.cap, ctx)
    bottomSerif(p, stem, 0, ctx)
    bottomSerif(p, x0 + w - g.stroke / 2, 0, ctx)
  },
  S: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('S', ctx)
    const x0 = g.sidebearing
    const cx = x0 + w / 2
    const ry = g.cap * 0.27
    // top semicircle
    arc(p, cx, g.cap - ry, w / 2, ry, g.stroke, 'top')
    arc(p, cx, g.cap - ry, w / 2, ry, g.stroke, 'left')
    // bottom semicircle
    arc(p, cx, ry, w / 2, ry, g.stroke, 'bottom')
    arc(p, cx, ry, w / 2, ry, g.stroke, 'right')
    // middle bar
    strokeH(p, x0 + g.stroke * 0.3, g.cap / 2, w - g.stroke * 0.6, g.stroke * 0.9)
  },
  T: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('T', ctx)
    const x0 = g.sidebearing
    strokeH(p, x0, g.cap - g.stroke / 2, w, g.stroke)
    strokeV(p, x0 + w / 2, 0, g.cap, g.stroke)
    bottomSerif(p, x0 + w / 2, 0, ctx)
  },
  U: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('U', ctx)
    const x0 = g.sidebearing
    const cx = x0 + w / 2
    const ry = g.cap * 0.25
    strokeV(p, x0 + g.stroke / 2, ry, g.cap - ry, g.stroke)
    strokeV(p, x0 + w - g.stroke / 2, ry, g.cap - ry, g.stroke)
    arc(p, cx, ry, w / 2, ry, g.stroke, 'bottom')
    topSerif(p, x0 + g.stroke / 2, g.cap, ctx)
    topSerif(p, x0 + w - g.stroke / 2, g.cap, ctx)
  },
  V: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('V', ctx)
    const x0 = g.sidebearing
    strokeLine(p, x0, g.cap, x0 + w / 2, 0, g.stroke)
    strokeLine(p, x0 + w / 2, 0, x0 + w, g.cap, g.stroke)
    topSerif(p, x0, g.cap, ctx)
    topSerif(p, x0 + w, g.cap, ctx)
  },
  W: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('W', ctx)
    const x0 = g.sidebearing
    const a = w / 4
    strokeLine(p, x0, g.cap, x0 + a, 0, g.stroke)
    strokeLine(p, x0 + a, 0, x0 + a * 2, g.cap * 0.7, g.stroke)
    strokeLine(p, x0 + a * 2, g.cap * 0.7, x0 + a * 3, 0, g.stroke)
    strokeLine(p, x0 + a * 3, 0, x0 + w, g.cap, g.stroke)
    topSerif(p, x0, g.cap, ctx)
    topSerif(p, x0 + w, g.cap, ctx)
  },
  X: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('X', ctx)
    const x0 = g.sidebearing
    strokeLine(p, x0, 0, x0 + w, g.cap, g.stroke)
    strokeLine(p, x0, g.cap, x0 + w, 0, g.stroke)
  },
  Y: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('Y', ctx)
    const x0 = g.sidebearing
    const midY = g.cap * 0.45
    strokeLine(p, x0, g.cap, x0 + w / 2, midY, g.stroke)
    strokeLine(p, x0 + w / 2, midY, x0 + w, g.cap, g.stroke)
    strokeV(p, x0 + w / 2, 0, midY, g.stroke)
    bottomSerif(p, x0 + w / 2, 0, ctx)
  },
  Z: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('Z', ctx)
    const x0 = g.sidebearing
    strokeH(p, x0, g.cap - g.stroke / 2, w, g.stroke)
    strokeH(p, x0, g.stroke / 2, w, g.stroke)
    strokeLine(p, x0 + w, g.cap - g.stroke, x0, g.stroke, g.stroke)
  },
}

// ---------------------------------------------------------------------------
// Lowercase letters (single-storey defaults — placeholder shapes)
// ---------------------------------------------------------------------------

const lowers: Record<string, GlyphDraw> = {
  a: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('a', ctx)
    const x0 = g.sidebearing
    const cx = x0 + w / 2
    ellipse(p, cx, g.xh / 2, w / 2, g.xh / 2)
    ellipse(p, cx, g.xh / 2, w / 2 - g.stroke, g.xh / 2 - g.stroke, { hole: true })
    strokeV(p, x0 + w - g.stroke / 2, 0, g.xh, g.stroke)
  },
  b: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('b', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + g.stroke / 2, 0, g.ascender, g.stroke)
    const cx = x0 + g.stroke / 2 + (w - g.stroke) / 2
    ellipse(p, cx, g.xh / 2, (w - g.stroke / 2) / 2, g.xh / 2)
    ellipse(p, cx, g.xh / 2, (w - g.stroke / 2) / 2 - g.stroke, g.xh / 2 - g.stroke, { hole: true })
  },
  c: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('c', ctx)
    const x0 = g.sidebearing
    const cx = x0 + w / 2
    ellipse(p, cx, g.xh / 2, w / 2, g.xh / 2)
    ellipse(p, cx, g.xh / 2, w / 2 - g.stroke, g.xh / 2 - g.stroke, { hole: true })
    rect(p, cx + w * 0.2, g.xh / 2 - g.xh * 0.3, w / 2, g.xh * 0.6)
  },
  d: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('d', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + w - g.stroke / 2, 0, g.ascender, g.stroke)
    const cx = x0 + (w - g.stroke / 2) / 2
    ellipse(p, cx, g.xh / 2, (w - g.stroke / 2) / 2, g.xh / 2)
    ellipse(p, cx, g.xh / 2, (w - g.stroke / 2) / 2 - g.stroke, g.xh / 2 - g.stroke, { hole: true })
  },
  e: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('e', ctx)
    const x0 = g.sidebearing
    const cx = x0 + w / 2
    ellipse(p, cx, g.xh / 2, w / 2, g.xh / 2)
    ellipse(p, cx, g.xh / 2, w / 2 - g.stroke, g.xh / 2 - g.stroke, { hole: true })
    strokeH(p, x0 + g.stroke * 0.4, g.xh / 2, w - g.stroke * 0.8, g.stroke * 0.85)
    rect(p, cx + w * 0.1, g.xh / 2 - g.xh * 0.35, w / 2, g.xh * 0.25)
  },
  f: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('f', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + w / 2, 0, g.ascender, g.stroke)
    arc(p, x0 + w / 2 + w * 0.4, g.ascender - w * 0.4, w * 0.4, w * 0.4, g.stroke, 'top')
    arc(p, x0 + w / 2 + w * 0.4, g.ascender - w * 0.4, w * 0.4, w * 0.4, g.stroke, 'right')
    strokeH(p, x0, g.xh, w, g.stroke * 0.85)
  },
  g: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('g', ctx)
    const x0 = g.sidebearing
    const cx = x0 + w / 2
    ellipse(p, cx, g.xh / 2, w / 2, g.xh / 2)
    ellipse(p, cx, g.xh / 2, w / 2 - g.stroke, g.xh / 2 - g.stroke, { hole: true })
    strokeV(p, x0 + w - g.stroke / 2, g.descender + g.stroke, g.xh - g.descender - g.stroke, g.stroke)
    strokeH(p, x0 + g.stroke, g.descender + g.stroke / 2, w - g.stroke * 1.2, g.stroke)
  },
  h: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('h', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + g.stroke / 2, 0, g.ascender, g.stroke)
    arc(p, x0 + w / 2, g.xh - (g.xh / 3), (w - g.stroke) / 2, g.xh / 3, g.stroke, 'top')
    strokeV(p, x0 + w - g.stroke / 2, 0, g.xh - g.xh / 3, g.stroke)
  },
  i: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('i', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + w / 2, 0, g.xh, g.stroke)
    rect(p, x0 + w / 2 - g.stroke / 2, g.xh + g.stroke, g.stroke, g.stroke)
  },
  j: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('j', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + w * 0.6, g.descender + w * 0.25, g.xh - g.descender - w * 0.25, g.stroke)
    arc(p, x0 + w * 0.25, g.descender + w * 0.25, w * 0.35, w * 0.25, g.stroke, 'bottom')
    rect(p, x0 + w * 0.6 - g.stroke / 2, g.xh + g.stroke, g.stroke, g.stroke)
  },
  k: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('k', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + g.stroke / 2, 0, g.ascender, g.stroke)
    const j = g.xh * 0.45
    strokeLine(p, x0 + g.stroke, j, x0 + w, g.xh, g.stroke)
    strokeLine(p, x0 + g.stroke, j, x0 + w, 0, g.stroke)
  },
  l: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('l', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + w / 2, 0, g.ascender, g.stroke)
  },
  m: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('m', ctx)
    const x0 = g.sidebearing
    const a = w / 2
    strokeV(p, x0 + g.stroke / 2, 0, g.xh, g.stroke)
    arc(p, x0 + a / 2 + g.stroke / 2, g.xh - g.xh / 3, (a - g.stroke) / 2, g.xh / 3, g.stroke, 'top')
    strokeV(p, x0 + a, 0, g.xh - g.xh / 3, g.stroke)
    arc(p, x0 + a + a / 2, g.xh - g.xh / 3, (a - g.stroke) / 2, g.xh / 3, g.stroke, 'top')
    strokeV(p, x0 + w - g.stroke / 2, 0, g.xh - g.xh / 3, g.stroke)
  },
  n: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('n', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + g.stroke / 2, 0, g.xh, g.stroke)
    arc(p, x0 + w / 2, g.xh - (g.xh / 3), (w - g.stroke) / 2, g.xh / 3, g.stroke, 'top')
    strokeV(p, x0 + w - g.stroke / 2, 0, g.xh - g.xh / 3, g.stroke)
  },
  o: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('o', ctx)
    const x0 = g.sidebearing
    const cx = x0 + w / 2
    ellipse(p, cx, g.xh / 2, w / 2, g.xh / 2)
    ellipse(p, cx, g.xh / 2, w / 2 - g.stroke, g.xh / 2 - g.stroke, { hole: true })
  },
  p: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('p', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + g.stroke / 2, g.descender, g.xh - g.descender, g.stroke)
    const cx = x0 + g.stroke / 2 + (w - g.stroke) / 2
    ellipse(p, cx, g.xh / 2, (w - g.stroke / 2) / 2, g.xh / 2)
    ellipse(p, cx, g.xh / 2, (w - g.stroke / 2) / 2 - g.stroke, g.xh / 2 - g.stroke, { hole: true })
  },
  q: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('q', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + w - g.stroke / 2, g.descender, g.xh - g.descender, g.stroke)
    const cx = x0 + (w - g.stroke / 2) / 2
    ellipse(p, cx, g.xh / 2, (w - g.stroke / 2) / 2, g.xh / 2)
    ellipse(p, cx, g.xh / 2, (w - g.stroke / 2) / 2 - g.stroke, g.xh / 2 - g.stroke, { hole: true })
  },
  r: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('r', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + g.stroke / 2, 0, g.xh, g.stroke)
    arc(p, x0 + w * 0.6, g.xh - g.xh / 3.5, w * 0.35, g.xh / 3.5, g.stroke, 'top')
    arc(p, x0 + w * 0.6, g.xh - g.xh / 3.5, w * 0.35, g.xh / 3.5, g.stroke, 'right')
  },
  s: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('s', ctx)
    const x0 = g.sidebearing
    const cx = x0 + w / 2
    const ry = g.xh * 0.27
    arc(p, cx, g.xh - ry, w / 2, ry, g.stroke, 'top')
    arc(p, cx, g.xh - ry, w / 2, ry, g.stroke, 'left')
    arc(p, cx, ry, w / 2, ry, g.stroke, 'bottom')
    arc(p, cx, ry, w / 2, ry, g.stroke, 'right')
    strokeH(p, x0 + g.stroke * 0.3, g.xh / 2, w - g.stroke * 0.6, g.stroke * 0.85)
  },
  t: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('t', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + w * 0.4, 0, g.cap * 0.9, g.stroke)
    strokeH(p, x0, g.xh, w, g.stroke * 0.85)
  },
  u: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('u', ctx)
    const x0 = g.sidebearing
    const ry = g.xh * 0.3
    strokeV(p, x0 + g.stroke / 2, ry, g.xh - ry, g.stroke)
    strokeV(p, x0 + w - g.stroke / 2, 0, g.xh, g.stroke)
    arc(p, x0 + w / 2, ry, w / 2, ry, g.stroke, 'bottom')
  },
  v: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('v', ctx)
    const x0 = g.sidebearing
    strokeLine(p, x0, g.xh, x0 + w / 2, 0, g.stroke)
    strokeLine(p, x0 + w / 2, 0, x0 + w, g.xh, g.stroke)
  },
  w: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('w', ctx)
    const x0 = g.sidebearing
    const a = w / 4
    strokeLine(p, x0, g.xh, x0 + a, 0, g.stroke)
    strokeLine(p, x0 + a, 0, x0 + a * 2, g.xh * 0.7, g.stroke)
    strokeLine(p, x0 + a * 2, g.xh * 0.7, x0 + a * 3, 0, g.stroke)
    strokeLine(p, x0 + a * 3, 0, x0 + w, g.xh, g.stroke)
  },
  x: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('x', ctx)
    const x0 = g.sidebearing
    strokeLine(p, x0, 0, x0 + w, g.xh, g.stroke)
    strokeLine(p, x0, g.xh, x0 + w, 0, g.stroke)
  },
  y: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('y', ctx)
    const x0 = g.sidebearing
    strokeLine(p, x0, g.xh, x0 + w * 0.55, 0, g.stroke)
    strokeLine(p, x0 + w, g.xh, x0 + w * 0.2, g.descender, g.stroke)
  },
  z: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('z', ctx)
    const x0 = g.sidebearing
    strokeH(p, x0, g.xh - g.stroke / 2, w, g.stroke)
    strokeH(p, x0, g.stroke / 2, w, g.stroke)
    strokeLine(p, x0 + w, g.xh - g.stroke, x0, g.stroke, g.stroke)
  },
}

// ---------------------------------------------------------------------------
// Digits
// ---------------------------------------------------------------------------

const digits: Record<string, GlyphDraw> = {
  zero: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('zero', ctx)
    const x0 = g.sidebearing
    const cx = x0 + w / 2
    ellipse(p, cx, g.cap / 2, w / 2, g.cap / 2)
    ellipse(p, cx, g.cap / 2, w / 2 - g.stroke, g.cap / 2 - g.stroke, { hole: true })
    strokeLine(p, cx + w * 0.18, g.cap * 0.8, cx - w * 0.18, g.cap * 0.2, g.stroke * 0.5)
  },
  one: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('one', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + w / 2, 0, g.cap, g.stroke)
    strokeLine(p, x0, g.cap * 0.8, x0 + w / 2, g.cap, g.stroke * 0.85)
    strokeH(p, x0, g.stroke / 2, w, g.stroke)
  },
  two: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('two', ctx)
    const x0 = g.sidebearing
    const ry = g.cap * 0.3
    arc(p, x0 + w / 2, g.cap - ry, w / 2, ry, g.stroke, 'top')
    arc(p, x0 + w / 2, g.cap - ry, w / 2, ry, g.stroke, 'right')
    strokeLine(p, x0 + w, g.cap * 0.6, x0, g.stroke, g.stroke)
    strokeH(p, x0, g.stroke / 2, w, g.stroke)
  },
  three: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('three', ctx)
    const x0 = g.sidebearing
    const ry = g.cap * 0.25
    arc(p, x0 + w / 2, g.cap - ry, w / 2, ry, g.stroke, 'top')
    arc(p, x0 + w / 2, g.cap - ry, w / 2, ry, g.stroke, 'right')
    arc(p, x0 + w / 2, ry, w / 2, ry, g.stroke, 'bottom')
    arc(p, x0 + w / 2, ry, w / 2, ry, g.stroke, 'right')
    strokeH(p, x0 + w * 0.2, g.cap / 2, w * 0.6, g.stroke * 0.85)
  },
  four: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('four', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + w * 0.7, 0, g.cap, g.stroke)
    strokeLine(p, x0 + w * 0.7, g.cap, x0, g.cap * 0.35, g.stroke)
    strokeH(p, x0, g.cap * 0.35, w, g.stroke)
  },
  five: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('five', ctx)
    const x0 = g.sidebearing
    strokeH(p, x0, g.cap - g.stroke / 2, w, g.stroke)
    strokeV(p, x0 + g.stroke / 2, g.cap * 0.5, g.cap * 0.5, g.stroke)
    const ry = g.cap * 0.27
    arc(p, x0 + w / 2, ry, w / 2, ry, g.stroke, 'bottom')
    arc(p, x0 + w / 2, ry, w / 2, ry, g.stroke, 'right')
    strokeH(p, x0 + g.stroke / 2, g.cap * 0.5, w * 0.55, g.stroke)
  },
  six: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('six', ctx)
    const x0 = g.sidebearing
    const cx = x0 + w / 2
    const ry = g.cap * 0.27
    ellipse(p, cx, ry, w / 2, ry)
    ellipse(p, cx, ry, w / 2 - g.stroke, ry - g.stroke, { hole: true })
    arc(p, cx, g.cap - ry, w / 2, ry, g.stroke, 'top')
    arc(p, cx, g.cap - ry, w / 2, ry, g.stroke, 'left')
    strokeV(p, x0 + g.stroke / 2, ry, g.cap - ry * 2, g.stroke)
  },
  seven: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('seven', ctx)
    const x0 = g.sidebearing
    strokeH(p, x0, g.cap - g.stroke / 2, w, g.stroke)
    strokeLine(p, x0 + w, g.cap, x0 + w * 0.25, 0, g.stroke)
  },
  eight: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('eight', ctx)
    const x0 = g.sidebearing
    const cx = x0 + w / 2
    const ryT = g.cap * 0.23
    const ryB = g.cap * 0.27
    ellipse(p, cx, g.cap - ryT, w / 2 * 0.85, ryT)
    ellipse(p, cx, g.cap - ryT, w / 2 * 0.85 - g.stroke, ryT - g.stroke, { hole: true })
    ellipse(p, cx, ryB, w / 2, ryB)
    ellipse(p, cx, ryB, w / 2 - g.stroke, ryB - g.stroke, { hole: true })
  },
  nine: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('nine', ctx)
    const x0 = g.sidebearing
    const cx = x0 + w / 2
    const ry = g.cap * 0.27
    ellipse(p, cx, g.cap - ry, w / 2, ry)
    ellipse(p, cx, g.cap - ry, w / 2 - g.stroke, ry - g.stroke, { hole: true })
    arc(p, cx, ry, w / 2, ry, g.stroke, 'bottom')
    arc(p, cx, ry, w / 2, ry, g.stroke, 'right')
    strokeV(p, x0 + w - g.stroke / 2, ry, g.cap - ry * 2, g.stroke)
  },
}

// ---------------------------------------------------------------------------
// Punctuation
// ---------------------------------------------------------------------------

const punct: Record<string, GlyphDraw> = {
  space: () => {
    // intentionally empty
  },
  exclam: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('exclam', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + w / 2, g.cap * 0.25, g.cap * 0.75, g.stroke)
    rect(p, x0 + w / 2 - g.stroke / 2, 0, g.stroke, g.stroke)
  },
  period: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('period', ctx)
    const x0 = g.sidebearing
    rect(p, x0 + w / 2 - g.stroke / 2, 0, g.stroke, g.stroke)
  },
  comma: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('comma', ctx)
    const x0 = g.sidebearing
    rect(p, x0 + w / 2 - g.stroke / 2, 0, g.stroke, g.stroke)
    strokeLine(p, x0 + w / 2 - g.stroke / 4, 0, x0 + w * 0.2, -g.stroke * 1.4, g.stroke * 0.6)
  },
  colon: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('colon', ctx)
    const x0 = g.sidebearing
    rect(p, x0 + w / 2 - g.stroke / 2, 0, g.stroke, g.stroke)
    rect(p, x0 + w / 2 - g.stroke / 2, g.xh - g.stroke, g.stroke, g.stroke)
  },
  semicolon: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('semicolon', ctx)
    const x0 = g.sidebearing
    rect(p, x0 + w / 2 - g.stroke / 2, g.xh - g.stroke, g.stroke, g.stroke)
    rect(p, x0 + w / 2 - g.stroke / 2, 0, g.stroke, g.stroke)
    strokeLine(p, x0 + w / 2 - g.stroke / 4, 0, x0 + w * 0.2, -g.stroke * 1.4, g.stroke * 0.6)
  },
  hyphen: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('hyphen', ctx)
    const x0 = g.sidebearing
    strokeH(p, x0, g.xh / 2, w, g.stroke)
  },
  underscore: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('underscore', ctx)
    const x0 = g.sidebearing
    strokeH(p, x0, g.descender / 2, w, g.stroke)
  },
  slash: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('slash', ctx)
    const x0 = g.sidebearing
    strokeLine(p, x0, 0, x0 + w, g.cap, g.stroke)
  },
  backslash: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('backslash', ctx)
    const x0 = g.sidebearing
    strokeLine(p, x0, g.cap, x0 + w, 0, g.stroke)
  },
  parenleft: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('parenleft', ctx)
    const x0 = g.sidebearing
    arc(p, x0 + w + g.stroke / 2, g.cap / 2, w * 0.9, g.cap / 2, g.stroke, 'left')
  },
  parenright: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('parenright', ctx)
    const x0 = g.sidebearing
    arc(p, x0 - g.stroke / 2, g.cap / 2, w * 0.9, g.cap / 2, g.stroke, 'right')
  },
  bracketleft: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('bracketleft', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + g.stroke / 2, 0, g.cap, g.stroke)
    strokeH(p, x0, g.cap - g.stroke / 2, w, g.stroke)
    strokeH(p, x0, g.stroke / 2, w, g.stroke)
  },
  bracketright: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('bracketright', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + w - g.stroke / 2, 0, g.cap, g.stroke)
    strokeH(p, x0, g.cap - g.stroke / 2, w, g.stroke)
    strokeH(p, x0, g.stroke / 2, w, g.stroke)
  },
  braceleft: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('braceleft', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + w / 2, 0, g.cap, g.stroke * 0.8)
    strokeH(p, x0, g.cap / 2, w * 0.7, g.stroke * 0.7)
  },
  braceright: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('braceright', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + w / 2, 0, g.cap, g.stroke * 0.8)
    strokeH(p, x0 + w * 0.3, g.cap / 2, w * 0.7, g.stroke * 0.7)
  },
  quotesingle: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('quotesingle', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + w / 2, g.cap * 0.7, g.cap * 0.3, g.stroke)
  },
  quotedbl: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('quotedbl', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + w * 0.3, g.cap * 0.7, g.cap * 0.3, g.stroke)
    strokeV(p, x0 + w * 0.7, g.cap * 0.7, g.cap * 0.3, g.stroke)
  },
  numbersign: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('numbersign', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + w * 0.3, g.cap * 0.05, g.cap * 0.9, g.stroke * 0.85)
    strokeV(p, x0 + w * 0.7, g.cap * 0.05, g.cap * 0.9, g.stroke * 0.85)
    strokeH(p, x0, g.cap * 0.65, w, g.stroke * 0.85)
    strokeH(p, x0, g.cap * 0.35, w, g.stroke * 0.85)
  },
  dollar: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('dollar', ctx)
    const x0 = g.sidebearing
    const cx = x0 + w / 2
    const ry = g.cap * 0.27
    arc(p, cx, g.cap - ry, w / 2, ry, g.stroke, 'top')
    arc(p, cx, g.cap - ry, w / 2, ry, g.stroke, 'left')
    arc(p, cx, ry, w / 2, ry, g.stroke, 'bottom')
    arc(p, cx, ry, w / 2, ry, g.stroke, 'right')
    strokeH(p, x0 + g.stroke * 0.3, g.cap / 2, w - g.stroke * 0.6, g.stroke * 0.85)
    strokeV(p, cx, -g.stroke * 1.5, g.cap + g.stroke * 3, g.stroke * 0.6)
  },
  percent: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('percent', ctx)
    const x0 = g.sidebearing
    const r = g.cap * 0.18
    ellipse(p, x0 + r, g.cap - r, r, r)
    ellipse(p, x0 + r, g.cap - r, r - g.stroke * 0.6, r - g.stroke * 0.6, { hole: true })
    ellipse(p, x0 + w - r, r, r, r)
    ellipse(p, x0 + w - r, r, r - g.stroke * 0.6, r - g.stroke * 0.6, { hole: true })
    strokeLine(p, x0 + w, g.cap, x0, 0, g.stroke * 0.7)
  },
  ampersand: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('ampersand', ctx)
    const x0 = g.sidebearing
    const cx = x0 + w * 0.4
    ellipse(p, cx, g.cap * 0.78, w * 0.3, g.cap * 0.22)
    ellipse(p, cx, g.cap * 0.78, w * 0.3 - g.stroke, g.cap * 0.22 - g.stroke, { hole: true })
    ellipse(p, cx, g.cap * 0.3, w * 0.4, g.cap * 0.3)
    ellipse(p, cx, g.cap * 0.3, w * 0.4 - g.stroke, g.cap * 0.3 - g.stroke, { hole: true })
    strokeLine(p, cx + w * 0.1, g.cap * 0.6, x0 + w, 0, g.stroke)
  },
  asterisk: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('asterisk', ctx)
    const x0 = g.sidebearing
    const cx = x0 + w / 2
    const cy = g.cap * 0.7
    const r = w / 2 * 0.8
    for (let i = 0; i < 5; i++) {
      const ang = (Math.PI * 2 * i) / 5 - Math.PI / 2
      strokeLine(p, cx, cy, cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, g.stroke * 0.7)
    }
  },
  plus: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('plus', ctx)
    const x0 = g.sidebearing
    strokeH(p, x0, g.cap / 2, w, g.stroke * 0.85)
    strokeV(p, x0 + w / 2, g.cap / 2 - w / 2, w, g.stroke * 0.85)
  },
  equal: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('equal', ctx)
    const x0 = g.sidebearing
    strokeH(p, x0, g.cap / 2 + g.stroke, w, g.stroke * 0.85)
    strokeH(p, x0, g.cap / 2 - g.stroke, w, g.stroke * 0.85)
  },
  less: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('less', ctx)
    const x0 = g.sidebearing
    strokeLine(p, x0 + w, g.cap * 0.7, x0, g.cap / 2, g.stroke * 0.7)
    strokeLine(p, x0, g.cap / 2, x0 + w, g.cap * 0.3, g.stroke * 0.7)
  },
  greater: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('greater', ctx)
    const x0 = g.sidebearing
    strokeLine(p, x0, g.cap * 0.7, x0 + w, g.cap / 2, g.stroke * 0.7)
    strokeLine(p, x0 + w, g.cap / 2, x0, g.cap * 0.3, g.stroke * 0.7)
  },
  question: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('question', ctx)
    const x0 = g.sidebearing
    const ry = g.cap * 0.22
    arc(p, x0 + w / 2, g.cap - ry, w / 2, ry, g.stroke, 'top')
    arc(p, x0 + w / 2, g.cap - ry, w / 2, ry, g.stroke, 'right')
    strokeV(p, x0 + w / 2, g.cap * 0.3, g.cap * 0.25, g.stroke)
    rect(p, x0 + w / 2 - g.stroke / 2, 0, g.stroke, g.stroke)
  },
  at: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('at', ctx)
    const x0 = g.sidebearing
    const cx = x0 + w / 2
    const cy = g.cap / 2
    ellipse(p, cx, cy, w / 2, g.cap / 2)
    ellipse(p, cx, cy, w / 2 - g.stroke * 0.7, g.cap / 2 - g.stroke * 0.7, { hole: true })
    ellipse(p, cx, cy, w * 0.18, g.cap * 0.18)
    ellipse(p, cx, cy, w * 0.18 - g.stroke * 0.6, g.cap * 0.18 - g.stroke * 0.6, { hole: true })
    strokeV(p, cx + w * 0.18, cy - g.cap * 0.1, g.cap * 0.3, g.stroke * 0.7)
  },
  asciicircum: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('asciicircum', ctx)
    const x0 = g.sidebearing
    strokeLine(p, x0, g.cap * 0.65, x0 + w / 2, g.cap, g.stroke * 0.7)
    strokeLine(p, x0 + w / 2, g.cap, x0 + w, g.cap * 0.65, g.stroke * 0.7)
  },
  grave: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('grave', ctx)
    const x0 = g.sidebearing
    strokeLine(p, x0, g.cap, x0 + w, g.cap * 0.8, g.stroke * 0.7)
  },
  bar: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('bar', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + w / 2, g.descender * 0.5, g.cap - g.descender * 0.5, g.stroke * 0.7)
  },
  asciitilde: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('asciitilde', ctx)
    const x0 = g.sidebearing
    const y = g.cap / 2
    const amp = g.stroke
    strokeLine(p, x0, y, x0 + w / 4, y + amp, g.stroke * 0.7)
    strokeLine(p, x0 + w / 4, y + amp, x0 + w * 3 / 4, y - amp, g.stroke * 0.7)
    strokeLine(p, x0 + w * 3 / 4, y - amp, x0 + w, y, g.stroke * 0.7)
  },
}

// ---------------------------------------------------------------------------
// Public registry
// ---------------------------------------------------------------------------

export const DEFAULT_DRAWERS: Record<string, GlyphDraw> = {
  ...uppers,
  ...lowers,
  ...digits,
  ...punct,
}

// Suppress unused-import warnings for primitives only used by some drawers.
void roundRect
void slab
void polygon
void KAPPA
