/**
 * Extended character set drawers — Latin-1 Supplement + key symbols.
 *
 * Most accented characters are composite: they call the base-letter
 * drawer and then add an accent above (or modify below). This keeps the
 * shapes consistent with the core Latin set.
 */

import type { Path } from 'opentype.js'
import { ellipse, rect, ring, strokeH, strokeLine, strokeV } from './primitives.ts'
import type { DrawContext, GlyphDraw } from './types.ts'
import { DEFAULT_DRAWERS, ITALIC_OVERRIDES, widthFor } from './letters.ts'

function geom(ctx: DrawContext) {
  const stroke = ctx.stroke
  const cap = (ctx.capHeight as number | undefined) ?? 700
  const xh = (ctx.xHeight as number | undefined) ?? 500
  const ascender = (ctx.ascenderHeight as number | undefined) ?? cap + 100
  const descender = (ctx.descenderDepth as number | undefined) ?? -200
  const sidebearing = (ctx.sidebearing as number | undefined) ?? 60
  return { stroke, cap, xh, ascender, descender, sidebearing }
}

// ---------------------------------------------------------------------------
// Accent drawers — anchored above a base letter
// ---------------------------------------------------------------------------
// All accents are drawn as if floating in their own space; the composite
// step shifts them to sit at (cx, anchorY).

interface AccentOpts {
  cx: number       // horizontal center to draw at
  anchorY: number  // baseline of the accent
  scale?: number   // optional size scaling
}

function acute(p: Path, ctx: DrawContext, o: AccentOpts): void {
  const g = geom(ctx)
  const s = (o.scale ?? 1)
  const w = g.stroke * 2.6 * s
  const h = g.stroke * 2.0 * s
  strokeLine(p, o.cx - w / 2, o.anchorY, o.cx + w / 2, o.anchorY + h, g.stroke * 0.85 * s)
}

function grave(p: Path, ctx: DrawContext, o: AccentOpts): void {
  const g = geom(ctx)
  const s = (o.scale ?? 1)
  const w = g.stroke * 2.6 * s
  const h = g.stroke * 2.0 * s
  strokeLine(p, o.cx - w / 2, o.anchorY + h, o.cx + w / 2, o.anchorY, g.stroke * 0.85 * s)
}

function circumflex(p: Path, ctx: DrawContext, o: AccentOpts): void {
  const g = geom(ctx)
  const s = (o.scale ?? 1)
  const w = g.stroke * 3.0 * s
  const h = g.stroke * 2.0 * s
  strokeLine(p, o.cx - w / 2, o.anchorY, o.cx, o.anchorY + h, g.stroke * 0.85 * s)
  strokeLine(p, o.cx, o.anchorY + h, o.cx + w / 2, o.anchorY, g.stroke * 0.85 * s)
}

function tilde(p: Path, ctx: DrawContext, o: AccentOpts): void {
  const g = geom(ctx)
  const s = (o.scale ?? 1)
  const w = g.stroke * 3.4 * s
  const amp = g.stroke * 0.8 * s
  const x0 = o.cx - w / 2
  strokeLine(p, x0, o.anchorY + amp, x0 + w * 0.4, o.anchorY + amp * 1.6, g.stroke * 0.8 * s)
  strokeLine(p, x0 + w * 0.4, o.anchorY + amp * 1.6, x0 + w * 0.6, o.anchorY + amp * 0.4, g.stroke * 0.8 * s)
  strokeLine(p, x0 + w * 0.6, o.anchorY + amp * 0.4, x0 + w, o.anchorY + amp, g.stroke * 0.8 * s)
}

function dieresis(p: Path, ctx: DrawContext, o: AccentOpts): void {
  const g = geom(ctx)
  const s = (o.scale ?? 1)
  const r = g.stroke * 0.6 * s
  const dx = g.stroke * 1.0 * s
  ellipse(p, o.cx - dx, o.anchorY + r, r, r)
  ellipse(p, o.cx + dx, o.anchorY + r, r, r)
}

function ringAbove(p: Path, ctx: DrawContext, o: AccentOpts): void {
  const g = geom(ctx)
  const s = (o.scale ?? 1)
  const r = g.stroke * 1.1 * s
  ring(p, o.cx, o.anchorY + r, r, r, g.stroke * 0.55 * s)
}

