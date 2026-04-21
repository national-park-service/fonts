#!/usr/bin/env bun
/**
 * Campmate Script — USFS "National Forest" brush-script.
 *
 * Simple rect+ellipse primitives, moderate 2:1 stroke contrast, 15° italic
 * shear applied post-draw. Wood-sign cursive feel with ligatures: oo, ll, tt,
 * ee, ss via OpenType `liga` GSUB.
 *
 * Coverage: A-Z, a-z, 0-9, basic punctuation + 5 ligatures. Single weight.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import opentype from 'opentype.js'
import { sfntToWoff } from './lib/woff.ts'

const wawoff2 = await import('wawoff2')

const ROOT = resolve(import.meta.dir, '..')
const FONTS_DIR = resolve(ROOT, 'fonts', 'campmate-script')

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

const UPM = 1000
const CAP = 680
const XH = 360
const ASC = 740
const DESC = -200
const STROKE = 95               // base brush weight reference
const THICK = Math.round(STROKE * 1.15) // ~109 — heavy downstroke (brush press)
const THIN = Math.round(STROKE * 0.40)  // ~38 — light upstroke (brush lift)
const TAPER = Math.round(STROKE * 0.26) // ~25 — pen terminal tip
// Contrast ratio = THICK/TAPER ≈ 4.4:1 at terminals, THICK/THIN ≈ 2.9:1 in strokes
const LSB = 30
const RSB = 30
const KAPPA = 0.5522847498307936

// Italic shear
const SLANT_DEG = 15
const SHEAR = Math.tan(SLANT_DEG * Math.PI / 180)   // ≈ 0.268

/** Apply italic shear to every command in a Path, in place. */
function applyShear(p: opentype.Path) {
  for (const cmd of p.commands) {
    const c = cmd as { type: string, x?: number, y?: number, x1?: number, y1?: number, x2?: number, y2?: number }
    if (c.y !== undefined && c.x !== undefined) c.x = c.x + SHEAR * c.y
    if (c.y1 !== undefined && c.x1 !== undefined) c.x1 = c.x1 + SHEAR * c.y1
    if (c.y2 !== undefined && c.x2 !== undefined) c.x2 = c.x2 + SHEAR * c.y2
  }
}

// ---------------------------------------------------------------------------
// Primitives — copied from summitgrade-1935 verbatim, plus a thin wrapper.
// ---------------------------------------------------------------------------

function rect(p: opentype.Path, x: number, y: number, w: number, h: number) {
  p.moveTo(x, y)
  p.lineTo(x + w, y)
  p.lineTo(x + w, y + h)
  p.lineTo(x, y + h)
  p.close()
}

function ellipse(p: opentype.Path, cx: number, cy: number, rx: number, ry: number, hole = false) {
  const kx = rx * KAPPA, ky = ry * KAPPA
  if (!hole) {
    p.moveTo(cx + rx, cy)
    p.curveTo(cx + rx, cy + ky, cx + kx, cy + ry, cx, cy + ry)
    p.curveTo(cx - kx, cy + ry, cx - rx, cy + ky, cx - rx, cy)
    p.curveTo(cx - rx, cy - ky, cx - kx, cy - ry, cx, cy - ry)
    p.curveTo(cx + kx, cy - ry, cx + rx, cy - ky, cx + rx, cy)
  }
  else {
    p.moveTo(cx + rx, cy)
    p.curveTo(cx + rx, cy - ky, cx + kx, cy - ry, cx, cy - ry)
    p.curveTo(cx - kx, cy - ry, cx - rx, cy - ky, cx - rx, cy)
    p.curveTo(cx - rx, cy + ky, cx - kx, cy + ry, cx, cy + ry)
    p.curveTo(cx + kx, cy + ry, cx + rx, cy + ky, cx + rx, cy)
  }
  p.close()
}

function legStroke(p: opentype.Path, xBottom: number, xTop: number, yBottom: number, yTop: number, w: number) {
  const halfW = w / 2
  p.moveTo(xBottom - halfW, yBottom)
  p.lineTo(xBottom + halfW, yBottom)
  p.lineTo(xTop + halfW, yTop)
  p.lineTo(xTop - halfW, yTop)
  p.close()
}

function halfRing(p: opentype.Path, cx: number, cy: number, rx: number, ry: number, w: number, side: 'right' | 'left' | 'top' | 'bottom') {
  const k = KAPPA
  const irx = Math.max(0, rx - w)
  const iry = Math.max(0, ry - w)
  const hollow = irx > 0 && iry > 0
  if (side === 'right') {
    if (hollow) {
      p.moveTo(cx, cy - ry)
      p.curveTo(cx + rx * k, cy - ry, cx + rx, cy - ry * k, cx + rx, cy)
      p.curveTo(cx + rx, cy + ry * k, cx + rx * k, cy + ry, cx, cy + ry)
      p.lineTo(cx, cy + iry)
      p.curveTo(cx + irx * k, cy + iry, cx + irx, cy + iry * k, cx + irx, cy)
      p.curveTo(cx + irx, cy - iry * k, cx + irx * k, cy - iry, cx, cy - iry)
      p.lineTo(cx, cy - ry)
      p.close()
    }
    else {
      p.moveTo(cx, cy + ry)
      p.lineTo(cx, cy - ry)
      p.curveTo(cx + rx * k, cy - ry, cx + rx, cy - ry * k, cx + rx, cy)
      p.curveTo(cx + rx, cy + ry * k, cx + rx * k, cy + ry, cx, cy + ry)
      p.close()
    }
  }
  else if (side === 'left') {
    if (hollow) {
      p.moveTo(cx, cy + ry)
      p.curveTo(cx - rx * k, cy + ry, cx - rx, cy + ry * k, cx - rx, cy)
      p.curveTo(cx - rx, cy - ry * k, cx - rx * k, cy - ry, cx, cy - ry)
      p.lineTo(cx, cy - iry)
      p.curveTo(cx - irx * k, cy - iry, cx - irx, cy - iry * k, cx - irx, cy)
      p.curveTo(cx - irx, cy + iry * k, cx - irx * k, cy + iry, cx, cy + iry)
      p.lineTo(cx, cy + ry)
      p.close()
    }
    else {
      p.moveTo(cx, cy - ry)
      p.lineTo(cx, cy + ry)
      p.curveTo(cx - rx * k, cy + ry, cx - rx, cy + ry * k, cx - rx, cy)
      p.curveTo(cx - rx, cy - ry * k, cx - rx * k, cy - ry, cx, cy - ry)
      p.close()
    }
  }
  else if (side === 'top') {
    if (hollow) {
      p.moveTo(cx + rx, cy)
      p.curveTo(cx + rx, cy + ry * k, cx + rx * k, cy + ry, cx, cy + ry)
      p.curveTo(cx - rx * k, cy + ry, cx - rx, cy + ry * k, cx - rx, cy)
      p.lineTo(cx - irx, cy)
      p.curveTo(cx - irx, cy + iry * k, cx - irx * k, cy + iry, cx, cy + iry)
      p.curveTo(cx + irx * k, cy + iry, cx + irx, cy + iry * k, cx + irx, cy)
      p.lineTo(cx + rx, cy)
      p.close()
    }
    else {
      p.moveTo(cx + rx, cy)
      p.curveTo(cx + rx, cy + ry * k, cx + rx * k, cy + ry, cx, cy + ry)
      p.curveTo(cx - rx * k, cy + ry, cx - rx, cy + ry * k, cx - rx, cy)
      p.lineTo(cx + rx, cy)
      p.close()
    }
  }
  else {
    if (hollow) {
      p.moveTo(cx - rx, cy)
      p.curveTo(cx - rx, cy - ry * k, cx - rx * k, cy - ry, cx, cy - ry)
      p.curveTo(cx + rx * k, cy - ry, cx + rx, cy - ry * k, cx + rx, cy)
      p.lineTo(cx + irx, cy)
      p.curveTo(cx + irx, cy - iry * k, cx + irx * k, cy - iry, cx, cy - iry)
      p.curveTo(cx - irx * k, cy - iry, cx - irx, cy - iry * k, cx - irx, cy)
      p.lineTo(cx - rx, cy)
      p.close()
    }
    else {
      p.moveTo(cx - rx, cy)
      p.curveTo(cx - rx, cy - ry * k, cx - rx * k, cy - ry, cx, cy - ry)
      p.curveTo(cx + rx * k, cy - ry, cx + rx, cy - ry * k, cx - rx, cy)
      p.close()
    }
  }
}

