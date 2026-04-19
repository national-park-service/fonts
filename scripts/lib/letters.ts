/**
 * Parametric letter library — v2.
 *
 * Each glyph is drawn as a compound path: an outer contour plus zero or
 * more inner contours (counters). All contours use proper bezier curves
 * for round forms, with optical overshoots on circular glyphs and
 * humanist construction (slight stress, rounded joints).
 *
 * Geometry conventions
 * --------------------
 *   Origin: glyph baseline at y=0, advance starts at x=0.
 *   The drawer reads cap_height, x_height, stroke from ctx.
 *   It does NOT set advanceWidth — the caller does that via widthFor().
 */

import type { Path } from 'opentype.js'
import { CAP_HEIGHT, X_HEIGHT } from './common.ts'
import {
  arc,
  ellipse,
  KAPPA,
  polygon,
  rect,
  ring,
  slab,
  strokeH,
  strokeLine,
  strokeV,
} from './primitives.ts'
import type { DrawContext, GlyphDraw } from './types.ts'

// ---------------------------------------------------------------------------
// Geometry helper
// ---------------------------------------------------------------------------

function geom(ctx: DrawContext) {
  const stroke = ctx.stroke
  const cap = (ctx.capHeight as number | undefined) ?? CAP_HEIGHT
  const xh = (ctx.xHeight as number | undefined) ?? X_HEIGHT
  const ascender = (ctx.ascenderHeight as number | undefined) ?? cap + 100
  const descender = (ctx.descenderDepth as number | undefined) ?? -200
  const condense = (ctx.condense as number | undefined) ?? 1
  const serifLen = (ctx.serifLen as number | undefined) ?? 0
  const serifThickness = (ctx.serifThickness as number | undefined) ?? Math.max(stroke * 0.55, 28)
  const sidebearing = (ctx.sidebearing as number | undefined) ?? 60
  const slant = (ctx.slant as number | undefined) ?? 0
  // Optical overshoot for round glyphs (% of stroke).
  const overshoot = (ctx.overshoot as number | undefined) ?? Math.max(stroke * 0.18, 12)
  // Contrast: ratio of horizontal to vertical stroke (1 = monoline, <1 = thinner horizontals).
  const contrast = (ctx.contrast as number | undefined) ?? 1
  // True if family has bracketed serifs.
  const bracketed = (ctx.bracketed as boolean | undefined) ?? false
  // True if family is geometric (no stress modulation, no overshoot).
  const geometric = (ctx.geometric as boolean | undefined) ?? false
  return {
    stroke, cap, xh, ascender, descender, condense, serifLen, serifThickness,
    sidebearing, slant, overshoot: geometric ? 0 : overshoot, contrast, bracketed, geometric,
  }
}

const hStroke = (g: ReturnType<typeof geom>) => Math.max(g.stroke * g.contrast, g.stroke * 0.4)

// ---------------------------------------------------------------------------
// Serif helpers
// ---------------------------------------------------------------------------

function topSerif(p: Path, x: number, y: number, ctx: DrawContext): void {
  const g = geom(ctx)
  if (g.serifLen <= 0) return
  if (g.bracketed) {
    // Bracketed serif — slight curve from stem to slab edge
    const halfL = g.serifLen / 2
    const t = g.serifThickness
    const k = t * 0.6
    p.moveTo(x - halfL, y)
    p.lineTo(x + halfL, y)
    p.lineTo(x + halfL, y - t)
    p.curveTo(x + g.stroke / 2 + k, y - t, x + g.stroke / 2, y - t + k, x + g.stroke / 2, y - t * 1.2)
    p.lineTo(x - g.stroke / 2, y - t * 1.2)
    p.curveTo(x - g.stroke / 2, y - t + k, x - halfL + k, y - t, x - halfL, y - t)
    p.close()
  }
  else {
    rect(p, x - g.serifLen / 2, y - g.serifThickness, g.serifLen, g.serifThickness)
  }
}

function bottomSerif(p: Path, x: number, y: number, ctx: DrawContext): void {
  const g = geom(ctx)
  if (g.serifLen <= 0) return
  if (g.bracketed) {
    const halfL = g.serifLen / 2
    const t = g.serifThickness
    const k = t * 0.6
    p.moveTo(x - halfL, y)
    p.lineTo(x - halfL, y + t)
    p.curveTo(x - halfL + k, y + t, x - g.stroke / 2, y + t - k, x - g.stroke / 2, y + t * 1.2)
    p.lineTo(x + g.stroke / 2, y + t * 1.2)
    p.curveTo(x + g.stroke / 2, y + t - k, x + halfL - k, y + t, x + halfL, y + t)
    p.lineTo(x + halfL, y)
    p.close()
  }
  else {
    rect(p, x - g.serifLen / 2, y, g.serifLen, g.serifThickness)
  }
}

// ---------------------------------------------------------------------------
// Width tables
// ---------------------------------------------------------------------------

export function widthFor(name: string, ctx: DrawContext): number {
  const g = geom(ctx)
  const w = baseWidth(name, ctx) * g.condense
  return Math.round(w + g.sidebearing * 2)
}