function caron(p: Path, ctx: DrawContext, o: AccentOpts): void {
  const g = geom(ctx)
  const s = (o.scale ?? 1)
  const w = g.stroke * 3.0 * s
  const h = g.stroke * 2.0 * s
  strokeLine(p, o.cx - w / 2, o.anchorY + h, o.cx, o.anchorY, g.stroke * 0.85 * s)
  strokeLine(p, o.cx, o.anchorY, o.cx + w / 2, o.anchorY + h, g.stroke * 0.85 * s)
}

function macron(p: Path, ctx: DrawContext, o: AccentOpts): void {
  const g = geom(ctx)
  const s = (o.scale ?? 1)
  const w = g.stroke * 3.4 * s
  rect(p, o.cx - w / 2, o.anchorY, w, g.stroke * 0.8 * s)
}

function cedillaBelow(p: Path, ctx: DrawContext, o: AccentOpts): void {
  const g = geom(ctx)
  const s = (o.scale ?? 1)
  // Hook that descends from the baseline
  strokeV(p, o.cx, -g.stroke * 1.2 * s, g.stroke * 1.2 * s, g.stroke * 0.85 * s)
  strokeLine(p, o.cx + g.stroke * 0.2 * s, -g.stroke * 1.2 * s, o.cx - g.stroke * 0.6 * s, -g.stroke * 2.0 * s, g.stroke * 0.7 * s)
}

// ---------------------------------------------------------------------------
// Anchors — where each accent sits relative to a base letter
// ---------------------------------------------------------------------------

function anchorForBase(name: string, ctx: DrawContext): { cx: number, top: number } {
  const g = geom(ctx)
  const isUpper = name.length === 1 && name >= 'A' && name <= 'Z'
  // Center the accent over the visible glyph: sidebearing + baseWidth/2.
  // We approximate with the advance width / 2 (close enough for v0.1).
  const advance = widthFor(name, ctx)
  const cx = advance / 2
  const top = isUpper ? g.cap + g.stroke * 0.6 : g.xh + g.stroke * 0.6
  return { cx, top }
}

// ---------------------------------------------------------------------------
// Composite drawers
// ---------------------------------------------------------------------------

type AccentName = 'acute' | 'grave' | 'circumflex' | 'tilde' | 'dieresis' | 'ring' | 'caron' | 'macron' | 'cedilla'

const ACCENT_FNS: Record<AccentName, (p: Path, ctx: DrawContext, o: AccentOpts) => void> = {
  acute, grave, circumflex, tilde, dieresis, ring: ringAbove, caron, macron, cedilla: cedillaBelow,
}

function composite(base: string, accent: AccentName): GlyphDraw {
  return (p, ctx) => {
    const drawer = DEFAULT_DRAWERS[base]
    if (!drawer) throw new Error(`composite missing base drawer: ${base}`)
    drawer(p, ctx)
    const a = anchorForBase(base, ctx)
    if (accent === 'cedilla') {
      ACCENT_FNS.cedilla(p, ctx, { cx: a.cx, anchorY: 0 })
    }
    else {
      ACCENT_FNS[accent](p, ctx, { cx: a.cx, anchorY: a.top })
    }
  }
}

// ---------------------------------------------------------------------------
// Special letters that aren't pure composites
// ---------------------------------------------------------------------------