/**
 * Simple straight-sided stem with rounded endcaps. Never tapers; never
 * produces self-intersecting polygons.
 */
function stem(p: opentype.Path, cx: number, y0: number, y1: number, w = STROKE, caps: 'both' | 'top' | 'bot' | 'none' = 'both') {
  rect(p, cx - w / 2, y0, w, y1 - y0)
  if (caps === 'both' || caps === 'bot') ellipse(p, cx, y0, w / 2, w / 2)
  if (caps === 'both' || caps === 'top') ellipse(p, cx, y1, w / 2, w / 2)
}

/** Horizontal stem (bar). */
function hstem(p: opentype.Path, x0: number, x1: number, cy: number, w = STROKE, caps: 'both' | 'left' | 'right' | 'none' = 'both') {
  rect(p, x0, cy - w / 2, x1 - x0, w)
  if (caps === 'both' || caps === 'left') ellipse(p, x0, cy, w / 2, w / 2)
  if (caps === 'both' || caps === 'right') ellipse(p, x1, cy, w / 2, w / 2)
}

/**
 * Exit hairline on the right of lowercase letters — a small rising
 * stub at the baseline that connects the letter to the one following.
 * Starts at the baseline (y=0) so it stays hooked to the letter body
 * and rises to the x-height to form an entry for the next glyph.
 */
function exitTail(p: opentype.Path, xStem: number, yStem: number, dx = 85, dy = 50) {
  const x0 = xStem
  const y0 = Math.max(yStem, 0)
  const x1 = x0 + dx
  const y1 = y0 + dy
  legStroke(p, x0, x1, y0, y1, THIN * 0.9)
}

/**
 * Oval bowl with inner counter — draws a filled ellipse minus a smaller
 * inner hole, giving a clean ring with uniform-ish stroke. Uses `ellipse`
 * primitive only.
 */
function ovalBowl(p: opentype.Path, cx: number, cy: number, rx: number, ry: number, w = STROKE) {
  ellipse(p, cx, cy, rx, ry)
  const irx = Math.max(1, rx - w)
  const iry = Math.max(1, ry - w * 0.9)
  ellipse(p, cx, cy, irx, iry, true)
}

// ---------------------------------------------------------------------------
// Glyph drawers
// ---------------------------------------------------------------------------

interface GlyphResult { advance: number }
type Drawer = (p: opentype.Path) => GlyphResult

const LC_W = 480          // default lowercase advance body width
const WIDE = 620
const NARROW = 340
const CAP_LSB = 40
const CAP_RSB = 40
const CAP_W = 720

// ---------------------------------------------------------------------------
// Lowercase
// ---------------------------------------------------------------------------

// a — oval bowl + right stem
const a: Drawer = (p) => {
  const w = LC_W
  const bowlRX = (w - STROKE) / 2 - 20
  const bowlCX = LSB + bowlRX + 10
  const bowlCY = XH / 2
  const bowlRY = XH / 2
  ovalBowl(p, bowlCX, bowlCY, bowlRX, bowlRY, STROKE)
  // right stem
  const stemX = bowlCX + bowlRX - STROKE / 2
  stem(p, stemX, 0, XH, STROKE)
  // exit tail
  exitTail(p, stemX + STROKE / 2, STROKE * 0.3, 70, 0)
  return { advance: LSB + w + RSB }
}

// b — ascender stem + bowl bottom-right
const b: Drawer = (p) => {
  const w = LC_W
  const stemX = LSB + STROKE / 2
  stem(p, stemX, 0, ASC - 30, STROKE)
  const bowlRX = (w - STROKE) / 2 - 10
  const bowlCX = stemX + bowlRX + STROKE / 2 - 5
  const bowlCY = XH / 2
  ovalBowl(p, bowlCX, bowlCY, bowlRX, XH / 2, STROKE)
  exitTail(p, bowlCX + bowlRX - STROKE / 4, bowlCY - XH / 2 + STROKE * 0.3, 70, 0)
  return { advance: LSB + w + RSB }
}

// c — open left half ring
const c: Drawer = (p) => {
  const w = LC_W - 40
  const rx = (w - STROKE) / 2
  const cx = LSB + rx + STROKE / 2
  const cy = XH / 2
  halfRing(p, cx, cy, rx, XH / 2, STROKE, 'left')
  // top arm stub
  hstem(p, cx, cx + rx * 0.4, XH - STROKE / 2, STROKE, 'right')
  // bottom arm stub
  hstem(p, cx, cx + rx * 0.4, STROKE / 2, STROKE, 'right')
  exitTail(p, cx + rx * 0.4 + STROKE / 2, STROKE * 0.4, 70, 0)
  return { advance: LSB + w + RSB }
}

// d — bowl + right ascender stem
const d: Drawer = (p) => {
  const w = LC_W
  const bowlRX = (w - STROKE) / 2 - 15
  const bowlCX = LSB + bowlRX + STROKE / 2
  const bowlCY = XH / 2
  ovalBowl(p, bowlCX, bowlCY, bowlRX, XH / 2, STROKE)
  const stemX = bowlCX + bowlRX - STROKE / 2
  stem(p, stemX, 0, ASC - 30, STROKE)
  exitTail(p, stemX + STROKE / 2, STROKE * 0.3, 70, 0)
  return { advance: LSB + w + RSB }
}

// e — loop with horizontal bar across the middle
const e: Drawer = (p) => {
  const w = LC_W - 30
  const rx = (w - STROKE) / 2
  const cx = LSB + rx + STROKE / 2
  const cy = XH / 2
  ovalBowl(p, cx, cy, rx, XH / 2, STROKE)
  // crossbar inside
  rect(p, cx - rx + STROKE * 0.4, cy - THIN / 2, rx * 2 - STROKE * 0.8, THIN)
  exitTail(p, cx + rx - STROKE * 0.2, STROKE * 0.3, 70, 0)
  return { advance: LSB + w + RSB }
}

// f — tall stem with crossbar + descender
const f: Drawer = (p) => {
  const w = NARROW + 30
  const stemX = LSB + STROKE / 2 + 20
  stem(p, stemX, DESC + 20, ASC - 30, STROKE)
  // crossbar near x-height
  hstem(p, stemX - STROKE * 1.0, stemX + STROKE * 1.0, XH - STROKE / 2, THIN)
  exitTail(p, stemX + STROKE / 2, STROKE * 0.3, 70, 0)
  return { advance: LSB + w + RSB }
}

// g — bowl + descender stem curving to the left
const g: Drawer = (p) => {
  const w = LC_W
  const bowlRX = (w - STROKE) / 2 - 10
  const bowlCX = LSB + bowlRX + STROKE / 2
  ovalBowl(p, bowlCX, XH / 2, bowlRX, XH / 2, STROKE)
  const stemX = bowlCX + bowlRX - STROKE / 2
  stem(p, stemX, DESC / 2, XH, STROKE)
  // descender hook curving to the left
  halfRing(p, stemX - 70, DESC / 2, 70, 60, STROKE, 'bottom')
  return { advance: LSB + w + RSB }
}