function baseWidth(name: string, ctx: DrawContext): number {
  const g = geom(ctx)
  const s = g.stroke
  const wide = g.cap * 0.95
  const med = g.cap * 0.78
  const narrow = g.cap * 0.55
  // Lookup with sensible defaults.
  const map: Record<string, number> = {
    A: med, B: med, C: med, D: med, E: narrow + s * 0.5, F: narrow + s * 0.5,
    G: med, H: med, I: s + 80, J: narrow + s * 0.5, K: med, L: narrow + s * 0.5,
    M: wide, N: med, O: wide * 0.92, P: med, Q: wide * 0.92, R: med,
    S: med, T: med, U: med, V: med, W: wide, X: med, Y: med, Z: med,
    a: med * 0.85, b: med * 0.82, c: med * 0.8, d: med * 0.82, e: med * 0.82,
    f: narrow * 1.05, g: med * 0.82, h: med * 0.82, i: s + 40, j: narrow,
    k: med * 0.82, l: s + 40, m: wide * 0.95, n: med * 0.82, o: med * 0.85,
    p: med * 0.82, q: med * 0.82, r: narrow * 1.0, s: med * 0.7, t: narrow,
    u: med * 0.82, v: med * 0.85, w: wide * 0.95, x: med * 0.85, y: med * 0.85,
    z: med * 0.7,
    zero: med, one: narrow, two: med, three: med, four: med, five: med,
    six: med, seven: med, eight: med, nine: med,
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
// Round form helpers — proper humanist bowls with stress + overshoot
// ---------------------------------------------------------------------------

/** Outer + inner bowl forming a closed counter; respects contrast. */
function bowl(
  p: Path,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  vStroke: number,
  hStrokeW: number,
  overshoot: number,
): void {
  // Outer ellipse with overshoot
  ellipse(p, cx, cy, rx, ry + overshoot)
  // Inner ellipse: the counter offset by per-axis stroke width
  // The horizontal opening (top/bottom) is hStroke; vertical (left/right) is vStroke
  ellipse(p, cx, cy, rx - vStroke, ry + overshoot - hStrokeW, { hole: true })
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
    const bar = g.cap * 0.4
    strokeLine(p, left, 0, apex, g.cap, g.stroke)
    strokeLine(p, apex, g.cap, right, 0, g.stroke)
    // Crossbar — slightly thinner than diagonals
    const bx1 = left + (apex - left) * (bar / g.cap) + g.stroke * 0.2
    const bx2 = right - (right - apex) * (bar / g.cap) - g.stroke * 0.2
    rect(p, bx1, bar - hStroke(g) / 2, bx2 - bx1, hStroke(g))
    bottomSerif(p, left + g.stroke / 4, 0, ctx)
    bottomSerif(p, right - g.stroke / 4, 0, ctx)
  },
  B: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('B', ctx)
    const x0 = g.sidebearing
    const stem = x0 + g.stroke / 2
    const right = x0 + w
    const midY = g.cap / 2
    const upperRy = (g.cap - midY) / 2
    const lowerRy = midY / 2
    // Stem
    strokeV(p, stem, 0, g.cap, g.stroke)
    // Upper bowl
    const upperCx = stem
    const upperCy = midY + upperRy
    const upperRx = (right - stem) - g.stroke * 0.3
    arc(p, upperCx, upperCy, upperRx, upperRy + g.overshoot * 0.3, g.stroke, 'right')
    // Lower bowl (slightly larger)
    const lowerCx = stem
    const lowerCy = lowerRy
    const lowerRx = (right - stem)
    arc(p, lowerCx, lowerCy, lowerRx, lowerRy + g.overshoot * 0.3, g.stroke, 'right')
    // Top, middle, bottom horizontal closures
    rect(p, x0, g.cap - hStroke(g), upperRx, hStroke(g))
    rect(p, x0, midY - hStroke(g) * 0.45, lowerRx - g.stroke * 0.3, hStroke(g) * 0.9)
    rect(p, x0, 0, lowerRx, hStroke(g))
    topSerif(p, stem, g.cap, ctx)
    bottomSerif(p, stem, 0, ctx)
  },
  C: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('C', ctx)
    const x0 = g.sidebearing
    const cx = x0 + w / 2
    const cy = g.cap / 2
    const rx = w / 2
    const ry = g.cap / 2
    const hs = hStroke(g)
    // Outer with overshoot
    ellipse(p, cx, cy, rx, ry + g.overshoot * 0.6)
    ellipse(p, cx, cy, rx - g.stroke, ry + g.overshoot * 0.6 - hs, { hole: true })
    // Open the right with a wedge that tapers
    polygon(p, [
      { x: cx + rx * 0.05, y: cy - ry * 0.45 },
      { x: cx + rx + g.stroke, y: cy - ry * 0.45 },
      { x: cx + rx + g.stroke, y: cy + ry * 0.45 },
      { x: cx + rx * 0.05, y: cy + ry * 0.45 },
    ])
    // Add small terminals (beaks) at the top and bottom of the opening
    const beakY = ry * 0.45
    rect(p, cx + rx * 0.02, cy + beakY - hs, hs * 0.8, hs)
    rect(p, cx + rx * 0.02, cy - beakY, hs * 0.8, hs)
  },
  D: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('D', ctx)
    const x0 = g.sidebearing
    const stem = x0 + g.stroke / 2
    const right = x0 + w
    const cy = g.cap / 2
    const ry = g.cap / 2
    const rx = (right - stem)
    strokeV(p, stem, 0, g.cap, g.stroke)
    arc(p, stem, cy, rx, ry + g.overshoot * 0.4, g.stroke, 'right')
    rect(p, x0, g.cap - hStroke(g), rx, hStroke(g))
    rect(p, x0, 0, rx, hStroke(g))
    topSerif(p, stem, g.cap, ctx)
    bottomSerif(p, stem, 0, ctx)
  },
  E: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('E', ctx)
    const x0 = g.sidebearing
    const stem = x0 + g.stroke / 2
    const hs = hStroke(g)
    strokeV(p, stem, 0, g.cap, g.stroke)
    rect(p, x0, g.cap - hs, w, hs)
    rect(p, x0, g.cap / 2 - hs * 0.45, w * 0.82, hs * 0.9)
    rect(p, x0, 0, w, hs)
    topSerif(p, stem, g.cap, ctx)
    bottomSerif(p, stem, 0, ctx)
  },
  F: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('F', ctx)
    const x0 = g.sidebearing
    const stem = x0 + g.stroke / 2
    const hs = hStroke(g)
    strokeV(p, stem, 0, g.cap, g.stroke)
    rect(p, x0, g.cap - hs, w, hs)
    rect(p, x0, g.cap / 2 - hs * 0.45, w * 0.78, hs * 0.9)
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
    const hs = hStroke(g)
    ellipse(p, cx, cy, rx, ry + g.overshoot * 0.6)
    ellipse(p, cx, cy, rx - g.stroke, ry + g.overshoot * 0.6 - hs, { hole: true })
    // Open right
    polygon(p, [
      { x: cx + rx * 0.05, y: cy - ry * 0.42 },
      { x: cx + rx + g.stroke, y: cy - ry * 0.42 },
      { x: cx + rx + g.stroke, y: cy * 0.4 },
      { x: cx + rx * 0.05, y: cy * 0.4 },
    ])
    // Inner shelf (the spur that defines G)
    rect(p, cx + rx * 0.18, cy * 0.5 - hs * 0.45, rx * 0.65, hs * 0.9)
    strokeV(p, x0 + w - g.stroke / 2, 0, cy * 0.5, g.stroke)
    bottomSerif(p, x0 + w - g.stroke / 2, 0, ctx)
  },
  H: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('H', ctx)
    const x0 = g.sidebearing
    const hs = hStroke(g)
    strokeV(p, x0 + g.stroke / 2, 0, g.cap, g.stroke)
    strokeV(p, x0 + w - g.stroke / 2, 0, g.cap, g.stroke)
    rect(p, x0, g.cap / 2 - hs / 2, w, hs)
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
    const hookCy = g.cap * 0.18
    const hookRx = w * 0.42
    strokeV(p, stem, hookCy, g.cap - hookCy, g.stroke)
    arc(p, stem - hookRx, hookCy, hookRx, hookCy + g.overshoot * 0.4, g.stroke, 'bottom')
    strokeH(p, x0 + g.stroke * 0.4, hookCy - hStroke(g) / 2, hookRx + g.stroke * 0.2, hStroke(g))
    topSerif(p, stem, g.cap, ctx)
  },
  K: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('K', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + g.stroke / 2, 0, g.cap, g.stroke)
    const j = g.cap * 0.45
    strokeLine(p, x0 + g.stroke * 0.8, j, x0 + w, g.cap, g.stroke)
    strokeLine(p, x0 + g.stroke * 0.8, j, x0 + w, 0, g.stroke)
    topSerif(p, x0 + g.stroke / 2, g.cap, ctx)
    bottomSerif(p, x0 + g.stroke / 2, 0, ctx)
    bottomSerif(p, x0 + w - g.stroke / 4, 0, ctx)
  },
  L: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('L', ctx)
    const x0 = g.sidebearing
    const hs = hStroke(g)
    strokeV(p, x0 + g.stroke / 2, 0, g.cap, g.stroke)
    rect(p, x0, 0, w, hs)
    topSerif(p, x0 + g.stroke / 2, g.cap, ctx)
  },
  M: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('M', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + g.stroke / 2, 0, g.cap, g.stroke)
    strokeV(p, x0 + w - g.stroke / 2, 0, g.cap, g.stroke)
    strokeLine(p, x0 + g.stroke * 0.5, g.cap, x0 + w / 2, g.cap * 0.18, g.stroke)
    strokeLine(p, x0 + w / 2, g.cap * 0.18, x0 + w - g.stroke * 0.5, g.cap, g.stroke)
    bottomSerif(p, x0 + g.stroke / 2, 0, ctx)
    bottomSerif(p, x0 + w - g.stroke / 2, 0, ctx)
  },
  N: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('N', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + g.stroke / 2, 0, g.cap, g.stroke)
    strokeV(p, x0 + w - g.stroke / 2, 0, g.cap, g.stroke)
    strokeLine(p, x0 + g.stroke * 0.5, g.cap, x0 + w - g.stroke * 0.5, 0, g.stroke)
    bottomSerif(p, x0 + g.stroke / 2, 0, ctx)
    topSerif(p, x0 + w - g.stroke / 2, g.cap, ctx)
  },
  O: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('O', ctx)
    const x0 = g.sidebearing
    const cx = x0 + w / 2
    const cy = g.cap / 2
    const rx = w / 2
    const ry = g.cap / 2 + g.overshoot * 0.6
    bowl(p, cx, cy, rx, ry, g.stroke, hStroke(g), 0)
  },
  P: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('P', ctx)
    const x0 = g.sidebearing
    const stem = x0 + g.stroke / 2
    const hs = hStroke(g)
    strokeV(p, stem, 0, g.cap, g.stroke)
    const midY = g.cap * 0.55
    arc(p, stem, (g.cap + midY) / 2, w - g.stroke * 0.3, (g.cap - midY) / 2 + g.overshoot * 0.3, g.stroke, 'right')
    rect(p, x0, g.cap - hs, w - g.stroke * 0.4, hs)
    rect(p, x0, midY - hs * 0.45, w - g.stroke * 0.5, hs * 0.9)
    topSerif(p, stem, g.cap, ctx)
    bottomSerif(p, stem, 0, ctx)
  },
  Q: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('Q', ctx)
    const x0 = g.sidebearing
    const cx = x0 + w / 2
    const cy = g.cap / 2
    const rx = w / 2
    const ry = g.cap / 2 + g.overshoot * 0.6
    bowl(p, cx, cy, rx, ry, g.stroke, hStroke(g), 0)
    strokeLine(p, cx + w * 0.08, g.cap * 0.22, cx + w * 0.45, -g.cap * 0.06, g.stroke)
  },
  R: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('R', ctx)
    const x0 = g.sidebearing
    const stem = x0 + g.stroke / 2
    const hs = hStroke(g)
    strokeV(p, stem, 0, g.cap, g.stroke)
    const midY = g.cap * 0.55
    arc(p, stem, (g.cap + midY) / 2, w - g.stroke * 0.3, (g.cap - midY) / 2 + g.overshoot * 0.3, g.stroke, 'right')
    rect(p, x0, g.cap - hs, w - g.stroke * 0.4, hs)
    rect(p, x0, midY - hs * 0.45, w - g.stroke * 0.5, hs * 0.9)
    strokeLine(p, stem + w * 0.4, midY, x0 + w, 0, g.stroke)
    topSerif(p, stem, g.cap, ctx)
    bottomSerif(p, stem, 0, ctx)
    bottomSerif(p, x0 + w - g.stroke / 4, 0, ctx)
  },
  S: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('S', ctx)
    const x0 = g.sidebearing
    const cx = x0 + w / 2
    const ryT = g.cap * 0.27
    const ryB = g.cap * 0.27
    const hs = hStroke(g)
    arc(p, cx, g.cap - ryT, w / 2, ryT + g.overshoot * 0.3, g.stroke, 'top')
    arc(p, cx, g.cap - ryT, w / 2, ryT, g.stroke, 'left')
    arc(p, cx, ryB, w / 2, ryB + g.overshoot * 0.3, g.stroke, 'bottom')
    arc(p, cx, ryB, w / 2, ryB, g.stroke, 'right')
    rect(p, x0 + g.stroke * 0.3, g.cap / 2 - hs * 0.45, w - g.stroke * 0.6, hs * 0.9)
  },
  T: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('T', ctx)
    const x0 = g.sidebearing
    const hs = hStroke(g)
    rect(p, x0, g.cap - hs, w, hs)
    strokeV(p, x0 + w / 2, 0, g.cap, g.stroke)
    bottomSerif(p, x0 + w / 2, 0, ctx)
  },
  U: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('U', ctx)
    const x0 = g.sidebearing
    const cx = x0 + w / 2
    const ry = g.cap * 0.28
    strokeV(p, x0 + g.stroke / 2, ry, g.cap - ry, g.stroke)
    strokeV(p, x0 + w - g.stroke / 2, ry, g.cap - ry, g.stroke)
    arc(p, cx, ry, w / 2, ry + g.overshoot * 0.4, g.stroke, 'bottom')
    topSerif(p, x0 + g.stroke / 2, g.cap, ctx)
    topSerif(p, x0 + w - g.stroke / 2, g.cap, ctx)
  },
  V: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('V', ctx)
    const x0 = g.sidebearing
    strokeLine(p, x0 + g.stroke * 0.3, g.cap, x0 + w / 2, 0, g.stroke)
    strokeLine(p, x0 + w / 2, 0, x0 + w - g.stroke * 0.3, g.cap, g.stroke)
    topSerif(p, x0 + g.stroke / 2, g.cap, ctx)
    topSerif(p, x0 + w - g.stroke / 2, g.cap, ctx)
  },
  W: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('W', ctx)
    const x0 = g.sidebearing
    const a = w / 4
    strokeLine(p, x0 + g.stroke * 0.2, g.cap, x0 + a, 0, g.stroke)
    strokeLine(p, x0 + a, 0, x0 + a * 2, g.cap * 0.72, g.stroke)
    strokeLine(p, x0 + a * 2, g.cap * 0.72, x0 + a * 3, 0, g.stroke)
    strokeLine(p, x0 + a * 3, 0, x0 + w - g.stroke * 0.2, g.cap, g.stroke)
    topSerif(p, x0 + g.stroke / 2, g.cap, ctx)
    topSerif(p, x0 + w - g.stroke / 2, g.cap, ctx)
  },
  X: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('X', ctx)
    const x0 = g.sidebearing
    strokeLine(p, x0 + g.stroke * 0.3, 0, x0 + w - g.stroke * 0.3, g.cap, g.stroke)
    strokeLine(p, x0 + g.stroke * 0.3, g.cap, x0 + w - g.stroke * 0.3, 0, g.stroke)
    bottomSerif(p, x0 + g.stroke * 0.3, 0, ctx)
    bottomSerif(p, x0 + w - g.stroke * 0.3, 0, ctx)
  },
  Y: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('Y', ctx)
    const x0 = g.sidebearing
    const midY = g.cap * 0.45
    strokeLine(p, x0 + g.stroke * 0.3, g.cap, x0 + w / 2, midY, g.stroke)
    strokeLine(p, x0 + w / 2, midY, x0 + w - g.stroke * 0.3, g.cap, g.stroke)
    strokeV(p, x0 + w / 2, 0, midY, g.stroke)
    bottomSerif(p, x0 + w / 2, 0, ctx)
  },
  Z: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('Z', ctx)
    const x0 = g.sidebearing
    const hs = hStroke(g)
    rect(p, x0, g.cap - hs, w, hs)
    rect(p, x0, 0, w, hs)
    strokeLine(p, x0 + w - g.stroke * 0.2, g.cap - hs, x0 + g.stroke * 0.2, hs, g.stroke)
  },
}