const specials: Record<string, GlyphDraw> = {
  // German sharp s (ß) — long-s + s ligature; we approximate as a 'B'-ish bowl
  germandbls: (p, ctx) => {
    const g = geom(ctx)
    const w = widthFor('B', ctx)
    const x0 = g.sidebearing
    const stem = x0 + g.stroke / 2
    // Tall stem + two lobes (like a 'B' but with a slight ascender)
    strokeV(p, stem, 0, g.ascender * 0.95, g.stroke)
    const midY = g.xh / 2
    const upperRy = (g.ascender * 0.95 - midY) / 2
    const lowerRy = midY / 2
    // Upper lobe (smaller, pointed-top)
    strokeV(p, stem + g.stroke + upperRy * 1.6, midY, upperRy * 2, g.stroke)
    strokeH(p, stem + g.stroke * 0.5, g.ascender * 0.95 - g.stroke / 2, upperRy * 1.6, g.stroke)
    // Lower lobe
    rect(p, stem + g.stroke + lowerRy * 1.4, lowerRy - g.stroke / 2, lowerRy * 0.4, g.stroke)
    rect(p, stem + g.stroke * 0.4, midY - g.stroke * 0.45, lowerRy * 1.6, g.stroke * 0.9)
    rect(p, stem + g.stroke * 0.4, 0, lowerRy * 1.6, g.stroke)
  },
  // ae digraph
  ae: (p, ctx) => {
    const g = geom(ctx)
    const w = widthFor('o', ctx) + widthFor('e', ctx) * 0.6
    const x0 = g.sidebearing
    void x0; void w; void p
    DEFAULT_DRAWERS.a!(p, ctx)
    DEFAULT_DRAWERS.e!(p, { ...ctx, sidebearing: g.sidebearing + widthFor('a', ctx) * 0.45 })
  },
  AE: (p, ctx) => {
    const g = geom(ctx)
    DEFAULT_DRAWERS.A!(p, ctx)
    DEFAULT_DRAWERS.E!(p, { ...ctx, sidebearing: g.sidebearing + widthFor('A', ctx) * 0.55 })
  },
  // Slashed O and o (Ø, ø)
  Oslash: (p, ctx) => {
    const g = geom(ctx)
    const w = widthFor('O', ctx)
    DEFAULT_DRAWERS.O!(p, ctx)
    strokeLine(p, g.sidebearing - g.stroke * 0.4, -g.stroke * 0.5, g.sidebearing + w - g.stroke * 0.6, g.cap + g.stroke * 0.5, g.stroke * 0.7)
  },
  oslash: (p, ctx) => {
    const g = geom(ctx)
    const w = widthFor('o', ctx)
    DEFAULT_DRAWERS.o!(p, ctx)
    strokeLine(p, g.sidebearing - g.stroke * 0.4, -g.stroke * 0.5, g.sidebearing + w - g.stroke * 0.6, g.xh + g.stroke * 0.5, g.stroke * 0.7)
  },
  // Currency / symbols
  cent: (p, ctx) => {
    const g = geom(ctx)
    const w = widthFor('c', ctx)
    DEFAULT_DRAWERS.c!(p, ctx)
    strokeV(p, g.sidebearing + w / 2, -g.stroke * 1.2, g.xh + g.stroke * 2.4, g.stroke * 0.6)
  },
  sterling: (p, ctx) => {
    const g = geom(ctx)
    const w = widthFor('L', ctx)
    const x0 = g.sidebearing
    const hs = Math.max(g.stroke * 0.55, 28)
    strokeV(p, x0 + g.stroke / 2, 0, g.cap, g.stroke)
    strokeH(p, x0, g.cap * 0.45 - hs / 2, w * 0.6, hs * 0.85)
    rect(p, x0, 0, w, hs)
    // hook at top
    strokeLine(p, x0 + g.stroke / 2, g.cap, x0 + w * 0.7, g.cap, g.stroke * 0.7)
  },
  yen: (p, ctx) => {
    const g = geom(ctx)
    DEFAULT_DRAWERS.Y!(p, ctx)
    const w = widthFor('Y', ctx)
    const x0 = g.sidebearing
    const hs = Math.max(g.stroke * 0.55, 28)
    rect(p, x0, g.cap * 0.42 - hs / 2, w, hs * 0.7)
    rect(p, x0, g.cap * 0.28 - hs / 2, w, hs * 0.7)
  },
  copyright: (p, ctx) => {
    const g = geom(ctx)
    const w = widthFor('O', ctx)
    const x0 = g.sidebearing
    const cx = x0 + w / 2
    const cy = g.cap / 2
    ring(p, cx, cy, w / 2, g.cap / 2, g.stroke * 0.55)
    // small 'c' inside
    const innerR = w * 0.28
    ring(p, cx, cy, innerR, innerR, g.stroke * 0.5)
    rect(p, cx + innerR * 0.3, cy - innerR * 0.5, innerR * 1.2, innerR)
  },
  registered: (p, ctx) => {
    const g = geom(ctx)
    const w = widthFor('O', ctx)
    const x0 = g.sidebearing
    const cx = x0 + w / 2
    const cy = g.cap / 2
    ring(p, cx, cy, w / 2, g.cap / 2, g.stroke * 0.55)
    // small 'R' inside (very stylized)
    const innerW = w * 0.4
    rect(p, cx - innerW / 2, cy - innerW * 0.6, g.stroke * 0.6, innerW * 1.2)
    rect(p, cx - innerW / 2, cy + innerW * 0.5, innerW, g.stroke * 0.6)
    strokeLine(p, cx - innerW / 4, cy, cx + innerW / 2, cy - innerW * 0.6, g.stroke * 0.6)
  },
  trademark: (p, ctx) => {
    // TM superscript — shrunk T + M
    const g = geom(ctx)
    const tm = (ctx.tmScale as number | undefined) ?? 0.55
    const subCtx: DrawContext = {
      ...ctx,
      capHeight: g.cap * tm,
      stroke: g.stroke * tm,
      sidebearing: g.sidebearing,
    }
    DEFAULT_DRAWERS.T!(p, subCtx)
    const wT = widthFor('T', subCtx)
    DEFAULT_DRAWERS.M!(p, { ...subCtx, sidebearing: g.sidebearing + wT * 0.4 })
  },
  degree: (p, ctx) => {
    const g = geom(ctx)
    const w = widthFor('o', ctx)
    const cx = g.sidebearing + w / 2
    const r = g.stroke * 1.3
    ring(p, cx, g.cap - r, r, r, g.stroke * 0.55)
  },
  plusminus: (p, ctx) => {
    const g = geom(ctx)
    DEFAULT_DRAWERS.plus!(p, ctx)
    const w = widthFor('plus', ctx)
    rect(p, g.sidebearing + w * 0.05, 0, w * 0.9, g.stroke * 0.95)
  },
  paragraph: (p, ctx) => {
    const g = geom(ctx)
    const w = widthFor('P', ctx)
    DEFAULT_DRAWERS.P!(p, ctx)
    strokeV(p, g.sidebearing + w * 0.6, 0, g.cap, g.stroke * 0.7)
  },
  section: (p, ctx) => {
    const g = geom(ctx)
    const w = widthFor('S', ctx)
    DEFAULT_DRAWERS.S!(p, ctx)
    DEFAULT_DRAWERS.S!(p, { ...ctx, sidebearing: g.sidebearing, ascenderHeight: g.cap, capHeight: g.cap, xHeight: g.cap, descenderDepth: -g.cap })
    void w
  },
  middot: (p, ctx) => {
    const g = geom(ctx)
    const w = widthFor('period', ctx)
    rect(p, g.sidebearing + w / 2 - g.stroke * 0.55, g.xh / 2 - g.stroke * 0.55, g.stroke * 1.1, g.stroke * 1.1)
  },
  exclamdown: (p, ctx) => {
    const g = geom(ctx)
    const w = widthFor('exclam', ctx)
    const x0 = g.sidebearing
    rect(p, x0 + w / 2 - g.stroke * 0.55, g.cap - g.stroke * 1.1, g.stroke * 1.1, g.stroke * 1.1)
    strokeV(p, x0 + w / 2, 0, g.cap * 0.75, g.stroke)
  },
  questiondown: (p, ctx) => {
    const g = geom(ctx)
    const w = widthFor('question', ctx)
    const x0 = g.sidebearing
    const ry = g.cap * 0.22
    rect(p, x0 + w / 2 - g.stroke * 0.55, g.cap - g.stroke * 1.1, g.stroke * 1.1, g.stroke * 1.1)
    strokeV(p, x0 + w / 2, g.cap * 0.45, g.cap * 0.25, g.stroke)
    // Use arc but flipped vertically — easier: draw a half-arc at the bottom
    void ry
    // simplified: a quarter ellipse curve via primitives reused
    strokeLine(p, x0 + w / 2, g.cap * 0.2, x0 + g.stroke, 0, g.stroke)
  },
  // Greek micro
  micro: (p, ctx) => {
    const g = geom(ctx)
    const w = widthFor('u', ctx)
    DEFAULT_DRAWERS.u!(p, ctx)
    const x0 = g.sidebearing
    strokeV(p, x0 + g.stroke / 2, g.descender, g.xh, g.stroke)
    void w
  },
}