// h — tall stem + arch
const h: Drawer = (p) => {
  const w = LC_W + 20
  const stemX = LSB + STROKE / 2
  stem(p, stemX, 0, ASC - 30, STROKE)
  // arch to right stem
  const rightStemX = stemX + (w - STROKE) - 10
  stem(p, rightStemX, 0, XH - STROKE / 2, STROKE)
  // arch connector (ellipse-based)
  const archCX = (stemX + rightStemX) / 2
  const archRX = (rightStemX - stemX) / 2
  halfRing(p, archCX, XH - STROKE / 2, archRX, STROKE * 1.2, STROKE, 'top')
  exitTail(p, rightStemX + STROKE / 2, STROKE * 0.3, 70, 0)
  return { advance: LSB + w + RSB }
}

// i — short stem + dot
const i: Drawer = (p) => {
  const w = NARROW - 40
  const stemX = LSB + STROKE / 2 + 30
  stem(p, stemX, 0, XH, STROKE)
  // dot above
  ellipse(p, stemX + 15, XH + 70, STROKE * 0.55, STROKE * 0.55)
  exitTail(p, stemX + STROKE / 2, STROKE * 0.3, 65, 0)
  return { advance: LSB + w + RSB }
}

// j — stem with descender + dot above x-height
const j_lc: Drawer = (p) => {
  const w = NARROW - 30
  const stemX = LSB + STROKE / 2 + 30
  stem(p, stemX, DESC / 2, XH, STROKE)
  // hook at bottom curving left
  halfRing(p, stemX - 60, DESC / 2, 60, 50, STROKE, 'bottom')
  // dot above
  ellipse(p, stemX + 20, XH + 80, STROKE * 0.55, STROKE * 0.55)
  return { advance: LSB + w + RSB }
}

// k — ascender stem + diagonals
const k: Drawer = (p) => {
  const w = LC_W
  const stemX = LSB + STROKE / 2
  stem(p, stemX, 0, ASC - 30, STROKE)
  // upper diagonal: from mid-x-height on stem up-right
  legStroke(p, stemX + STROKE / 2, LSB + w - 30, XH * 0.4, XH, THIN)
  // lower diagonal
  legStroke(p, stemX + STROKE / 2, LSB + w - 20, XH * 0.4, 0, STROKE * 0.85)
  exitTail(p, LSB + w - 20, STROKE * 0.3, 60, 0)
  return { advance: LSB + w + RSB }
}

// l — tall stem
const l: Drawer = (p) => {
  const w = NARROW
  const stemX = LSB + STROKE / 2 + 20
  stem(p, stemX, 0, ASC - 30, STROKE)
  exitTail(p, stemX + STROKE / 2, STROKE * 0.3, 70, 0)
  return { advance: LSB + w + RSB }
}

// m — 3 stems with 2 arches
const m: Drawer = (p) => {
  const w = 720
  const s1 = LSB + STROKE / 2
  const s2 = s1 + (w - STROKE) / 2
  const s3 = s1 + (w - STROKE)
  stem(p, s1, 0, XH, STROKE)
  stem(p, s2, 0, XH - STROKE / 2, STROKE)
  stem(p, s3, 0, XH - STROKE / 2, STROKE)
  halfRing(p, (s1 + s2) / 2, XH - STROKE / 2, (s2 - s1) / 2, STROKE * 1.2, STROKE, 'top')
  halfRing(p, (s2 + s3) / 2, XH - STROKE / 2, (s3 - s2) / 2, STROKE * 1.2, STROKE, 'top')
  exitTail(p, s3 + STROKE / 2, STROKE * 0.3, 70, 0)
  return { advance: LSB + w + RSB }
}

// n — 2 stems with arch
const n: Drawer = (p) => {
  const w = LC_W + 20
  const s1 = LSB + STROKE / 2
  const s2 = s1 + (w - STROKE)
  stem(p, s1, 0, XH, STROKE)
  stem(p, s2, 0, XH - STROKE / 2, STROKE)
  halfRing(p, (s1 + s2) / 2, XH - STROKE / 2, (s2 - s1) / 2, STROKE * 1.2, STROKE, 'top')
  exitTail(p, s2 + STROKE / 2, STROKE * 0.3, 70, 0)
  return { advance: LSB + w + RSB }
}

// o — oval bowl
const o: Drawer = (p) => {
  const w = LC_W - 20
  const rx = (w - STROKE) / 2
  const cx = LSB + rx + STROKE / 2
  const cy = XH / 2
  ovalBowl(p, cx, cy, rx, XH / 2, STROKE)
  exitTail(p, cx + rx - STROKE * 0.1, cy - STROKE * 0.2, 65, 0)
  return { advance: LSB + w + RSB }
}

// p — descender stem + bowl
const p_lc: Drawer = (p) => {
  const w = LC_W
  const stemX = LSB + STROKE / 2
  stem(p, stemX, DESC + 40, XH, STROKE)
  const bowlRX = (w - STROKE) / 2 - 15
  const bowlCX = stemX + bowlRX + STROKE / 2 - 5
  const bowlCY = XH / 2
  ovalBowl(p, bowlCX, bowlCY, bowlRX, XH / 2, STROKE)
  return { advance: LSB + w + RSB }
}

// q — bowl + right descender stem
const q: Drawer = (p) => {
  const w = LC_W
  const bowlRX = (w - STROKE) / 2 - 15
  const bowlCX = LSB + bowlRX + STROKE / 2
  const bowlCY = XH / 2
  ovalBowl(p, bowlCX, bowlCY, bowlRX, XH / 2, STROKE)
  const stemX = bowlCX + bowlRX - STROKE / 2
  stem(p, stemX, DESC + 40, XH, STROKE)
  return { advance: LSB + w + RSB }
}

// r — short stem + arm flick to upper right
const r: Drawer = (p) => {
  const w = NARROW + 60
  const stemX = LSB + STROKE / 2
  stem(p, stemX, 0, XH, STROKE)
  // arm: short diagonal from stem-top going up-right to a rounded tip
  const armLen = w * 0.55
  legStroke(p, stemX + STROKE / 2, stemX + armLen, XH - STROKE * 0.6, XH - STROKE * 0.1, STROKE * 0.85)
  ellipse(p, stemX + armLen, XH - STROKE * 0.1, STROKE * 0.4, STROKE * 0.4)
  return { advance: LSB + w + RSB }
}

// s — S-curve built from top arc (right-opening), bottom arc (left-opening)
// and a diagonal spine connecting them.
const s: Drawer = (p) => {
  const w = LC_W - 50
  const x0 = LSB
  const rx = (w - STROKE) / 2 - 10
  const cx = x0 + rx + STROKE / 2 + 5
  const ry = XH * 0.26
  // Top bowl: half-ring opening DOWN-RIGHT: draw as left+top arc
  halfRing(p, cx, XH - ry, rx, ry, STROKE, 'top')
  // Bottom bowl: half-ring opening UP-LEFT: draw as right+bottom
  halfRing(p, cx, ry, rx, ry, STROKE, 'bottom')
  // Diagonal spine linking the inner ends
  legStroke(p, cx + rx * 0.6, cx - rx * 0.6, ry, XH - ry, STROKE)
  return { advance: LSB + w + RSB }
}

// t — stem + crossbar (mildly ascender)
const t: Drawer = (p) => {
  const w = NARROW + 30
  const stemX = LSB + STROKE / 2 + 20
  stem(p, stemX, 0, XH + 120, STROKE)
  hstem(p, stemX - STROKE * 1.0, stemX + STROKE * 1.0, XH - STROKE / 2, THIN)
  exitTail(p, stemX + STROKE / 2, STROKE * 0.3, 65, 0)
  return { advance: LSB + w + RSB }
}

// u — 2 stems with bottom loop
const u: Drawer = (p) => {
  const w = LC_W + 20
  const s1 = LSB + STROKE / 2
  const s2 = s1 + (w - STROKE)
  stem(p, s1, STROKE / 2, XH, STROKE)
  stem(p, s2, 0, XH, STROKE)
  halfRing(p, (s1 + s2) / 2, STROKE / 2, (s2 - s1) / 2, STROKE * 1.2, STROKE, 'bottom')
  exitTail(p, s2 + STROKE / 2, STROKE * 0.3, 70, 0)
  return { advance: LSB + w + RSB }
}