// ---------------------------------------------------------------------------
// Lowercase letters — humanist construction
// ---------------------------------------------------------------------------

const lowers: Record<string, GlyphDraw> = {
  // Two-storey 'a' — closed bowl + stem with a tail
  a: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('a', ctx)
    const x0 = g.sidebearing
    const cx = x0 + (w - g.stroke / 2) / 2
    const rx = (w - g.stroke / 2) / 2
    const ry = g.xh / 2
    const hs = hStroke(g)
    bowl(p, cx, ry, rx, ry + g.overshoot * 0.5, g.stroke, hs, 0)
    // Right stem flush with the bowl's right edge
    strokeV(p, x0 + w - g.stroke / 2, 0, g.xh, g.stroke)
    // Subtle tail curling up from the bottom of the stem
    const tailW = g.stroke * 1.2
    polygon(p, [
      { x: x0 + w, y: 0 },
      { x: x0 + w + tailW, y: g.stroke * 0.6 },
      { x: x0 + w + tailW, y: 0 },
    ])
  },
  b: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('b', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + g.stroke / 2, 0, g.ascender, g.stroke)
    const cx = x0 + g.stroke / 2 + (w - g.stroke) / 2
    bowl(p, cx, g.xh / 2, (w - g.stroke / 2) / 2, g.xh / 2 + g.overshoot * 0.5, g.stroke, hStroke(g), 0)
  },
  c: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('c', ctx)
    const x0 = g.sidebearing
    const cx = x0 + w / 2
    const ry = g.xh / 2 + g.overshoot * 0.5
    const hs = hStroke(g)
    ellipse(p, cx, g.xh / 2, w / 2, ry)
    ellipse(p, cx, g.xh / 2, w / 2 - g.stroke, ry - hs, { hole: true })
    polygon(p, [
      { x: cx + g.stroke * 0.05, y: g.xh / 2 - g.xh * 0.32 },
      { x: cx + w / 2 + g.stroke, y: g.xh / 2 - g.xh * 0.32 },
      { x: cx + w / 2 + g.stroke, y: g.xh / 2 + g.xh * 0.32 },
      { x: cx + g.stroke * 0.05, y: g.xh / 2 + g.xh * 0.32 },
    ])
  },
  d: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('d', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + w - g.stroke / 2, 0, g.ascender, g.stroke)
    const cx = x0 + (w - g.stroke / 2) / 2
    bowl(p, cx, g.xh / 2, (w - g.stroke / 2) / 2, g.xh / 2 + g.overshoot * 0.5, g.stroke, hStroke(g), 0)
  },
  e: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('e', ctx)
    const x0 = g.sidebearing
    const cx = x0 + w / 2
    const ry = g.xh / 2 + g.overshoot * 0.5
    const hs = hStroke(g)
    ellipse(p, cx, g.xh / 2, w / 2, ry)
    ellipse(p, cx, g.xh / 2, w / 2 - g.stroke, ry - hs, { hole: true })
    rect(p, x0 + g.stroke * 0.4, g.xh / 2 - hs * 0.45, w - g.stroke * 0.8, hs * 0.9)
    polygon(p, [
      { x: cx + g.stroke * 0.1, y: g.xh / 2 - g.xh * 0.32 },
      { x: cx + w / 2 + g.stroke, y: g.xh / 2 - g.xh * 0.32 },
      { x: cx + w / 2 + g.stroke, y: g.xh / 2 - g.stroke * 0.4 },
      { x: cx + g.stroke * 0.1, y: g.xh / 2 - g.stroke * 0.4 },
    ])
  },
  f: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('f', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + w * 0.4, 0, g.ascender - w * 0.3, g.stroke)
    arc(p, x0 + w * 0.4 + w * 0.4, g.ascender - w * 0.4, w * 0.4, w * 0.4 + g.overshoot * 0.3, g.stroke, 'top')
    arc(p, x0 + w * 0.4 + w * 0.4, g.ascender - w * 0.4, w * 0.4, w * 0.4, g.stroke, 'right')
    rect(p, x0, g.xh - hStroke(g) / 2, w * 0.85, hStroke(g))
  },
  g: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('g', ctx)
    const x0 = g.sidebearing
    const cx = x0 + (w - g.stroke / 2) / 2
    const rx = (w - g.stroke / 2) / 2
    const ry = g.xh / 2
    bowl(p, cx, ry, rx, ry + g.overshoot * 0.5, g.stroke, hStroke(g), 0)
    // Right stem extending into descender
    strokeV(p, x0 + w - g.stroke / 2, g.descender + g.stroke * 0.5, g.xh - g.descender - g.stroke * 0.5, g.stroke)
    // Hook at the bottom
    arc(p, x0 + w / 2, g.descender + g.stroke * 0.5, w / 2 - g.stroke * 0.2, g.stroke * 0.5, g.stroke, 'bottom')
    rect(p, x0 + g.stroke * 0.4, g.descender, w / 2, hStroke(g))
  },
  h: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('h', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + g.stroke / 2, 0, g.ascender, g.stroke)
    const shRy = g.xh / 3 + g.overshoot * 0.3
    arc(p, x0 + w / 2, g.xh - g.xh / 3, (w - g.stroke) / 2, shRy, g.stroke, 'top')
    strokeV(p, x0 + w - g.stroke / 2, 0, g.xh - g.xh / 3 + g.stroke * 0.2, g.stroke)
  },
  i: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('i', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + w / 2, 0, g.xh, g.stroke)
    rect(p, x0 + w / 2 - g.stroke * 0.55, g.xh + g.stroke * 0.6, g.stroke * 1.1, g.stroke * 1.1)
  },
  j: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('j', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + w * 0.65, g.descender + w * 0.3, g.xh - g.descender - w * 0.3, g.stroke)
    arc(p, x0 + w * 0.3, g.descender + w * 0.3, w * 0.35, w * 0.3, g.stroke, 'bottom')
    rect(p, x0 + w * 0.65 - g.stroke * 0.55, g.xh + g.stroke * 0.6, g.stroke * 1.1, g.stroke * 1.1)
  },
  k: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('k', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + g.stroke / 2, 0, g.ascender, g.stroke)
    const j = g.xh * 0.4
    strokeLine(p, x0 + g.stroke * 0.8, j, x0 + w, g.xh, g.stroke)
    strokeLine(p, x0 + g.stroke * 0.8, j, x0 + w, 0, g.stroke)
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
    arc(p, x0 + a / 2 + g.stroke / 2, g.xh - g.xh / 3, (a - g.stroke) / 2, g.xh / 3 + g.overshoot * 0.3, g.stroke, 'top')
    strokeV(p, x0 + a, 0, g.xh - g.xh / 3 + g.stroke * 0.2, g.stroke)
    arc(p, x0 + a + a / 2, g.xh - g.xh / 3, (a - g.stroke) / 2, g.xh / 3 + g.overshoot * 0.3, g.stroke, 'top')
    strokeV(p, x0 + w - g.stroke / 2, 0, g.xh - g.xh / 3 + g.stroke * 0.2, g.stroke)
  },
  n: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('n', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + g.stroke / 2, 0, g.xh, g.stroke)
    arc(p, x0 + w / 2, g.xh - (g.xh / 3), (w - g.stroke) / 2, g.xh / 3 + g.overshoot * 0.3, g.stroke, 'top')
    strokeV(p, x0 + w - g.stroke / 2, 0, g.xh - g.xh / 3 + g.stroke * 0.2, g.stroke)
  },
  o: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('o', ctx)
    const x0 = g.sidebearing
    const cx = x0 + w / 2
    bowl(p, cx, g.xh / 2, w / 2, g.xh / 2 + g.overshoot * 0.5, g.stroke, hStroke(g), 0)
  },
  p: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('p', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + g.stroke / 2, g.descender, g.xh - g.descender, g.stroke)
    const cx = x0 + g.stroke / 2 + (w - g.stroke) / 2
    bowl(p, cx, g.xh / 2, (w - g.stroke / 2) / 2, g.xh / 2 + g.overshoot * 0.5, g.stroke, hStroke(g), 0)
  },
  q: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('q', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + w - g.stroke / 2, g.descender, g.xh - g.descender, g.stroke)
    const cx = x0 + (w - g.stroke / 2) / 2
    bowl(p, cx, g.xh / 2, (w - g.stroke / 2) / 2, g.xh / 2 + g.overshoot * 0.5, g.stroke, hStroke(g), 0)
  },
  r: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('r', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + g.stroke / 2, 0, g.xh, g.stroke)
    arc(p, x0 + w * 0.55, g.xh - g.xh / 3.5, w * 0.45, g.xh / 3.5 + g.overshoot * 0.2, g.stroke, 'top')
    arc(p, x0 + w * 0.55, g.xh - g.xh / 3.5, w * 0.45, g.xh / 3.5, g.stroke, 'right')
  },
  s: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('s', ctx)
    const x0 = g.sidebearing
    const cx = x0 + w / 2
    const ry = g.xh * 0.27
    const hs = hStroke(g)
    arc(p, cx, g.xh - ry, w / 2, ry + g.overshoot * 0.3, g.stroke, 'top')
    arc(p, cx, g.xh - ry, w / 2, ry, g.stroke, 'left')
    arc(p, cx, ry, w / 2, ry + g.overshoot * 0.3, g.stroke, 'bottom')
    arc(p, cx, ry, w / 2, ry, g.stroke, 'right')
    rect(p, x0 + g.stroke * 0.3, g.xh / 2 - hs * 0.45, w - g.stroke * 0.6, hs * 0.9)
  },
  t: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('t', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + w * 0.4, 0, g.cap * 0.85, g.stroke)
    rect(p, x0, g.xh - hStroke(g) / 2, w, hStroke(g))
    // Subtle hook at the base
    arc(p, x0 + w * 0.7, g.stroke * 0.5, w * 0.3, g.stroke * 0.5, g.stroke, 'bottom')
  },
  u: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('u', ctx)
    const x0 = g.sidebearing
    const ry = g.xh * 0.3
    strokeV(p, x0 + g.stroke / 2, ry, g.xh - ry, g.stroke)
    strokeV(p, x0 + w - g.stroke / 2, 0, g.xh, g.stroke)
    arc(p, x0 + w / 2, ry, w / 2, ry + g.overshoot * 0.4, g.stroke, 'bottom')
  },
  v: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('v', ctx)
    const x0 = g.sidebearing
    strokeLine(p, x0 + g.stroke * 0.2, g.xh, x0 + w / 2, 0, g.stroke)
    strokeLine(p, x0 + w / 2, 0, x0 + w - g.stroke * 0.2, g.xh, g.stroke)
  },
  w: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('w', ctx)
    const x0 = g.sidebearing
    const a = w / 4
    strokeLine(p, x0 + g.stroke * 0.2, g.xh, x0 + a, 0, g.stroke)
    strokeLine(p, x0 + a, 0, x0 + a * 2, g.xh * 0.72, g.stroke)
    strokeLine(p, x0 + a * 2, g.xh * 0.72, x0 + a * 3, 0, g.stroke)
    strokeLine(p, x0 + a * 3, 0, x0 + w - g.stroke * 0.2, g.xh, g.stroke)
  },
  x: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('x', ctx)
    const x0 = g.sidebearing
    strokeLine(p, x0 + g.stroke * 0.2, 0, x0 + w - g.stroke * 0.2, g.xh, g.stroke)
    strokeLine(p, x0 + g.stroke * 0.2, g.xh, x0 + w - g.stroke * 0.2, 0, g.stroke)
  },
  y: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('y', ctx)
    const x0 = g.sidebearing
    strokeLine(p, x0 + g.stroke * 0.2, g.xh, x0 + w * 0.55, 0, g.stroke)
    strokeLine(p, x0 + w - g.stroke * 0.2, g.xh, x0 + w * 0.18, g.descender, g.stroke)
  },
  z: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('z', ctx)
    const x0 = g.sidebearing
    const hs = hStroke(g)
    rect(p, x0, g.xh - hs, w, hs)
    rect(p, x0, 0, w, hs)
    strokeLine(p, x0 + w - g.stroke * 0.2, g.xh - hs, x0 + g.stroke * 0.2, hs, g.stroke)
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
    bowl(p, cx, g.cap / 2, w / 2, g.cap / 2 + g.overshoot * 0.5, g.stroke, hStroke(g), 0)
  },
  one: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('one', ctx)
    const x0 = g.sidebearing
    const hs = hStroke(g)
    strokeV(p, x0 + w * 0.55, 0, g.cap, g.stroke)
    strokeLine(p, x0 + g.stroke * 0.4, g.cap * 0.78, x0 + w * 0.55, g.cap, g.stroke * 0.85)
    rect(p, x0, 0, w, hs)
  },
  two: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('two', ctx)
    const x0 = g.sidebearing
    const ry = g.cap * 0.3
    const hs = hStroke(g)
    arc(p, x0 + w / 2, g.cap - ry, w / 2, ry + g.overshoot * 0.3, g.stroke, 'top')
    arc(p, x0 + w / 2, g.cap - ry, w / 2, ry, g.stroke, 'right')
    strokeLine(p, x0 + w - g.stroke * 0.3, g.cap * 0.6, x0 + g.stroke * 0.3, hs, g.stroke)
    rect(p, x0, 0, w, hs)
  },
  three: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('three', ctx)
    const x0 = g.sidebearing
    const ry = g.cap * 0.27
    const hs = hStroke(g)
    arc(p, x0 + w / 2, g.cap - ry, w / 2, ry + g.overshoot * 0.3, g.stroke, 'top')
    arc(p, x0 + w / 2, g.cap - ry, w / 2, ry, g.stroke, 'right')
    arc(p, x0 + w / 2, ry, w / 2, ry + g.overshoot * 0.3, g.stroke, 'bottom')
    arc(p, x0 + w / 2, ry, w / 2, ry, g.stroke, 'right')
    rect(p, x0 + w * 0.18, g.cap / 2 - hs * 0.45, w * 0.6, hs * 0.9)
  },
  four: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('four', ctx)
    const x0 = g.sidebearing
    const hs = hStroke(g)
    strokeV(p, x0 + w * 0.7, 0, g.cap, g.stroke)
    strokeLine(p, x0 + w * 0.7, g.cap, x0 + g.stroke * 0.3, g.cap * 0.32, g.stroke)
    rect(p, x0, g.cap * 0.32 - hs / 2, w, hs)
  },
  five: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('five', ctx)
    const x0 = g.sidebearing
    const ry = g.cap * 0.27
    const hs = hStroke(g)
    rect(p, x0, g.cap - hs, w, hs)
    strokeV(p, x0 + g.stroke / 2, g.cap * 0.5, g.cap * 0.5, g.stroke)
    arc(p, x0 + w / 2, ry, w / 2, ry + g.overshoot * 0.3, g.stroke, 'bottom')
    arc(p, x0 + w / 2, ry, w / 2, ry, g.stroke, 'right')
    rect(p, x0 + g.stroke * 0.5, g.cap * 0.5 - hs * 0.45, w * 0.55, hs * 0.9)
  },
  six: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('six', ctx)
    const x0 = g.sidebearing
    const cx = x0 + w / 2
    const ry = g.cap * 0.27
    bowl(p, cx, ry, w / 2, ry + g.overshoot * 0.3, g.stroke, hStroke(g), 0)
    arc(p, cx, g.cap - ry, w / 2, ry + g.overshoot * 0.3, g.stroke, 'top')
    arc(p, cx, g.cap - ry, w / 2, ry, g.stroke, 'left')
    strokeV(p, x0 + g.stroke / 2, ry, g.cap - ry * 2, g.stroke)
  },
  seven: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('seven', ctx)
    const x0 = g.sidebearing
    const hs = hStroke(g)
    rect(p, x0, g.cap - hs, w, hs)
    strokeLine(p, x0 + w - g.stroke * 0.2, g.cap, x0 + w * 0.22, 0, g.stroke)
  },
  eight: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('eight', ctx)
    const x0 = g.sidebearing
    const cx = x0 + w / 2
    const ryT = g.cap * 0.23
    const ryB = g.cap * 0.27
    bowl(p, cx, g.cap - ryT, w / 2 * 0.85, ryT + g.overshoot * 0.3, g.stroke, hStroke(g), 0)
    bowl(p, cx, ryB, w / 2, ryB + g.overshoot * 0.3, g.stroke, hStroke(g), 0)
  },
  nine: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('nine', ctx)
    const x0 = g.sidebearing
    const cx = x0 + w / 2
    const ry = g.cap * 0.27
    bowl(p, cx, g.cap - ry, w / 2, ry + g.overshoot * 0.3, g.stroke, hStroke(g), 0)
    arc(p, cx, ry, w / 2, ry + g.overshoot * 0.3, g.stroke, 'bottom')
    arc(p, cx, ry, w / 2, ry, g.stroke, 'right')
    strokeV(p, x0 + w - g.stroke / 2, ry, g.cap - ry * 2, g.stroke)
  },
}