// ---------------------------------------------------------------------------
// Composite registry
// ---------------------------------------------------------------------------

const composites: Record<string, GlyphDraw> = {
  // Uppercase accented vowels
  Agrave: composite('A', 'grave'),
  Aacute: composite('A', 'acute'),
  Acircumflex: composite('A', 'circumflex'),
  Atilde: composite('A', 'tilde'),
  Adieresis: composite('A', 'dieresis'),
  Aring: composite('A', 'ring'),
  Ccedilla: composite('C', 'cedilla'),
  Egrave: composite('E', 'grave'),
  Eacute: composite('E', 'acute'),
  Ecircumflex: composite('E', 'circumflex'),
  Edieresis: composite('E', 'dieresis'),
  Igrave: composite('I', 'grave'),
  Iacute: composite('I', 'acute'),
  Icircumflex: composite('I', 'circumflex'),
  Idieresis: composite('I', 'dieresis'),
  Ntilde: composite('N', 'tilde'),
  Ograve: composite('O', 'grave'),
  Oacute: composite('O', 'acute'),
  Ocircumflex: composite('O', 'circumflex'),
  Otilde: composite('O', 'tilde'),
  Odieresis: composite('O', 'dieresis'),
  Ugrave: composite('U', 'grave'),
  Uacute: composite('U', 'acute'),
  Ucircumflex: composite('U', 'circumflex'),
  Udieresis: composite('U', 'dieresis'),
  Yacute: composite('Y', 'acute'),
  Ydieresis: composite('Y', 'dieresis'),
  // Lowercase accented vowels
  agrave: composite('a', 'grave'),
  aacute: composite('a', 'acute'),
  acircumflex: composite('a', 'circumflex'),
  atilde: composite('a', 'tilde'),
  adieresis: composite('a', 'dieresis'),
  aring: composite('a', 'ring'),
  ccedilla: composite('c', 'cedilla'),
  egrave: composite('e', 'grave'),
  eacute: composite('e', 'acute'),
  ecircumflex: composite('e', 'circumflex'),
  edieresis: composite('e', 'dieresis'),
  igrave: composite('i', 'grave'),
  iacute: composite('i', 'acute'),
  icircumflex: composite('i', 'circumflex'),
  idieresis: composite('i', 'dieresis'),
  ntilde: composite('n', 'tilde'),
  ograve: composite('o', 'grave'),
  oacute: composite('o', 'acute'),
  ocircumflex: composite('o', 'circumflex'),
  otilde: composite('o', 'tilde'),
  odieresis: composite('o', 'dieresis'),
  ugrave: composite('u', 'grave'),
  uacute: composite('u', 'acute'),
  ucircumflex: composite('u', 'circumflex'),
  udieresis: composite('u', 'dieresis'),
  yacute: composite('y', 'acute'),
  ydieresis: composite('y', 'dieresis'),
}