// v — two diagonals
const v: Drawer = (p) => {
  const w = LC_W
  const x0 = LSB
  const cx = x0 + w / 2
  legStroke(p, cx, x0 + STROKE / 2, 0, XH, STROKE)
  legStroke(p, cx, x0 + w - STROKE / 2, 0, XH, THIN * 0.9)
  exitTail(p, x0 + w - STROKE / 2, STROKE * 0.3, 65, 0)
  return { advance: LSB + w + RSB }
}

// w — two v's joined
const w_lc: Drawer = (p) => {
  const w = 720
  const x0 = LSB
  const q1 = x0 + w * 0.25
  const q2 = x0 + w * 0.5
  const q3 = x0 + w * 0.75
  legStroke(p, q1, x0 + STROKE / 2, 0, XH, STROKE)
  legStroke(p, q1, q2, 0, XH, THIN * 0.9)
  legStroke(p, q3, q2, 0, XH, STROKE)
  legStroke(p, q3, x0 + w - STROKE / 2, 0, XH, THIN * 0.9)
  exitTail(p, x0 + w - STROKE / 2, STROKE * 0.3, 65, 0)
  return { advance: LSB + w + RSB }
}

// x — crossed diagonals
const x_lc: Drawer = (p) => {
  const w = LC_W
  const x0 = LSB
  legStroke(p, x0 + STROKE / 2, x0 + w - STROKE / 2, 0, XH, STROKE)
  legStroke(p, x0 + w - STROKE / 2, x0 + STROKE / 2, 0, XH, THIN)
  exitTail(p, x0 + w - STROKE / 2, STROKE * 0.3, 60, 0)
  return { advance: LSB + w + RSB }
}

// y — left stem + right stem with descender
const y: Drawer = (p) => {
  const w = LC_W + 20
  const s1 = LSB + STROKE / 2
  const s2 = s1 + (w - STROKE)
  legStroke(p, (s1 + s2) / 2 - 20, s1, 0, XH, STROKE)
  legStroke(p, s2 - 30, s2, DESC + 40, XH, STROKE)
  return { advance: LSB + w + RSB }
}

// z — Z shape
const z: Drawer = (p) => {
  const w = LC_W
  const x0 = LSB
  hstem(p, x0, x0 + w, XH - STROKE / 2, STROKE)
  hstem(p, x0, x0 + w, STROKE / 2, STROKE)
  legStroke(p, x0 + STROKE, x0 + w - STROKE, STROKE, XH - STROKE, STROKE * 0.95)
  exitTail(p, x0 + w - STROKE / 2, STROKE * 0.3, 60, 0)
  return { advance: LSB + w + RSB }
}

// ---------------------------------------------------------------------------
// Uppercase — slightly flourished brush-script caps. Keep simple: an oval
// bowl or stem + stroke, no complex swashes. Height = CAP.
// ---------------------------------------------------------------------------

// A — two diagonals meeting at apex + crossbar
const Acap: Drawer = (p) => {
  const w = CAP_W
  const x0 = CAP_LSB
  const cx = x0 + w / 2
  legStroke(p, x0 + STROKE / 2, cx, 0, CAP, STROKE)
  legStroke(p, x0 + w - STROKE / 2, cx, 0, CAP, THIN)
  hstem(p, x0 + w * 0.22, x0 + w * 0.78, CAP * 0.32, THIN)
  return { advance: CAP_LSB + w + CAP_RSB }
}

// B — vertical stem with two bowls
const Bcap: Drawer = (p) => {
  const w = CAP_W * 0.78
  const stemX = CAP_LSB + STROKE / 2
  stem(p, stemX, 0, CAP, STROKE)
  // upper bowl
  const ub_rx = (w - STROKE) / 2
  const ub_cx = stemX + ub_rx
  ovalBowl(p, ub_cx, CAP * 0.74, ub_rx, CAP * 0.26, STROKE)
  // lower bowl
  const lb_rx = (w - STROKE) / 2 + 20
  const lb_cx = stemX + lb_rx
  ovalBowl(p, lb_cx, CAP * 0.26, lb_rx, CAP * 0.26, STROKE)
  return { advance: CAP_LSB + w + CAP_RSB }
}

// C — open left half-ring, cap-height
const Ccap: Drawer = (p) => {
  const w = CAP_W
  const rx = (w - STROKE) / 2
  const cx = CAP_LSB + rx + STROKE / 2
  const cy = CAP / 2
  halfRing(p, cx, cy, rx, CAP / 2, STROKE, 'left')
  // top and bottom arms
  hstem(p, cx, cx + rx * 0.4, CAP - STROKE / 2, STROKE, 'right')
  hstem(p, cx, cx + rx * 0.4, STROKE / 2, STROKE, 'right')
  return { advance: CAP_LSB + w + CAP_RSB }
}

// D — stem + bowl
const Dcap: Drawer = (p) => {
  const w = CAP_W
  const stemX = CAP_LSB + STROKE / 2
  stem(p, stemX, 0, CAP, STROKE)
  const bowlRX = (w - STROKE) / 2
  const bowlCX = stemX + bowlRX
  ovalBowl(p, bowlCX, CAP / 2, bowlRX, CAP / 2, STROKE)
  return { advance: CAP_LSB + w + CAP_RSB }
}

// E
const Ecap: Drawer = (p) => {
  const w = CAP_W * 0.72
  const stemX = CAP_LSB + STROKE / 2
  stem(p, stemX, 0, CAP, STROKE)
  hstem(p, stemX, CAP_LSB + w, CAP - STROKE / 2, STROKE)
  hstem(p, stemX, CAP_LSB + w, STROKE / 2, STROKE)
  hstem(p, stemX, CAP_LSB + w * 0.78, CAP / 2, THIN)
  return { advance: CAP_LSB + w + CAP_RSB }
}

// F
const Fcap: Drawer = (p) => {
  const w = CAP_W * 0.70
  const stemX = CAP_LSB + STROKE / 2
  stem(p, stemX, 0, CAP, STROKE)
  hstem(p, stemX, CAP_LSB + w, CAP - STROKE / 2, STROKE)
  hstem(p, stemX, CAP_LSB + w * 0.78, CAP / 2, THIN)
  return { advance: CAP_LSB + w + CAP_RSB }
}

// G
const Gcap: Drawer = (p) => {
  const w = CAP_W
  const rx = (w - STROKE) / 2
  const cx = CAP_LSB + rx + STROKE / 2
  const cy = CAP / 2
  halfRing(p, cx, cy, rx, CAP / 2, STROKE, 'left')
  hstem(p, cx, cx + rx * 0.4, CAP - STROKE / 2, STROKE, 'right')
  hstem(p, cx, cx + rx * 0.4, STROKE / 2, STROKE, 'right')
  // inward spur
  stem(p, cx + rx * 0.4, CAP * 0.3, CAP * 0.55, STROKE)
  hstem(p, cx + rx * 0.15, cx + rx * 0.5, CAP * 0.42, STROKE)
  return { advance: CAP_LSB + w + CAP_RSB }
}

// H
const Hcap: Drawer = (p) => {
  const w = CAP_W * 0.85
  const s1 = CAP_LSB + STROKE / 2
  const s2 = s1 + (w - STROKE)
  stem(p, s1, 0, CAP, STROKE)
  stem(p, s2, 0, CAP, STROKE)
  hstem(p, s1, s2, CAP / 2, STROKE)
  return { advance: CAP_LSB + w + CAP_RSB }
}

// I
const Icap: Drawer = (p) => {
  const w = NARROW - 40
  const stemX = CAP_LSB + w / 2
  stem(p, stemX, 0, CAP, STROKE)
  return { advance: CAP_LSB + w + CAP_RSB }
}