// ---------------------------------------------------------------------------
// Punctuation (kept simple, but with overshoots/contrast where it matters)
// ---------------------------------------------------------------------------

const punct: Record<string, GlyphDraw> = {
  space: () => {},
  exclam: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('exclam', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + w / 2, g.cap * 0.25, g.cap * 0.75, g.stroke)
    rect(p, x0 + w / 2 - g.stroke * 0.55, 0, g.stroke * 1.1, g.stroke * 1.1)
  },
  period: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('period', ctx)
    const x0 = g.sidebearing
    rect(p, x0 + w / 2 - g.stroke * 0.55, 0, g.stroke * 1.1, g.stroke * 1.1)
  },
  comma: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('comma', ctx)
    const x0 = g.sidebearing
    rect(p, x0 + w / 2 - g.stroke * 0.55, 0, g.stroke * 1.1, g.stroke * 1.1)
    strokeLine(p, x0 + w / 2, 0, x0 + w * 0.2, -g.stroke * 1.6, g.stroke * 0.7)
  },
  colon: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('colon', ctx)
    const x0 = g.sidebearing
    rect(p, x0 + w / 2 - g.stroke * 0.55, 0, g.stroke * 1.1, g.stroke * 1.1)
    rect(p, x0 + w / 2 - g.stroke * 0.55, g.xh - g.stroke * 1.1, g.stroke * 1.1, g.stroke * 1.1)
  },
  semicolon: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('semicolon', ctx)
    const x0 = g.sidebearing
    rect(p, x0 + w / 2 - g.stroke * 0.55, g.xh - g.stroke * 1.1, g.stroke * 1.1, g.stroke * 1.1)
    rect(p, x0 + w / 2 - g.stroke * 0.55, 0, g.stroke * 1.1, g.stroke * 1.1)
    strokeLine(p, x0 + w / 2, 0, x0 + w * 0.2, -g.stroke * 1.6, g.stroke * 0.7)
  },
  hyphen: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('hyphen', ctx)
    const x0 = g.sidebearing
    rect(p, x0, g.xh / 2 - hStroke(g) / 2, w, hStroke(g))
  },
  underscore: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('underscore', ctx)
    const x0 = g.sidebearing
    rect(p, x0, g.descender / 2 - hStroke(g) / 2, w, hStroke(g))
  },
  slash: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('slash', ctx)
    const x0 = g.sidebearing
    strokeLine(p, x0, 0, x0 + w, g.cap, g.stroke * 0.85)
  },
  backslash: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('backslash', ctx)
    const x0 = g.sidebearing
    strokeLine(p, x0, g.cap, x0 + w, 0, g.stroke * 0.85)
  },
  parenleft: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('parenleft', ctx)
    const x0 = g.sidebearing
    arc(p, x0 + w + g.stroke / 2, g.cap / 2, w * 0.95, g.cap / 2 + g.overshoot * 0.5, g.stroke * 0.85, 'left')
  },
  parenright: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('parenright', ctx)
    const x0 = g.sidebearing
    arc(p, x0 - g.stroke / 2, g.cap / 2, w * 0.95, g.cap / 2 + g.overshoot * 0.5, g.stroke * 0.85, 'right')
  },
  bracketleft: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('bracketleft', ctx)
    const x0 = g.sidebearing
    const hs = hStroke(g)
    strokeV(p, x0 + g.stroke / 2, 0, g.cap, g.stroke * 0.85)
    rect(p, x0, g.cap - hs, w, hs * 0.9)
    rect(p, x0, 0, w, hs * 0.9)
  },
  bracketright: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('bracketright', ctx)
    const x0 = g.sidebearing
    const hs = hStroke(g)
    strokeV(p, x0 + w - g.stroke / 2, 0, g.cap, g.stroke * 0.85)
    rect(p, x0, g.cap - hs, w, hs * 0.9)
    rect(p, x0, 0, w, hs * 0.9)
  },
  braceleft: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('braceleft', ctx)
    const x0 = g.sidebearing
    const hs = hStroke(g)
    strokeV(p, x0 + w / 2, 0, g.cap, g.stroke * 0.7)
    rect(p, x0, g.cap / 2 - hs * 0.4, w * 0.7, hs * 0.8)
  },
  braceright: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('braceright', ctx)
    const x0 = g.sidebearing
    const hs = hStroke(g)
    strokeV(p, x0 + w / 2, 0, g.cap, g.stroke * 0.7)
    rect(p, x0 + w * 0.3, g.cap / 2 - hs * 0.4, w * 0.7, hs * 0.8)
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
    const hs = hStroke(g)
    strokeLine(p, x0 + w * 0.32, 0, x0 + w * 0.22, g.cap, g.stroke * 0.85)
    strokeLine(p, x0 + w * 0.78, 0, x0 + w * 0.68, g.cap, g.stroke * 0.85)
    rect(p, x0, g.cap * 0.65 - hs / 2, w, hs * 0.9)
    rect(p, x0, g.cap * 0.35 - hs / 2, w, hs * 0.9)
  },
  dollar: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('dollar', ctx)
    const x0 = g.sidebearing
    const cx = x0 + w / 2
    const ry = g.cap * 0.27
    const hs = hStroke(g)
    arc(p, cx, g.cap - ry, w / 2, ry + g.overshoot * 0.3, g.stroke, 'top')
    arc(p, cx, g.cap - ry, w / 2, ry, g.stroke, 'left')
    arc(p, cx, ry, w / 2, ry + g.overshoot * 0.3, g.stroke, 'bottom')
    arc(p, cx, ry, w / 2, ry, g.stroke, 'right')
    rect(p, x0 + g.stroke * 0.3, g.cap / 2 - hs * 0.45, w - g.stroke * 0.6, hs * 0.9)
    strokeV(p, cx, -g.stroke * 1.5, g.cap + g.stroke * 3, g.stroke * 0.6)
  },
  percent: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('percent', ctx)
    const x0 = g.sidebearing
    const r = g.cap * 0.18
    ring(p, x0 + r, g.cap - r, r, r, g.stroke * 0.65)
    ring(p, x0 + w - r, r, r, r, g.stroke * 0.65)
    strokeLine(p, x0 + w, g.cap, x0, 0, g.stroke * 0.7)
  },
  ampersand: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('ampersand', ctx)
    const x0 = g.sidebearing
    const cx = x0 + w * 0.4
    bowl(p, cx, g.cap * 0.78, w * 0.3, g.cap * 0.22 + g.overshoot * 0.3, g.stroke, hStroke(g), 0)
    bowl(p, cx, g.cap * 0.3, w * 0.4, g.cap * 0.3 + g.overshoot * 0.3, g.stroke, hStroke(g), 0)
    strokeLine(p, cx + w * 0.05, g.cap * 0.55, x0 + w, 0, g.stroke)
  },
  asterisk: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('asterisk', ctx)
    const x0 = g.sidebearing
    const cx = x0 + w / 2
    const cy = g.cap * 0.7
    const r = w / 2 * 0.85
    for (let i = 0; i < 6; i++) {
      const ang = (Math.PI * i) / 3 - Math.PI / 2
      strokeLine(p, cx, cy, cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, g.stroke * 0.55)
    }
  },
  plus: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('plus', ctx)
    const x0 = g.sidebearing
    rect(p, x0, g.cap / 2 - hStroke(g) / 2, w, hStroke(g) * 0.95)
    strokeV(p, x0 + w / 2, g.cap / 2 - w / 2, w, g.stroke * 0.95)
  },
  equal: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('equal', ctx)
    const x0 = g.sidebearing
    const hs = hStroke(g)
    rect(p, x0, g.cap / 2 + g.stroke - hs / 2, w, hs * 0.9)
    rect(p, x0, g.cap / 2 - g.stroke - hs / 2, w, hs * 0.9)
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
    arc(p, x0 + w / 2, g.cap - ry, w / 2, ry + g.overshoot * 0.3, g.stroke, 'top')
    arc(p, x0 + w / 2, g.cap - ry, w / 2, ry, g.stroke, 'right')
    strokeV(p, x0 + w / 2, g.cap * 0.3, g.cap * 0.25, g.stroke)
    rect(p, x0 + w / 2 - g.stroke * 0.55, 0, g.stroke * 1.1, g.stroke * 1.1)
  },
  at: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('at', ctx)
    const x0 = g.sidebearing
    const cx = x0 + w / 2
    const cy = g.cap / 2
    ring(p, cx, cy, w / 2, g.cap / 2, g.stroke * 0.7)
    ring(p, cx, cy, w * 0.18, g.cap * 0.18, g.stroke * 0.6)
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
    strokeLine(p, x0, g.cap, x0 + w, g.cap * 0.78, g.stroke * 0.7)
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
// Italic letter overrides (true cursive structure for the most distinctive
// glyphs; the rest of the alphabet is shear-only at write time).
// ---------------------------------------------------------------------------