// ---------------------------------------------------------------------------
// Ligatures (used by the OpenType `liga` feature)
// ---------------------------------------------------------------------------

export const LIGATURES: Record<string, GlyphDraw> = {
  // fi — the f's hook merges with the i's dot (no dot in the ligature)
  fi: (p, ctx) => {
    const g = geom(ctx)
    const fw = widthFor('f', ctx)
    DEFAULT_DRAWERS.f!(p, ctx)
    const subCtx: DrawContext = { ...ctx, sidebearing: g.sidebearing + fw - g.stroke * 0.6 }
    const iw = widthFor('i', subCtx)
    void iw
    // Stem of i, no dot
    strokeV(p, g.sidebearing + fw + g.stroke * 0.6, 0, g.xh, g.stroke)
  },
  // fl — f's hook joins l's stem
  fl: (p, ctx) => {
    const g = geom(ctx)
    const fw = widthFor('f', ctx)
    DEFAULT_DRAWERS.f!(p, ctx)
    strokeV(p, g.sidebearing + fw + g.stroke * 0.6, 0, g.ascender, g.stroke)
  },
}

// ---------------------------------------------------------------------------
// Public registry
// ---------------------------------------------------------------------------

export const EXTENDED_DRAWERS: Record<string, GlyphDraw> = {
  ...composites,
  ...specials,
}

// Also export italic versions of composites that have italic base overrides
export const EXTENDED_ITALIC_OVERRIDES: Record<string, GlyphDraw> = (() => {
  const out: Record<string, GlyphDraw> = {}
  for (const [name, base] of Object.entries({
    agrave: 'a', aacute: 'a', acircumflex: 'a', atilde: 'a', adieresis: 'a', aring: 'a',
    egrave: 'e', eacute: 'e', ecircumflex: 'e', edieresis: 'e',
  })) {
    if (ITALIC_OVERRIDES[base]) {
      out[name] = (p, ctx) => {
        ITALIC_OVERRIDES[base]!(p, ctx)
        const a = anchorForBase(base, ctx)
        const accent = name.replace(base, '') as AccentName | 'cedilla'
        if (accent in ACCENT_FNS) {
          ACCENT_FNS[accent as AccentName](p, ctx, { cx: a.cx, anchorY: a.top })
        }
      }
    }
  }
  return out
})()