// J
const Jcap: Drawer = (p) => {
  const w = CAP_W * 0.55
  const stemX = CAP_LSB + STROKE / 2 + w * 0.3
  stem(p, stemX, STROKE * 0.5, CAP, STROKE)
  halfRing(p, stemX - (w * 0.3), STROKE * 0.5, w * 0.3, STROKE * 1.1, STROKE, 'bottom')
  return { advance: CAP_LSB + w + CAP_RSB }
}

// K
const Kcap: Drawer = (p) => {
  const w = CAP_W * 0.85
  const stemX = CAP_LSB + STROKE / 2
  stem(p, stemX, 0, CAP, STROKE)
  legStroke(p, stemX + STROKE / 2, CAP_LSB + w - 10, CAP / 2, CAP, THIN)
  legStroke(p, stemX + STROKE / 2, CAP_LSB + w, CAP / 2, 0, STROKE)
  return { advance: CAP_LSB + w + CAP_RSB }
}

// L
const Lcap: Drawer = (p) => {
  const w = CAP_W * 0.68
  const stemX = CAP_LSB + STROKE / 2
  stem(p, stemX, 0, CAP, STROKE)
  hstem(p, stemX, CAP_LSB + w, STROKE / 2, STROKE)
  return { advance: CAP_LSB + w + CAP_RSB }
}

// M
const Mcap: Drawer = (p) => {
  const w = CAP_W * 1.05
  const s1 = CAP_LSB + STROKE / 2
  const s2 = s1 + (w - STROKE)
  const mid = (s1 + s2) / 2
  stem(p, s1, 0, CAP, STROKE)
  stem(p, s2, 0, CAP, STROKE)
  legStroke(p, s1, mid, CAP, CAP * 0.25, THIN)
  legStroke(p, s2, mid, CAP, CAP * 0.25, THIN)
  return { advance: CAP_LSB + w + CAP_RSB }
}

// N
const Ncap: Drawer = (p) => {
  const w = CAP_W * 0.9
  const s1 = CAP_LSB + STROKE / 2
  const s2 = s1 + (w - STROKE)
  stem(p, s1, 0, CAP, STROKE)
  stem(p, s2, 0, CAP, STROKE)
  legStroke(p, s1, s2, CAP, 0, STROKE * 0.85)
  return { advance: CAP_LSB + w + CAP_RSB }
}

// O
const Ocap: Drawer = (p) => {
  const w = CAP_W
  const rx = (w - STROKE) / 2
  const cx = CAP_LSB + rx + STROKE / 2
  ovalBowl(p, cx, CAP / 2, rx, CAP / 2, STROKE)
  return { advance: CAP_LSB + w + CAP_RSB }
}

// P
const Pcap: Drawer = (p) => {
  const w = CAP_W * 0.78
  const stemX = CAP_LSB + STROKE / 2
  stem(p, stemX, 0, CAP, STROKE)
  const bowlRX = (w - STROKE) / 2
  ovalBowl(p, stemX + bowlRX, CAP * 0.72, bowlRX, CAP * 0.28, STROKE)
  return { advance: CAP_LSB + w + CAP_RSB }
}

// Q
const Qcap: Drawer = (p) => {
  const w = CAP_W
  const rx = (w - STROKE) / 2
  const cx = CAP_LSB + rx + STROKE / 2
  ovalBowl(p, cx, CAP / 2, rx, CAP / 2, STROKE)
  // tail
  legStroke(p, cx + rx * 0.3, cx + rx + STROKE, CAP * 0.2, -STROKE, STROKE)
  return { advance: CAP_LSB + w + CAP_RSB }
}

// R
const Rcap: Drawer = (p) => {
  const w = CAP_W * 0.85
  const stemX = CAP_LSB + STROKE / 2
  stem(p, stemX, 0, CAP, STROKE)
  const bowlRX = (w - STROKE) / 2 - 30
  ovalBowl(p, stemX + bowlRX, CAP * 0.72, bowlRX, CAP * 0.28, STROKE)
  legStroke(p, stemX + bowlRX, CAP_LSB + w, CAP * 0.44, 0, STROKE)
  return { advance: CAP_LSB + w + CAP_RSB }
}

// S
const Scap: Drawer = (p) => {
  const w = CAP_W * 0.7
  const x0 = CAP_LSB
  const rx = (w - STROKE) / 2 - 10
  const cx = x0 + rx + STROKE / 2 + 5
  const ry = CAP * 0.26
  halfRing(p, cx, CAP - ry, rx, ry, STROKE, 'top')
  halfRing(p, cx, ry, rx, ry, STROKE, 'bottom')
  legStroke(p, cx + rx * 0.5, cx - rx * 0.5, ry, CAP - ry, STROKE)
  return { advance: CAP_LSB + w + CAP_RSB }
}

// T
const Tcap: Drawer = (p) => {
  const w = CAP_W * 0.85
  const cx = CAP_LSB + w / 2
  stem(p, cx, 0, CAP, STROKE)
  hstem(p, CAP_LSB, CAP_LSB + w, CAP - STROKE / 2, STROKE)
  return { advance: CAP_LSB + w + CAP_RSB }
}

// U
const Ucap: Drawer = (p) => {
  const w = CAP_W * 0.9
  const s1 = CAP_LSB + STROKE / 2
  const s2 = s1 + (w - STROKE)
  stem(p, s1, CAP * 0.3, CAP, STROKE)
  stem(p, s2, 0, CAP, STROKE)
  halfRing(p, (s1 + s2) / 2, CAP * 0.3, (s2 - s1) / 2, CAP * 0.3, STROKE, 'bottom')
  return { advance: CAP_LSB + w + CAP_RSB }
}

// V
const Vcap: Drawer = (p) => {
  const w = CAP_W
  const x0 = CAP_LSB
  const cx = x0 + w / 2
  legStroke(p, cx, x0 + STROKE / 2, 0, CAP, STROKE)
  legStroke(p, cx, x0 + w - STROKE / 2, 0, CAP, THIN)
  return { advance: CAP_LSB + w + CAP_RSB }
}

// W
const Wcap: Drawer = (p) => {
  const w = CAP_W * 1.35
  const x0 = CAP_LSB
  const q1 = x0 + w * 0.25
  const q2 = x0 + w * 0.5
  const q3 = x0 + w * 0.75
  legStroke(p, q1, x0 + STROKE / 2, 0, CAP, STROKE)
  legStroke(p, q1, q2, 0, CAP, THIN)
  legStroke(p, q3, q2, 0, CAP, STROKE)
  legStroke(p, q3, x0 + w - STROKE / 2, 0, CAP, THIN)
  return { advance: CAP_LSB + w + CAP_RSB }
}

// X
const Xcap: Drawer = (p) => {
  const w = CAP_W * 0.85
  const x0 = CAP_LSB
  legStroke(p, x0 + STROKE / 2, x0 + w - STROKE / 2, 0, CAP, STROKE)
  legStroke(p, x0 + w - STROKE / 2, x0 + STROKE / 2, 0, CAP, THIN)
  return { advance: CAP_LSB + w + CAP_RSB }
}

// Y
const Ycap: Drawer = (p) => {
  const w = CAP_W * 0.9
  const x0 = CAP_LSB
  const cx = x0 + w / 2
  legStroke(p, cx, x0 + STROKE / 2, CAP / 2, CAP, STROKE)
  legStroke(p, cx, x0 + w - STROKE / 2, CAP / 2, CAP, THIN)
  stem(p, cx, 0, CAP / 2 + STROKE / 2, STROKE)
  return { advance: CAP_LSB + w + CAP_RSB }
}

// Z
const Zcap: Drawer = (p) => {
  const w = CAP_W * 0.85
  const x0 = CAP_LSB
  hstem(p, x0, x0 + w, CAP - STROKE / 2, STROKE)
  hstem(p, x0, x0 + w, STROKE / 2, STROKE)
  legStroke(p, x0 + STROKE, x0 + w - STROKE, STROKE, CAP - STROKE, STROKE)
  return { advance: CAP_LSB + w + CAP_RSB }
}