export const ITALIC_OVERRIDES: Record<string, GlyphDraw> = {
  // Single-storey italic 'a' — a hallmark of true italics
  a: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('a', ctx)
    const x0 = g.sidebearing
    const cx = x0 + (w - g.stroke / 2) / 2
    const rx = (w - g.stroke / 2) / 2
    bowl(p, cx, g.xh / 2, rx, g.xh / 2 + g.overshoot * 0.5, g.stroke, hStroke(g), 0)
    strokeV(p, x0 + w - g.stroke / 2, 0, g.xh, g.stroke)
  },
  // Italic 'e' — angled crossbar
  e: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('e', ctx)
    const x0 = g.sidebearing
    const cx = x0 + w / 2
    const ry = g.xh / 2 + g.overshoot * 0.5
    const hs = hStroke(g)
    ellipse(p, cx, g.xh / 2, w / 2, ry)
    ellipse(p, cx, g.xh / 2, w / 2 - g.stroke, ry - hs, { hole: true })
    // Tilted crossbar (slight upward tilt is characteristic)
    strokeLine(p, x0 + g.stroke * 0.5, g.xh * 0.42, x0 + w - g.stroke * 0.5, g.xh * 0.55, hs)
    polygon(p, [
      { x: cx + g.stroke * 0.1, y: g.xh / 2 - g.xh * 0.32 },
      { x: cx + w / 2 + g.stroke, y: g.xh / 2 - g.xh * 0.32 },
      { x: cx + w / 2 + g.stroke, y: g.xh / 2 - g.stroke * 0.4 },
      { x: cx + g.stroke * 0.1, y: g.xh / 2 - g.stroke * 0.4 },
    ])
  },
  // Italic 'f' — descending tail (ascender + descender)
  f: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('f', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + w * 0.5, g.descender, g.ascender - g.descender, g.stroke)
    arc(p, x0 + w * 0.5 + w * 0.4, g.ascender - w * 0.4, w * 0.4, w * 0.4 + g.overshoot * 0.3, g.stroke, 'top')
    arc(p, x0 + w * 0.5 + w * 0.4, g.ascender - w * 0.4, w * 0.4, w * 0.4, g.stroke, 'right')
    rect(p, x0, g.xh - hStroke(g) / 2, w * 0.85, hStroke(g))
  },
  // Single-storey italic 'g' — open loop, more cursive
  g: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('g', ctx)
    const x0 = g.sidebearing
    const cx = x0 + (w - g.stroke / 2) / 2
    const rx = (w - g.stroke / 2) / 2
    bowl(p, cx, g.xh / 2, rx, g.xh / 2 + g.overshoot * 0.5, g.stroke, hStroke(g), 0)
    // Descender as a curved tail rather than a full loop
    strokeV(p, x0 + w - g.stroke / 2, g.descender * 0.6, g.xh - g.descender * 0.6, g.stroke)
    arc(p, x0 + w * 0.55, g.descender * 0.6, w * 0.4, g.stroke * 0.6, g.stroke, 'bottom')
  },
  // Italic 'k' — distinctive loop joint
  k: (p, ctx) => {
    const g = geom(ctx)
    const w = baseWidth('k', ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + g.stroke / 2, 0, g.ascender, g.stroke)
    const j = g.xh * 0.42
    // Upper diagonal curls into a small loop at the join
    strokeLine(p, x0 + g.stroke * 0.8, j, x0 + w * 0.95, g.xh, g.stroke)
    strokeLine(p, x0 + g.stroke * 0.6, j - g.stroke * 0.2, x0 + w, 0, g.stroke)
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
void slab
void KAPPA