// ---------------------------------------------------------------------------
// Digits — simplified
// ---------------------------------------------------------------------------

const dZero: Drawer = (p) => {
  const w = CAP_W * 0.55
  const rx = (w - STROKE) / 2
  const cx = CAP_LSB + rx + STROKE / 2
  ovalBowl(p, cx, CAP / 2, rx, CAP / 2, STROKE)
  return { advance: CAP_LSB + w + CAP_RSB }
}

const dOne: Drawer = (p) => {
  const w = CAP_W * 0.35
  const stemX = CAP_LSB + w / 2
  stem(p, stemX, 0, CAP, STROKE)
  legStroke(p, stemX - w * 0.35, stemX, CAP * 0.78, CAP, THIN)
  hstem(p, stemX - w * 0.3, stemX + w * 0.3, STROKE / 2, STROKE)
  return { advance: CAP_LSB + w + CAP_RSB }
}

const dTwo: Drawer = (p) => {
  const w = CAP_W * 0.55
  const x0 = CAP_LSB
  const rx = (w - STROKE) / 2
  halfRing(p, x0 + rx + STROKE / 2, CAP * 0.72, rx, CAP * 0.28, STROKE, 'top')
  legStroke(p, x0 + w - STROKE / 2, x0 + STROKE / 2, CAP * 0.5, STROKE, STROKE)
  hstem(p, x0, x0 + w, STROKE / 2, STROKE)
  return { advance: CAP_LSB + w + CAP_RSB }
}

const dThree: Drawer = (p) => {
  const w = CAP_W * 0.55
  const x0 = CAP_LSB
  const rx = (w - STROKE) / 2
  const cx = x0 + rx + STROKE / 2
  halfRing(p, cx, CAP * 0.72, rx, CAP * 0.28, STROKE, 'right')
  halfRing(p, cx, CAP * 0.28, rx, CAP * 0.28, STROKE, 'right')
  return { advance: CAP_LSB + w + CAP_RSB }
}

const dFour: Drawer = (p) => {
  const w = CAP_W * 0.6
  const x0 = CAP_LSB
  stem(p, x0 + w - STROKE, 0, CAP, STROKE)
  legStroke(p, x0 + STROKE / 2, x0 + w - STROKE, CAP * 0.35, CAP, STROKE)
  hstem(p, x0, x0 + w, CAP * 0.35, STROKE)
  return { advance: CAP_LSB + w + CAP_RSB }
}

const dFive: Drawer = (p) => {
  const w = CAP_W * 0.55
  const x0 = CAP_LSB
  const rx = (w - STROKE) / 2
  const cx = x0 + rx + STROKE / 2
  halfRing(p, cx, CAP * 0.3, rx, CAP * 0.3, STROKE, 'right')
  stem(p, x0 + STROKE / 2, CAP * 0.6, CAP, STROKE)
  hstem(p, x0 + STROKE / 2, x0 + w, CAP - STROKE / 2, STROKE)
  return { advance: CAP_LSB + w + CAP_RSB }
}

const dSix: Drawer = (p) => {
  const w = CAP_W * 0.55
  const x0 = CAP_LSB
  const rx = (w - STROKE) / 2
  const cx = x0 + rx + STROKE / 2
  ovalBowl(p, cx, CAP * 0.3, rx, CAP * 0.3, STROKE)
  legStroke(p, cx, cx + rx * 0.6, CAP * 0.3 + STROKE / 2, CAP, STROKE)
  return { advance: CAP_LSB + w + CAP_RSB }
}

const dSeven: Drawer = (p) => {
  const w = CAP_W * 0.55
  const x0 = CAP_LSB
  hstem(p, x0, x0 + w, CAP - STROKE / 2, STROKE)
  legStroke(p, x0 + w - STROKE, x0 + STROKE, CAP - STROKE, 0, STROKE)
  return { advance: CAP_LSB + w + CAP_RSB }
}

const dEight: Drawer = (p) => {
  const w = CAP_W * 0.55
  const x0 = CAP_LSB
  const rx = (w - STROKE) / 2
  const cx = x0 + rx + STROKE / 2
  ovalBowl(p, cx, CAP * 0.72, rx, CAP * 0.28, STROKE)
  ovalBowl(p, cx, CAP * 0.28, rx, CAP * 0.28, STROKE)
  return { advance: CAP_LSB + w + CAP_RSB }
}

const dNine: Drawer = (p) => {
  const w = CAP_W * 0.55
  const x0 = CAP_LSB
  const rx = (w - STROKE) / 2
  const cx = x0 + rx + STROKE / 2
  ovalBowl(p, cx, CAP * 0.7, rx, CAP * 0.3, STROKE)
  legStroke(p, cx, cx - rx * 0.6, CAP * 0.7 - STROKE / 2, 0, STROKE)
  return { advance: CAP_LSB + w + CAP_RSB }
}

// ---------------------------------------------------------------------------
// Punctuation
// ---------------------------------------------------------------------------

const dPeriod: Drawer = (p) => {
  const r = STROKE * 0.55
  const w = r * 5
  ellipse(p, w / 2, r, r, r)
  return { advance: w }
}

const dComma: Drawer = (p) => {
  const r = STROKE * 0.55
  const w = r * 5
  ellipse(p, w / 2, r, r, r)
  legStroke(p, w / 2, w / 2 - r * 0.8, r, DESC * 0.4, r * 1.2)
  return { advance: w }
}

const dColon: Drawer = (p) => {
  const r = STROKE * 0.55
  const w = r * 5
  ellipse(p, w / 2, r, r, r)
  ellipse(p, w / 2, XH - r, r, r)
  return { advance: w }
}

const dSemicolon: Drawer = (p) => {
  const r = STROKE * 0.55
  const w = r * 5
  ellipse(p, w / 2, XH - r, r, r)
  ellipse(p, w / 2, r, r, r)
  legStroke(p, w / 2, w / 2 - r * 0.8, r, DESC * 0.4, r * 1.2)
  return { advance: w }
}

const dExclam: Drawer = (p) => {
  const w = NARROW * 0.6
  const cx = CAP_LSB + w / 2
  stem(p, cx, XH * 0.45, CAP, STROKE * 0.9)
  ellipse(p, cx, STROKE * 0.55, STROKE * 0.55, STROKE * 0.55)
  return { advance: CAP_LSB + w + CAP_RSB }
}

const dQuestion: Drawer = (p) => {
  const w = CAP_W * 0.5
  const x0 = CAP_LSB
  const rx = (w - STROKE) / 2
  const cx = x0 + rx + STROKE / 2
  halfRing(p, cx, CAP * 0.75, rx, CAP * 0.2, STROKE, 'top')
  stem(p, cx + rx * 0.1, CAP * 0.35, CAP * 0.55, STROKE)
  ellipse(p, cx + rx * 0.1, STROKE * 0.55, STROKE * 0.55, STROKE * 0.55)
  return { advance: CAP_LSB + w + CAP_RSB }
}

const dHyphen: Drawer = (p) => {
  const w = CAP_W * 0.4
  const adv = CAP_LSB + w + CAP_RSB
  hstem(p, CAP_LSB, CAP_LSB + w, XH * 0.5, STROKE * 0.95)
  return { advance: adv }
}

const dApostrophe: Drawer = (p) => {
  const w = NARROW * 0.5
  const cx = CAP_LSB + w / 2
  legStroke(p, cx, cx - 5, CAP * 0.72, CAP * 0.98, STROKE * 1.1)
  return { advance: CAP_LSB + w + CAP_RSB }
}

const dQuotedbl: Drawer = (p) => {
  const w = NARROW * 0.8
  const cx0 = CAP_LSB + w * 0.3
  const cx1 = CAP_LSB + w * 0.7
  legStroke(p, cx0, cx0 - 5, CAP * 0.72, CAP * 0.98, STROKE * 1.1)
  legStroke(p, cx1, cx1 - 5, CAP * 0.72, CAP * 0.98, STROKE * 1.1)
  return { advance: CAP_LSB + w + CAP_RSB }
}

const dAmpersand: Drawer = (p) => {
  const w = CAP_W * 0.9
  const x0 = CAP_LSB
  // a simple flattened "&" — two stacked ovals linked by a diagonal
  ovalBowl(p, x0 + w * 0.3, CAP * 0.75, w * 0.22, CAP * 0.2, STROKE)
  ovalBowl(p, x0 + w * 0.42, CAP * 0.28, w * 0.3, CAP * 0.25, STROKE)
  legStroke(p, x0 + w * 0.18, x0 + w * 0.88, CAP * 0.1, CAP * 0.55, STROKE * 0.9)
  return { advance: CAP_LSB + w + CAP_RSB }
}

const dParenLeft: Drawer = (p) => {
  const w = NARROW * 0.55
  const adv = CAP_LSB + w + CAP_RSB
  halfRing(p, CAP_LSB + w, CAP * 0.45, w * 0.85, CAP * 0.6, STROKE * 0.9, 'left')
  return { advance: adv }
}

const dParenRight: Drawer = (p) => {
  const w = NARROW * 0.55
  const adv = CAP_LSB + w + CAP_RSB
  halfRing(p, CAP_LSB, CAP * 0.45, w * 0.85, CAP * 0.6, STROKE * 0.9, 'right')
  return { advance: adv }
}

const dSlash: Drawer = (p) => {
  const w = CAP_W * 0.5
  const adv = CAP_LSB + w + CAP_RSB
  legStroke(p, CAP_LSB, CAP_LSB + w, -STROKE * 0.5, CAP, STROKE)
  return { advance: adv }
}

const dMiddot: Drawer = (p) => {
  const r = STROKE * 0.55
  const adv = r * 5
  ellipse(p, adv / 2, XH * 0.5, r, r)
  return { advance: adv }
}

const dEmdash: Drawer = (p) => {
  const w = CAP
  const adv = CAP_LSB + w + CAP_RSB
  hstem(p, CAP_LSB, CAP_LSB + w, XH * 0.5, STROKE * 0.95)
  return { advance: adv }
}

// ---------------------------------------------------------------------------
// Ligatures — draw each as a combined glyph (same shapes but tucked closer)
// ---------------------------------------------------------------------------

const ooLig: Drawer = (p) => {
  const w = LC_W - 20
  const rx = (w - STROKE) / 2
  const cx1 = LSB + rx + STROKE / 2
  const cx2 = cx1 + w - 20    // slightly tucked
  ovalBowl(p, cx1, XH / 2, rx, XH / 2, STROKE)
  ovalBowl(p, cx2, XH / 2, rx, XH / 2, STROKE)
  exitTail(p, cx2 + rx - STROKE * 0.1, XH / 2 - STROKE * 0.2, 65, 0)
  return { advance: LSB + (cx2 + rx + STROKE / 2 - LSB) + RSB - 20 }
}

const llLig: Drawer = (p) => {
  const w = NARROW
  const s1 = LSB + STROKE / 2 + 20
  const s2 = s1 + (w - 20)
  stem(p, s1, 0, ASC - 30, STROKE)
  stem(p, s2, 0, ASC - 30, STROKE)
  exitTail(p, s2 + STROKE / 2, STROKE * 0.3, 70, 0)
  return { advance: LSB + (s2 - LSB) + RSB + 40 }
}

const ttLig: Drawer = (p) => {
  const s1 = LSB + STROKE / 2 + 20
  const s2 = s1 + NARROW - 10
  stem(p, s1, 0, XH + 120, STROKE)
  stem(p, s2, 0, XH + 120, STROKE)
  // shared crossbar
  hstem(p, s1 - STROKE * 1.0, s2 + STROKE * 1.0, XH - STROKE / 2, THIN)
  exitTail(p, s2 + STROKE / 2, STROKE * 0.3, 65, 0)
  return { advance: LSB + (s2 - LSB) + RSB + 30 }
}

const eeLig: Drawer = (p) => {
  const w = LC_W - 30
  const rx = (w - STROKE) / 2
  const cx1 = LSB + rx + STROKE / 2
  const cx2 = cx1 + w - 20
  const cy = XH / 2
  ovalBowl(p, cx1, cy, rx, XH / 2, STROKE)
  rect(p, cx1 - rx + STROKE * 0.4, cy - THIN / 2, rx * 2 - STROKE * 0.8, THIN)
  ovalBowl(p, cx2, cy, rx, XH / 2, STROKE)
  rect(p, cx2 - rx + STROKE * 0.4, cy - THIN / 2, rx * 2 - STROKE * 0.8, THIN)
  exitTail(p, cx2 + rx - STROKE * 0.2, STROKE * 0.3, 70, 0)
  return { advance: LSB + (cx2 + rx + STROKE / 2 - LSB) + RSB - 20 }
}

const ssLig: Drawer = (p) => {
  const w = LC_W - 60
  const rx = (w - STROKE) / 2
  const cx1 = LSB + rx + STROKE / 2
  const cx2 = cx1 + w - 10
  const ry = XH * 0.28
  halfRing(p, cx1, XH * 0.72, rx, ry, STROKE, 'top')
  halfRing(p, cx1, XH * 0.28, rx, ry, STROKE, 'bottom')
  rect(p, cx1 - STROKE * 0.3, XH * 0.3, STROKE * 0.8, XH * 0.4)
  halfRing(p, cx2, XH * 0.72, rx, ry, STROKE, 'top')
  halfRing(p, cx2, XH * 0.28, rx, ry, STROKE, 'bottom')
  rect(p, cx2 - STROKE * 0.3, XH * 0.3, STROKE * 0.8, XH * 0.4)
  exitTail(p, cx2 + rx - STROKE * 0.2, STROKE * 0.3, 65, 0)
  return { advance: LSB + (cx2 + rx + STROKE / 2 - LSB) + RSB - 10 }
}

// ---------------------------------------------------------------------------
// Glyph table
// ---------------------------------------------------------------------------

interface GlyphSpec {
  name: string
  unicode: number | null
  draw: Drawer
}

const GLYPHS: GlyphSpec[] = [
  { name: 'a', unicode: 0x61, draw: a },
  { name: 'b', unicode: 0x62, draw: b },
  { name: 'c', unicode: 0x63, draw: c },
  { name: 'd', unicode: 0x64, draw: d },
  { name: 'e', unicode: 0x65, draw: e },
  { name: 'f', unicode: 0x66, draw: f },
  { name: 'g', unicode: 0x67, draw: g },
  { name: 'h', unicode: 0x68, draw: h },
  { name: 'i', unicode: 0x69, draw: i },
  { name: 'j', unicode: 0x6A, draw: j_lc },
  { name: 'k', unicode: 0x6B, draw: k },
  { name: 'l', unicode: 0x6C, draw: l },
  { name: 'm', unicode: 0x6D, draw: m },
  { name: 'n', unicode: 0x6E, draw: n },
  { name: 'o', unicode: 0x6F, draw: o },
  { name: 'p', unicode: 0x70, draw: p_lc },
  { name: 'q', unicode: 0x71, draw: q },
  { name: 'r', unicode: 0x72, draw: r },
  { name: 's', unicode: 0x73, draw: s },
  { name: 't', unicode: 0x74, draw: t },
  { name: 'u', unicode: 0x75, draw: u },
  { name: 'v', unicode: 0x76, draw: v },
  { name: 'w', unicode: 0x77, draw: w_lc },
  { name: 'x', unicode: 0x78, draw: x_lc },
  { name: 'y', unicode: 0x79, draw: y },
  { name: 'z', unicode: 0x7A, draw: z },
  { name: 'A', unicode: 0x41, draw: Acap },
  { name: 'B', unicode: 0x42, draw: Bcap },
  { name: 'C', unicode: 0x43, draw: Ccap },
  { name: 'D', unicode: 0x44, draw: Dcap },
  { name: 'E', unicode: 0x45, draw: Ecap },
  { name: 'F', unicode: 0x46, draw: Fcap },
  { name: 'G', unicode: 0x47, draw: Gcap },
  { name: 'H', unicode: 0x48, draw: Hcap },
  { name: 'I', unicode: 0x49, draw: Icap },
  { name: 'J', unicode: 0x4A, draw: Jcap },
  { name: 'K', unicode: 0x4B, draw: Kcap },
  { name: 'L', unicode: 0x4C, draw: Lcap },
  { name: 'M', unicode: 0x4D, draw: Mcap },
  { name: 'N', unicode: 0x4E, draw: Ncap },
  { name: 'O', unicode: 0x4F, draw: Ocap },
  { name: 'P', unicode: 0x50, draw: Pcap },
  { name: 'Q', unicode: 0x51, draw: Qcap },
  { name: 'R', unicode: 0x52, draw: Rcap },
  { name: 'S', unicode: 0x53, draw: Scap },
  { name: 'T', unicode: 0x54, draw: Tcap },
  { name: 'U', unicode: 0x55, draw: Ucap },
  { name: 'V', unicode: 0x56, draw: Vcap },
  { name: 'W', unicode: 0x57, draw: Wcap },
  { name: 'X', unicode: 0x58, draw: Xcap },
  { name: 'Y', unicode: 0x59, draw: Ycap },
  { name: 'Z', unicode: 0x5A, draw: Zcap },
  { name: 'zero', unicode: 0x30, draw: dZero },
  { name: 'one', unicode: 0x31, draw: dOne },
  { name: 'two', unicode: 0x32, draw: dTwo },
  { name: 'three', unicode: 0x33, draw: dThree },
  { name: 'four', unicode: 0x34, draw: dFour },
  { name: 'five', unicode: 0x35, draw: dFive },
  { name: 'six', unicode: 0x36, draw: dSix },
  { name: 'seven', unicode: 0x37, draw: dSeven },
  { name: 'eight', unicode: 0x38, draw: dEight },
  { name: 'nine', unicode: 0x39, draw: dNine },
  { name: 'period', unicode: 0x2E, draw: dPeriod },
  { name: 'comma', unicode: 0x2C, draw: dComma },
  { name: 'colon', unicode: 0x3A, draw: dColon },
  { name: 'semicolon', unicode: 0x3B, draw: dSemicolon },
  { name: 'exclam', unicode: 0x21, draw: dExclam },
  { name: 'question', unicode: 0x3F, draw: dQuestion },
  { name: 'hyphen', unicode: 0x2D, draw: dHyphen },
  { name: 'apostrophe', unicode: 0x27, draw: dApostrophe },
  { name: 'quotedbl', unicode: 0x22, draw: dQuotedbl },
  { name: 'ampersand', unicode: 0x26, draw: dAmpersand },
  { name: 'parenleft', unicode: 0x28, draw: dParenLeft },
  { name: 'parenright', unicode: 0x29, draw: dParenRight },
  { name: 'slash', unicode: 0x2F, draw: dSlash },
  { name: 'middot', unicode: 0x00B7, draw: dMiddot },
  { name: 'emdash', unicode: 0x2014, draw: dEmdash },
  // Ligatures — no unicode, accessed via GSUB
  { name: 'o_o', unicode: null, draw: ooLig },
  { name: 'l_l', unicode: null, draw: llLig },
  { name: 't_t', unicode: null, draw: ttLig },
  { name: 'e_e', unicode: null, draw: eeLig },
  { name: 's_s', unicode: null, draw: ssLig },
]

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

async function build() {
  const notdef = new opentype.Glyph({
    name: '.notdef',
    unicode: 0,
    advanceWidth: LC_W + LSB + RSB,
    path: new opentype.Path(),
  })
  const space = new opentype.Glyph({
    name: 'space',
    unicode: 0x20,
    advanceWidth: Math.round(LC_W * 0.55),
    path: new opentype.Path(),
  })
  ;(space as opentype.Glyph & { unicodes: number[] }).unicodes = [0x20, 0xA0]

  const glyphs: opentype.Glyph[] = [notdef, space]
  const indexByName: Record<string, number> = {}

  // Extra advance to account for shear pushing right edge of glyph further right.
  const SLANT_ADV = SHEAR * CAP * 0.35

  for (const spec of GLYPHS) {
    const path = new opentype.Path()
    const { advance } = spec.draw(path)
    applyShear(path)
    const g = new opentype.Glyph({
      name: spec.name,
      unicode: spec.unicode ?? 0,
      advanceWidth: advance + SLANT_ADV,
      path,
    })
    indexByName[spec.name] = glyphs.length
    glyphs.push(g)
  }

  const font = new opentype.Font({
    familyName: 'Campmate Script',
    styleName: 'Regular',
    unitsPerEm: UPM,
    ascender: ASC,
    descender: DESC,
    designer: 'NPS Fonts contributors',
    designerURL: 'https://github.com/stacksjs/nps-fonts',
    manufacturer: 'NPS Fonts',
    license: 'This Font Software is licensed under the SIL Open Font License, Version 1.1.',
    licenseURL: 'https://openfontlicense.org',
    version: '0.8.0',
    description: 'Campmate Script — USFS wood-sign brush-script, connected cursive italic with ligatures.',
    copyright: 'Copyright (c) 2026, NPS Fonts contributors. With Reserved Font Name "Campmate Script".',
    trademark: '',
    glyphs,
  })

  if (font.tables.os2) {
    font.tables.os2.usWeightClass = 400
    font.tables.os2.achVendID = 'NPSF'
    font.tables.os2.fsSelection = 0x41  // italic + regular
  }
  if (font.tables.post) {
    font.tables.post.italicAngle = -SLANT_DEG
  }

  // GSUB `liga`
  const ligaturePairs: [string, string, string][] = [
    ['o', 'o', 'o_o'],
    ['l', 'l', 'l_l'],
    ['t', 't', 't_t'],
    ['e', 'e', 'e_e'],
    ['s', 's', 's_s'],
  ]
  const sub = font.substitution as unknown as {
    add: (feature: string, entry: { sub: number[], by: number }) => void
  }
  for (const [a, b, lig] of ligaturePairs) {
    sub.add('liga', {
      sub: [indexByName[a]!, indexByName[b]!],
      by: indexByName[lig]!,
    })
  }

  const otfBuf = Buffer.from(font.toArrayBuffer() as ArrayBuffer)

  await mkdir(resolve(FONTS_DIR, 'otf'), { recursive: true })
  await mkdir(resolve(FONTS_DIR, 'ttf'), { recursive: true })
  await mkdir(resolve(FONTS_DIR, 'woff'), { recursive: true })
  await mkdir(resolve(FONTS_DIR, 'woff2'), { recursive: true })

  await writeFile(resolve(FONTS_DIR, 'otf', 'CampmateScript-Regular.otf'), otfBuf)
  await writeFile(resolve(FONTS_DIR, 'ttf', 'CampmateScript-Regular.ttf'), otfBuf)
  await writeFile(resolve(FONTS_DIR, 'woff', 'CampmateScript-Regular.woff'), sfntToWoff(otfBuf))
  const woff2Buf = Buffer.from(await wawoff2.compress(otfBuf))
  await writeFile(resolve(FONTS_DIR, 'woff2', 'CampmateScript-Regular.woff2'), woff2Buf)

  console.log(`Campmate Script: ${GLYPHS.length} glyphs (${ligaturePairs.length} ligatures) · ${(otfBuf.length / 1024).toFixed(1)}KB OTF`)
}

await build()
