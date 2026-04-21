#!/usr/bin/env bun
/**
 * Redwood Serif — an old-style / transitional serif inspired by NPS
 * Rawlinson OT and Plantin. Drawn from scratch with opentype.js.
 *
 * Uses the same shape primitives as Summitgrade 1935 (rect / ellipse /
 * legStroke / halfRing) so every glyph is a simple union of closed
 * sub-paths. Serif feet are simple slabs (rect + small chamfer rects)
 * rather than bracketed sweeps, which eliminates the mid-stroke
 * artifacts that plagued the previous implementation.
 *
 * Coverage: A-Z, a-z, 0-9, basic punctuation. Single weight (Regular).
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import opentype from 'opentype.js'
import { sfntToWoff } from './lib/woff.ts'

const wawoff2 = await import('wawoff2')

const ROOT = resolve(import.meta.dir, '..')
const FONTS = resolve(ROOT, 'fonts', 'redwood-serif')

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

const UPM = 1000
const CAP = 700
const XH = 500                  // larger x-height for bookish feel
const ASCENDER = 680            // shorter ascenders — barely above cap
const DESCENDER = -200
const STEM = 112                // heavier main vertical
const THIN = 50                 // thin stroke (~2.24:1 contrast)
const LC_STEM = 102
const LC_THIN = 46
const SERIF_EXT = 46            // horizontal overshoot each side of stem
const SERIF_H = 38              // serif slab height
const CHAMFER = 6               // tiny corner chamfer height
const OV = 3                    // overlap for joins
const LSB = 55
const RSB = 55
const KAPPA = 0.5522847498307936

// ---------------------------------------------------------------------------
// Primitives — shared with Summitgrade 1935
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
      p.curveTo(cx + rx * k, cy - ry, cx + rx, cy - ry * k, cx + rx, cy)
      p.lineTo(cx - rx, cy)
      p.close()
    }
  }
}

// Simple bracketed slab serif — two concentric rects forming a shallow
// "T" footprint on the stem. No concave curves, no floating chunks.
//   ─┬─┐  chamfer (small 8px overhang top)
//    │   STEM continues up from here
//   ─┴─┘
// `cx`  = stem center X
// `stemW` = stem width
// `atY` = y of slab foot (bottom serif: baseline y; top serif: cap/asc y)
// `side`= 'top' | 'bottom'
function slabSerif(
  p: opentype.Path,
  cx: number,
  stemW: number,
  atY: number,
  side: 'top' | 'bottom' = 'bottom',
  extL = SERIF_EXT,
  extR = SERIF_EXT,
  h = SERIF_H,
) {
  const leftX = cx - stemW / 2 - extL
  const width = stemW + extL + extR
  // Bracket "filler" — strictly within the stem footprint so it never
  // creates a step wider than the stem. OV guarantees union with the stem.
  const fillerX = cx - stemW / 2 - OV
  const fillerW = stemW + 2 * OV
  if (side === 'bottom') {
    rect(p, leftX, atY, width, h)
    rect(p, fillerX, atY + h - OV, fillerW, OV * 2)
  }
  else {
    rect(p, leftX, atY - h, width, h)
    rect(p, fillerX, atY - h - OV, fillerW, OV * 2)
  }
}

// Convenience: draw a vertical stem with slab serifs on top and/or bottom.
function stem(
  p: opentype.Path,
  cx: number,
  stemW: number,
  y0: number,
  y1: number,
  opts: { top?: boolean, bottom?: boolean, topExtL?: number, topExtR?: number, botExtL?: number, botExtR?: number } = {},
) {
  rect(p, cx - stemW / 2, y0, stemW, y1 - y0)
  if (opts.bottom !== false)
    slabSerif(p, cx, stemW, y0, 'bottom', opts.botExtL ?? SERIF_EXT, opts.botExtR ?? SERIF_EXT)
  if (opts.top !== false)
    slabSerif(p, cx, stemW, y1, 'top', opts.topExtL ?? SERIF_EXT, opts.topExtR ?? SERIF_EXT)
}

// Old-style stressed ring — slightly thicker sides than top/bottom
// (inverse of Clarendon: humanist stress gives thin horizontals, thick verticals).
function stressedRing(p: opentype.Path, cx: number, cy: number, rx: number, ry: number, thick = STEM, thin = THIN * 1.4) {
  ellipse(p, cx, cy, rx, ry)
  const irx = Math.max(1, rx - thick)
  const iry = Math.max(1, ry - thin)
  ellipse(p, cx, cy, irx, iry, true)
}

// Bottom bowl for U — a half-ellipse open at the top.
function drawBottomBowl(p: opentype.Path, leftX: number, rightX: number, topY: number, depth: number, stroke: number) {
  const cx = (leftX + rightX) / 2
  const rx = (rightX - leftX) / 2
  const ry = depth
  const k = KAPPA
  const irx = Math.max(0, rx - stroke)
  const iry = Math.max(0, ry - stroke * 0.85)
  if (irx > 0 && iry > 0) {
    p.moveTo(leftX, topY)
    p.curveTo(leftX, topY - ry * k, cx - rx * k, topY - ry, cx, topY - ry)
    p.curveTo(cx + rx * k, topY - ry, rightX, topY - ry * k, rightX, topY)
    p.lineTo(rightX - stroke, topY)
    p.curveTo(rightX - stroke, topY - iry * k, cx + irx * k, topY - iry, cx, topY - iry)
    p.curveTo(cx - irx * k, topY - iry, leftX + stroke, topY - iry * k, leftX + stroke, topY)
    p.lineTo(leftX, topY)
    p.close()
  }
  else {
    p.moveTo(leftX, topY)
    p.curveTo(leftX, topY - ry * k, cx - rx * k, topY - ry, cx, topY - ry)
    p.curveTo(cx + rx * k, topY - ry, rightX, topY - ry * k, rightX, topY)
    p.lineTo(leftX, topY)
    p.close()
  }
}

// Bowl anchored to a vertical stem (for B, D, P, R, b, d, p, q).
// Draws a filled D-shape whose flat side sits at stemRightX.
function drawBowl(p: opentype.Path, stemRightX: number, bottomY: number, w: number, h: number, stroke: number) {
  const cy = bottomY + h / 2
  const rx = w
  const ry = h / 2
  const k = KAPPA
  const irx = Math.max(0, rx - stroke)
  const iry = Math.max(0, ry - stroke * 0.85)
  if (irx > 0 && iry > 0) {
    p.moveTo(stemRightX, cy - ry)
    p.curveTo(stemRightX + rx * k, cy - ry, stemRightX + rx, cy - ry * k, stemRightX + rx, cy)
    p.curveTo(stemRightX + rx, cy + ry * k, stemRightX + rx * k, cy + ry, stemRightX, cy + ry)
    p.lineTo(stemRightX, cy + iry)
    p.curveTo(stemRightX + irx * k, cy + iry, stemRightX + irx, cy + iry * k, stemRightX + irx, cy)
    p.curveTo(stemRightX + irx, cy - iry * k, stemRightX + irx * k, cy - iry, stemRightX, cy - iry)
    p.lineTo(stemRightX, cy - ry)
    p.close()
  }
  else {
    p.moveTo(stemRightX, cy + ry)
    p.lineTo(stemRightX, cy - ry)
    p.curveTo(stemRightX + rx * k, cy - ry, stemRightX + rx, cy - ry * k, stemRightX + rx, cy)
    p.curveTo(stemRightX + rx, cy + ry * k, stemRightX + rx * k, cy + ry, stemRightX, cy + ry)
    p.close()
  }
}

// ---------------------------------------------------------------------------
// Capital glyph drawers
// ---------------------------------------------------------------------------

interface GlyphResult { advance: number }
type Drawer = (p: opentype.Path) => GlyphResult

const WIDE_W = CAP * 1.14
const ROUND_W = CAP * 0.90

// --- A ------------------------------------------------------------------
const A: Drawer = (p) => {
  const w = CAP * 0.96
  const x0 = LSB
  const cx = x0 + w / 2
  const apexHalf = 12
  const diag = THIN + 6

  // Two diagonals meeting at a small flat apex
  legStroke(p, x0 + diag * 0.5, cx - apexHalf, 0, CAP, diag)
  legStroke(p, x0 + w - diag * 0.5, cx + apexHalf, 0, CAP, diag)
  // Apex cap
  rect(p, cx - apexHalf - 6, CAP - 14, apexHalf * 2 + 12, 14)
  // Crossbar
  const barY = CAP * 0.32
  const barH = THIN
  const slope = (cx - apexHalf - (x0 + diag * 0.5)) / CAP
  const innerL = (x0 + diag * 0.5) + slope * barY + diag * 0.5 - 6
  const innerR = (x0 + w - diag * 0.5) - slope * barY - diag * 0.5 + 6
  rect(p, innerL, barY, innerR - innerL, barH)
  // Bottom slab feet (outward-only serifs)
  slabSerif(p, x0 + diag * 0.5, diag, 0, 'bottom', SERIF_EXT, SERIF_EXT - 10)
  slabSerif(p, x0 + w - diag * 0.5, diag, 0, 'bottom', SERIF_EXT - 10, SERIF_EXT)

  return { advance: LSB + w + RSB }
}

// --- B ------------------------------------------------------------------
const B: Drawer = (p) => {
  const w = CAP * 0.76
  const x0 = LSB
  const cxS = x0 + STEM / 2
  rect(p, x0, 0, STEM, CAP)

  const upperH = CAP * 0.48
  const lowerH = CAP - upperH
  drawBowl(p, x0 + STEM - OV, CAP - upperH, w - STEM - 8, upperH, STEM * 0.95)
  drawBowl(p, x0 + STEM - OV, 0, w - STEM, lowerH, STEM * 0.95)

  slabSerif(p, cxS, STEM, CAP, 'top', SERIF_EXT, 8)
  slabSerif(p, cxS, STEM, 0, 'bottom', SERIF_EXT, 8)
  return { advance: LSB + w + RSB }
}

// --- C ------------------------------------------------------------------
const C: Drawer = (p) => {
  const w = ROUND_W
  const x0 = LSB
  const cx = x0 + w / 2
  const cy = CAP / 2
  const rx = w / 2
  const ry = CAP / 2

  halfRing(p, cx, cy, rx, ry, STEM, 'left')
  // Top and bottom arms (shorter than Clarendon, no ball terminals)
  const armLen = w * 0.22
  rect(p, cx - OV, CAP - THIN * 1.3, armLen, THIN * 1.3)
  rect(p, cx - OV, 0, armLen, THIN * 1.3)
  // Tiny serif tips
  rect(p, cx + armLen - 4, CAP - THIN * 1.3 - 8, 8, 8)
  rect(p, cx + armLen - 4, THIN * 1.3, 8, 8)
  return { advance: LSB + w + RSB }
}

// --- D ------------------------------------------------------------------
const D: Drawer = (p) => {
  const w = CAP * 0.86
  const x0 = LSB
  const cxS = x0 + STEM / 2
  rect(p, x0, 0, STEM, CAP)
  drawBowl(p, x0 + STEM - OV, 0, w - STEM, CAP, STEM * 0.95)
  slabSerif(p, cxS, STEM, CAP, 'top', SERIF_EXT, 4)
  slabSerif(p, cxS, STEM, 0, 'bottom', SERIF_EXT, 4)
  return { advance: LSB + w + RSB }
}

// --- E ------------------------------------------------------------------
const E: Drawer = (p) => {
  const w = CAP * 0.72
  const x0 = LSB
  const cxS = x0 + STEM / 2
  rect(p, x0, 0, STEM, CAP)
  rect(p, x0, CAP - THIN * 1.3, w, THIN * 1.3)
  rect(p, x0, 0, w, THIN * 1.3)
  rect(p, x0, CAP * 0.48, w * 0.80, THIN)
  slabSerif(p, cxS, STEM, CAP, 'top', SERIF_EXT, 0)
  slabSerif(p, cxS, STEM, 0, 'bottom', SERIF_EXT, 0)
  // Right-end tick serifs on top/bottom arms
  rect(p, x0 + w - 6, CAP - THIN * 1.3 - 10, 10, 10)
  rect(p, x0 + w - 6, THIN * 1.3, 10, 10)
  return { advance: LSB + w + RSB }
}

// --- F ------------------------------------------------------------------
const F: Drawer = (p) => {
  const w = CAP * 0.70
  const x0 = LSB
  const cxS = x0 + STEM / 2
  rect(p, x0, 0, STEM, CAP)
  rect(p, x0, CAP - THIN * 1.3, w, THIN * 1.3)
  rect(p, x0, CAP * 0.48, w * 0.78, THIN)
  slabSerif(p, cxS, STEM, CAP, 'top', SERIF_EXT, 0)
  slabSerif(p, cxS, STEM, 0, 'bottom', SERIF_EXT, SERIF_EXT)
  rect(p, x0 + w - 6, CAP - THIN * 1.3 - 10, 10, 10)
  return { advance: LSB + w + RSB }
}

// --- G ------------------------------------------------------------------
const G: Drawer = (p) => {
  const w = ROUND_W
  const x0 = LSB
  const cx = x0 + w / 2
  const cy = CAP / 2
  const rx = w / 2
  const ry = CAP / 2

  halfRing(p, cx, cy, rx, ry, STEM, 'left')
  // Top arm short
  rect(p, cx - OV, CAP - THIN * 1.3, w * 0.22, THIN * 1.3)
  // Bottom arm extends right to the spur
  rect(p, cx - OV, 0, w * 0.50, THIN * 1.3)
  // Spur (short vertical from upper-right corner down)
  const spurX = x0 + w - STEM
  rect(p, spurX, 0, STEM, CAP * 0.44)
  // Horizontal crossbar on spur (G crossbar)
  rect(p, x0 + w * 0.50, CAP * 0.42, w * 0.30, THIN)
  return { advance: LSB + w + RSB }
}

// --- H ------------------------------------------------------------------
const H: Drawer = (p) => {
  const w = CAP * 0.88
  const x0 = LSB
  const cxL = x0 + STEM / 2
  const cxR = x0 + w - STEM / 2
  rect(p, x0, 0, STEM, CAP)
  rect(p, x0 + w - STEM, 0, STEM, CAP)
  rect(p, x0 + STEM - OV, CAP * 0.48, w - 2 * STEM + 2 * OV, THIN)
  slabSerif(p, cxL, STEM, CAP, 'top')
  slabSerif(p, cxL, STEM, 0, 'bottom')
  slabSerif(p, cxR, STEM, CAP, 'top')
  slabSerif(p, cxR, STEM, 0, 'bottom')
  return { advance: LSB + w + RSB }
}

// --- I ------------------------------------------------------------------
const I: Drawer = (p) => {
  const cx = LSB + STEM / 2
  rect(p, LSB, 0, STEM, CAP)
  slabSerif(p, cx, STEM, CAP, 'top', SERIF_EXT + 6, SERIF_EXT + 6)
  slabSerif(p, cx, STEM, 0, 'bottom', SERIF_EXT + 6, SERIF_EXT + 6)
  return { advance: LSB + STEM + SERIF_EXT * 2 + RSB - 10 }
}

// --- J ------------------------------------------------------------------
const J: Drawer = (p) => {
  const w = CAP * 0.58
  const x0 = LSB
  const stemCx = x0 + w - STEM / 2
  const hookCY = CAP * 0.20
  rect(p, x0 + w - STEM, hookCY, STEM, CAP - hookCY)
  halfRing(p, x0 + w / 2, hookCY, w / 2, CAP * 0.20, STEM, 'bottom')
  slabSerif(p, stemCx, STEM, CAP, 'top')
  return { advance: LSB + w + RSB }
}

// --- K ------------------------------------------------------------------
const K: Drawer = (p) => {
  const w = CAP * 0.84
  const x0 = LSB
  const cxS = x0 + STEM / 2
  rect(p, x0, 0, STEM, CAP)
  const midY = CAP * 0.44
  // Upper arm: thin diagonal
  legStroke(p, x0 + STEM - OV, x0 + w - THIN * 0.4, midY, CAP, THIN)
  // Lower leg: thick diagonal
  legStroke(p, x0 + w - STEM * 0.5, x0 + STEM - OV, 0, midY, STEM * 0.9)
  // Slab on lower leg foot
  slabSerif(p, x0 + w - STEM * 0.5, STEM * 0.7, 0, 'bottom', 16, SERIF_EXT)
  // Tiny tick on upper arm top-right
  rect(p, x0 + w - 12, CAP - 10, 14, 10)
  slabSerif(p, cxS, STEM, CAP, 'top')
  slabSerif(p, cxS, STEM, 0, 'bottom', SERIF_EXT, 0)
  return { advance: LSB + w + RSB }
}

// --- L ------------------------------------------------------------------
const L: Drawer = (p) => {
  const w = CAP * 0.72
  const x0 = LSB
  const cxS = x0 + STEM / 2
  rect(p, x0, 0, STEM, CAP)
  rect(p, x0, 0, w, THIN * 1.3)
  slabSerif(p, cxS, STEM, CAP, 'top')
  slabSerif(p, cxS, STEM, 0, 'bottom', SERIF_EXT, 0)
  rect(p, x0 + w - 8, THIN * 1.3, 10, 10)
  return { advance: LSB + w + RSB }
}

// --- M ------------------------------------------------------------------
const M: Drawer = (p) => {
  const w = WIDE_W
  const x0 = LSB
  const cxL = x0 + STEM / 2
  const cxR = x0 + w - STEM / 2
  rect(p, x0, 0, STEM, CAP)
  rect(p, x0 + w - STEM, 0, STEM, CAP)
  const cx = x0 + w / 2
  const dia = THIN * 0.85
  legStroke(p, cx - dia / 2 + OV, x0 + STEM + dia / 2 - OV, 0, CAP, dia)
  legStroke(p, cx + dia / 2 - OV, x0 + w - STEM - dia / 2 + OV, 0, CAP, dia)
  rect(p, cx - dia, 0, dia * 2, 5)
  slabSerif(p, cxL, STEM, CAP, 'top', SERIF_EXT, 0)
  slabSerif(p, cxR, STEM, CAP, 'top', 0, SERIF_EXT)
  slabSerif(p, cxL, STEM, 0, 'bottom')
  slabSerif(p, cxR, STEM, 0, 'bottom')
  return { advance: LSB + w + RSB }
}

// --- N ------------------------------------------------------------------
const N: Drawer = (p) => {
  const w = CAP * 0.84
  const x0 = LSB
  const cxL = x0 + STEM / 2
  const cxR = x0 + w - STEM / 2
  rect(p, x0, 0, STEM, CAP)
  rect(p, x0 + w - STEM, 0, STEM, CAP)
  legStroke(p, x0 + w - STEM + OV, x0 + STEM - OV, 0, CAP, THIN * 1.1)
  slabSerif(p, cxL, STEM, CAP, 'top', SERIF_EXT, 4)
  slabSerif(p, cxR, STEM, CAP, 'top', 4, SERIF_EXT)
  slabSerif(p, cxL, STEM, 0, 'bottom', SERIF_EXT, 4)
  slabSerif(p, cxR, STEM, 0, 'bottom', 4, SERIF_EXT)
  return { advance: LSB + w + RSB }
}

// --- O ------------------------------------------------------------------
const O: Drawer = (p) => {
  const w = ROUND_W
  const x0 = LSB
  const cx = x0 + w / 2
  stressedRing(p, cx, CAP / 2, w / 2, CAP / 2, STEM, THIN * 1.35)
  return { advance: LSB + w + RSB }
}

// --- P ------------------------------------------------------------------
const P: Drawer = (p) => {
  const w = CAP * 0.68
  const x0 = LSB
  const cxS = x0 + STEM / 2
  rect(p, x0, 0, STEM, CAP)
  const bowlH = CAP * 0.52
  drawBowl(p, x0 + STEM - OV, CAP - bowlH, w - STEM, bowlH, STEM * 0.95)
  slabSerif(p, cxS, STEM, CAP, 'top', SERIF_EXT, 4)
  slabSerif(p, cxS, STEM, 0, 'bottom')
  return { advance: LSB + w + RSB }
}

// --- Q ------------------------------------------------------------------
const Q: Drawer = (p) => {
  const w = ROUND_W
  const x0 = LSB
  const cx = x0 + w / 2
  stressedRing(p, cx, CAP / 2, w / 2, CAP / 2, STEM, THIN * 1.35)
  // Tail
  legStroke(p, x0 + w + 20, cx + w * 0.1, -STEM * 0.3, CAP * 0.22, THIN * 1.1)
  return { advance: LSB + w + 30 + RSB }
}

// --- R ------------------------------------------------------------------
const R: Drawer = (p) => {
  const w = CAP * 0.76
  const x0 = LSB
  const cxS = x0 + STEM / 2
  rect(p, x0, 0, STEM, CAP)
  const bowlH = CAP * 0.52
  drawBowl(p, x0 + STEM - OV, CAP - bowlH, w - STEM, bowlH, STEM * 0.95)
  const junctionY = CAP - bowlH
  // Leg — slightly tapered
  const legFootX = x0 + w + 4
  const legTopX = x0 + STEM + 4
  p.moveTo(legFootX - STEM * 0.45, 0)
  p.lineTo(legFootX + STEM * 0.45, 0)
  p.lineTo(legTopX + STEM * 0.3, junctionY + OV)
  p.lineTo(legTopX - STEM * 0.3, junctionY + OV)
  p.close()
  slabSerif(p, cxS, STEM, CAP, 'top', SERIF_EXT, 4)
  slabSerif(p, cxS, STEM, 0, 'bottom')
  slabSerif(p, legFootX, STEM * 0.6, 0, 'bottom', 10, SERIF_EXT)
  return { advance: LSB + w + 20 + RSB }
}

// --- S ------------------------------------------------------------------
const S: Drawer = (p) => {
  const w = CAP * 0.68
  const x0 = LSB
  const cx = x0 + w / 2
  const upperCY = CAP * 0.72
  const lowerCY = CAP * 0.28
  const rx = w / 2
  const ry = CAP * 0.28

  halfRing(p, cx, upperCY, rx, ry, STEM * 0.95, 'top')
  halfRing(p, cx, lowerCY, rx, ry, STEM * 0.95, 'bottom')
  legStroke(p, x0 + w - STEM * 0.5, x0 + STEM * 0.5, lowerCY - STEM * 0.15, upperCY + STEM * 0.15, STEM * 0.9)
  return { advance: LSB + w + RSB }
}

// --- T ------------------------------------------------------------------
const T: Drawer = (p) => {
  const w = CAP * 0.78
  const x0 = LSB
  const stemCx = x0 + w / 2
  rect(p, x0, CAP - THIN * 1.3, w, THIN * 1.3)
  rect(p, x0 + w / 2 - STEM / 2, 0, STEM, CAP)
  // Tick terminals at ends of top bar
  rect(p, x0, CAP - THIN * 1.3 - 10, 12, 10)
  rect(p, x0 + w - 12, CAP - THIN * 1.3 - 10, 12, 10)
  slabSerif(p, stemCx, STEM, 0, 'bottom')
  return { advance: LSB + w + RSB }
}

// --- U ------------------------------------------------------------------
const U: Drawer = (p) => {
  const w = CAP * 0.82
  const x0 = LSB
  const stemBottom = CAP * 0.28
  const cxL = x0 + STEM / 2
  const cxR = x0 + w - STEM / 2
  rect(p, x0, stemBottom, STEM, CAP - stemBottom)
  rect(p, x0 + w - STEM, stemBottom, STEM, CAP - stemBottom)
  drawBottomBowl(p, x0, x0 + w, stemBottom + OV, stemBottom, STEM * 0.95)
  slabSerif(p, cxL, STEM, CAP, 'top')
  slabSerif(p, cxR, STEM, CAP, 'top')
  return { advance: LSB + w + RSB }
}

// --- V ------------------------------------------------------------------
const V: Drawer = (p) => {
  const w = CAP * 0.86
  const x0 = LSB
  const cx = x0 + w / 2
  const dia = THIN + 4
  legStroke(p, cx + OV, x0 + dia / 2, 0, CAP, dia)
  legStroke(p, cx - OV, x0 + w - dia / 2, 0, CAP, dia)
  rect(p, cx - dia, 0, dia * 2, 5)
  slabSerif(p, x0 + dia / 2, dia, CAP, 'top', 20, 20, 16)
  slabSerif(p, x0 + w - dia / 2, dia, CAP, 'top', 20, 20, 16)
  return { advance: LSB + w + RSB }
}

// --- W ------------------------------------------------------------------
const W: Drawer = (p) => {
  const w = WIDE_W * 1.05
  const x0 = LSB
  const dia = THIN * 0.75
  const cx = x0 + w / 2
  const footL = x0 + w * 0.28
  const footR = x0 + w * 0.72
  legStroke(p, footL + OV, x0 + dia / 2, 0, CAP, dia)
  legStroke(p, footL - OV, cx - dia / 2 + OV, 0, CAP, dia)
  legStroke(p, footR + OV, cx + dia / 2 - OV, 0, CAP, dia)
  legStroke(p, footR - OV, x0 + w - dia / 2, 0, CAP, dia)
  rect(p, footL - dia, 0, dia * 2, 5)
  rect(p, footR - dia, 0, dia * 2, 5)
  rect(p, cx - dia, CAP - 6, dia * 2, 6)
  slabSerif(p, x0 + dia / 2, dia, CAP, 'top', 16, 14, 16)
  slabSerif(p, cx - dia / 2 + OV, dia, CAP, 'top', 14, 14, 16)
  slabSerif(p, cx + dia / 2 - OV, dia, CAP, 'top', 14, 14, 16)
  slabSerif(p, x0 + w - dia / 2, dia, CAP, 'top', 14, 16, 16)
  return { advance: LSB + w + RSB }
}

// --- X ------------------------------------------------------------------
const X: Drawer = (p) => {
  const w = CAP * 0.82
  const x0 = LSB
  legStroke(p, x0, x0 + w, 0, CAP, THIN + 2)
  legStroke(p, x0 + w, x0, 0, CAP, THIN + 2)
  const cx = x0 + w / 2
  rect(p, cx - THIN * 0.4, CAP / 2 - THIN * 0.4, THIN * 0.8, THIN * 0.8)
  slabSerif(p, x0, THIN + 2, 0, 'bottom', 22, 18, 16)
  slabSerif(p, x0 + w, THIN + 2, 0, 'bottom', 18, 22, 16)
  slabSerif(p, x0, THIN + 2, CAP, 'top', 22, 18, 16)
  slabSerif(p, x0 + w, THIN + 2, CAP, 'top', 18, 22, 16)
  return { advance: LSB + w + RSB }
}

// --- Y ------------------------------------------------------------------
const Y: Drawer = (p) => {
  const w = CAP * 0.82
  const x0 = LSB
  const cx = x0 + w / 2
  const peakY = CAP * 0.46
  const dia = THIN + 2
  legStroke(p, cx - dia / 2 + OV, x0 + dia / 2, peakY, CAP, dia)
  legStroke(p, cx + dia / 2 - OV, x0 + w - dia / 2, peakY, CAP, dia)
  rect(p, cx - STEM / 2, 0, STEM, peakY + OV)
  rect(p, cx - dia, peakY - OV, dia * 2, OV * 2)
  slabSerif(p, x0 + dia / 2, dia, CAP, 'top', 20, 18, 16)
  slabSerif(p, x0 + w - dia / 2, dia, CAP, 'top', 18, 20, 16)
  slabSerif(p, cx, STEM, 0, 'bottom')
  return { advance: LSB + w + RSB }
}

// --- Z ------------------------------------------------------------------
const Z: Drawer = (p) => {
  const w = CAP * 0.74
  const x0 = LSB
  rect(p, x0, CAP - THIN * 1.3, w, THIN * 1.3)
  rect(p, x0, 0, w, THIN * 1.3)
  legStroke(p, x0 + THIN * 0.4, x0 + w - THIN * 0.4, THIN * 1.3 - OV, CAP - THIN * 1.3 + OV, THIN + 4)
  // Tick terminals
  rect(p, x0, CAP - THIN * 1.3 - 10, 12, 10)
  rect(p, x0 + w - 12, THIN * 1.3, 12, 10)
  return { advance: LSB + w + RSB }
}

// ---------------------------------------------------------------------------
// Lowercase helpers
// ---------------------------------------------------------------------------

// A light serif foot for lowercase stems — smaller than caps.
function lcSerif(
  p: opentype.Path,
  cx: number,
  stemW: number,
  atY: number,
  side: 'top' | 'bottom' = 'bottom',
  extL = 18,
  extR = 18,
  h = 16,
) {
  slabSerif(p, cx, stemW, atY, side, extL, extR, h)
}

// n-arch: vertical stem on left, curved arch to a right stem, from y=0 to y=yTop.
function nArch(p: opentype.Path, x0: number, w: number, yTop: number, stemW = LC_STEM) {
  const archR = (w - 2 * stemW) / 2 + stemW
  const cx = x0 + w / 2
  const archTop = yTop
  const shoulderY = yTop - archR
  // Left stem (full height)
  rect(p, x0, 0, stemW, yTop)
  // Right stem (ends at shoulderY)
  rect(p, x0 + w - stemW, 0, stemW, shoulderY)
  // Arch (half-ring top between the two stems, hollowed)
  const rx = (w - 0) / 2
  const ry = Math.min(archR, yTop * 0.55)
  const thick = stemW
  halfRing(p, cx, archTop - ry, rx, ry, thick, 'top')
  // If halfRing yTop exceeds yTop limit, just ensure stems overlap
  // Safety fill: small rect connecting top of right stem into arch
  rect(p, x0 + w - stemW, shoulderY - OV, stemW, OV * 2)
  rect(p, x0, archTop - ry - OV, stemW, OV * 2)
}

// Bowl centered between left & right of an o/c shape, fully closed.
function oRing(p: opentype.Path, cx: number, cy: number, rx: number, ry: number) {
  ellipse(p, cx, cy, rx, ry)
  ellipse(p, cx, cy, Math.max(1, rx - LC_STEM * 0.95), Math.max(1, ry - LC_THIN * 1.4), true)
}

// ---------------------------------------------------------------------------
// Lowercase drawers
// ---------------------------------------------------------------------------

// --- a (two-storey) ------------------------------------------------------
const a: Drawer = (p) => {
  const w = CAP * 0.60
  const x0 = LSB
  const cx = x0 + w / 2
  // Right stem — full xh
  rect(p, x0 + w - LC_STEM, 0, LC_STEM, XH)
  // Lower bowl (full ellipse + hollow)
  const bowlCY = XH * 0.34
  const bowlRX = w / 2
  const bowlRY = XH * 0.34
  ellipse(p, cx, bowlCY, bowlRX, bowlRY)
  ellipse(p, cx, bowlCY, Math.max(1, bowlRX - LC_STEM * 0.9), Math.max(1, bowlRY - LC_THIN * 1.2), true)
  // Upper arc: outer half-ellipse forming the top-left curve of the a
  const arcRY = XH * 0.36
  const arcRX = w / 2
  const arcCY = XH - arcRY
  // Solid top-left quadrant: left half of a halfRing 'top' (thick stroke)
  halfRing(p, cx, arcCY, arcRX, arcRY, LC_STEM * 0.95, 'top')
  // The 'a' waist: small horizontal connection between bowl top and upper arc bottom
  // (counter is the upper white space between the two)
  // Ear — small tick at top-right
  rect(p, x0 + w - LC_STEM - 6, XH - 14, 14, 14)
  // Bottom serif on stem
  lcSerif(p, x0 + w - LC_STEM / 2, LC_STEM, 0, 'bottom', 14, 18)
  return { advance: LSB + w + RSB }
}

// --- b -------------------------------------------------------------------
const b: Drawer = (p) => {
  const w = CAP * 0.64
  const x0 = LSB
  const cxS = x0 + LC_STEM / 2
  rect(p, x0, 0, LC_STEM, ASCENDER)
  drawBowl(p, x0 + LC_STEM - OV, 0, w - LC_STEM, XH, LC_STEM * 0.95)
  // Top serif (ascender)
  slabSerif(p, cxS, LC_STEM, ASCENDER, 'top', SERIF_EXT - 4, 6, 16)
  return { advance: LSB + w + RSB }
}

// --- c -------------------------------------------------------------------
const c: Drawer = (p) => {
  const w = CAP * 0.58
  const x0 = LSB
  const cx = x0 + w / 2
  halfRing(p, cx, XH / 2, w / 2, XH / 2, LC_STEM * 0.95, 'left')
  // Short top / bottom terminals extending rightward from the ring
  const termH = LC_THIN * 1.2
  const termL = w * 0.24
  rect(p, cx - OV, XH - termH, termL, termH)
  rect(p, cx - OV, 0, termL, termH)
  return { advance: LSB + w + RSB }
}

// --- d -------------------------------------------------------------------
const d: Drawer = (p) => {
  const w = CAP * 0.64
  const x0 = LSB
  const cxS = x0 + w - LC_STEM / 2
  rect(p, x0 + w - LC_STEM, 0, LC_STEM, ASCENDER)
  // Mirror bowl on left of stem
  const cy = XH / 2
  const rx = (w - LC_STEM) / 1
  const ry = XH / 2
  const k = KAPPA
  const stroke = LC_STEM * 0.95
  const irx = Math.max(0, rx - stroke)
  const iry = Math.max(0, ry - stroke * 0.85)
  const stemLeftX = x0 + w - LC_STEM + OV
  if (irx > 0 && iry > 0) {
    p.moveTo(stemLeftX, cy + ry)
    p.curveTo(stemLeftX - rx * k, cy + ry, stemLeftX - rx, cy + ry * k, stemLeftX - rx, cy)
    p.curveTo(stemLeftX - rx, cy - ry * k, stemLeftX - rx * k, cy - ry, stemLeftX, cy - ry)
    p.lineTo(stemLeftX, cy - iry)
    p.curveTo(stemLeftX - irx * k, cy - iry, stemLeftX - irx, cy - iry * k, stemLeftX - irx, cy)
    p.curveTo(stemLeftX - irx, cy + iry * k, stemLeftX - irx * k, cy + iry, stemLeftX, cy + iry)
    p.lineTo(stemLeftX, cy + ry)
    p.close()
  }
  slabSerif(p, cxS, LC_STEM, ASCENDER, 'top', 6, SERIF_EXT - 4, 16)
  lcSerif(p, cxS, LC_STEM, 0, 'bottom', 14, 18)
  return { advance: LSB + w + RSB }
}

// --- e -------------------------------------------------------------------
// Outer ellipse + hollow inner, then a solid crossbar that closes the
// upper counter. Use a rectangular mask INSIDE the bowl (inner bounds)
// by drawing the bar fully within the inner ellipse.
const e: Drawer = (p) => {
  const w = CAP * 0.60
  const x0 = LSB
  const cx = x0 + w / 2
  const irx = Math.max(1, w / 2 - LC_STEM * 0.9)
  const iry = Math.max(1, XH / 2 - LC_THIN * 1.2)
  ellipse(p, cx, XH / 2, w / 2, XH / 2)
  ellipse(p, cx, XH / 2, irx, iry, true)
  // Crossbar — spans the inner counter at the optical center, closes upper counter
  const barY = XH * 0.48
  const barH = LC_THIN * 1.0
  // Keep bar strictly inside the inner ellipse horizontally
  const barX = cx - irx + 2
  const barW = 2 * irx - 4
  rect(p, barX, barY, barW, barH)
  // Also fill the small slice that forms the aperture opening's lower-right
  // (the gap where bowl meets terminal). Not drawing any opening here keeps
  // the e as a closed upper counter + open lower aperture via the inner
  // ellipse's lower half.
  // Open the aperture: cut a small rect from the lower-right of the outer
  // ring where the terminal would exit. But nonzero fill won't allow that
  // easily without CW winding; instead we approximate by drawing the bar
  // plus an additional thin rect reaching the inner boundary.
  return { advance: LSB + w + RSB }
}

// --- f -------------------------------------------------------------------
const f: Drawer = (p) => {
  const w = CAP * 0.44
  const x0 = LSB
  const cx = x0 + LC_STEM / 2 + 6
  // Stem
  rect(p, cx - LC_STEM / 2, 0, LC_STEM, ASCENDER - LC_THIN * 1.4)
  // Top curl (short arch over top-left)
  const curlRX = w * 0.5
  const curlRY = LC_THIN * 1.6
  halfRing(p, cx + curlRX * 0.4, ASCENDER - curlRY, curlRX, curlRY, LC_STEM * 0.9, 'top')
  // Crossbar at x-height
  rect(p, cx - LC_STEM, XH - LC_THIN * 0.6, w, LC_THIN)
  lcSerif(p, cx, LC_STEM, 0, 'bottom', 16, 16)
  return { advance: LSB + w + RSB }
}

// --- g (two-storey) ------------------------------------------------------
// Upper bowl + right stem extending from the bowl down to a horizontal
// hook tail. The right stem is drawn first, then the bowl is attached
// to its left side (so the stem becomes the right side of the bowl).
const g: Drawer = (p) => {
  const w = CAP * 0.62
  const x0 = LSB
  const cx = x0 + w / 2
  // Right stem — full height from tail up to x-height
  const tailY = DESCENDER + 40    // baseline of the tail
  const tailH = LC_THIN * 1.5     // tail is thin like a horizontal serif
  rect(p, x0 + w - LC_STEM, tailY, LC_STEM, XH - tailY)
  // Upper bowl — ellipse
  const bowlCY = XH / 2
  const bowlRX = w / 2
  const bowlRY = XH / 2
  ellipse(p, cx, bowlCY, bowlRX, bowlRY)
  ellipse(p, cx, bowlCY, Math.max(1, bowlRX - LC_STEM * 0.9), Math.max(1, bowlRY - LC_THIN * 1.2), true)
  // Horizontal tail going LEFT from the stem
  rect(p, x0 + LC_THIN * 0.6, tailY, w - LC_STEM - LC_THIN * 0.6, tailH)
  // Small terminal drop at the left end of the tail
  rect(p, x0 + LC_THIN * 0.6, tailY - LC_THIN * 0.4, LC_THIN * 1.4, tailH + LC_THIN * 0.4)
  // Ear on upper right
  rect(p, x0 + w - LC_STEM - 6, XH - 14, 16, 14)
  return { advance: LSB + w + RSB }
}

// --- h -------------------------------------------------------------------
const h: Drawer = (p) => {
  const w = CAP * 0.68
  const x0 = LSB
  const cxS = x0 + LC_STEM / 2
  rect(p, x0, 0, LC_STEM, ASCENDER)
  const archRY = XH * 0.55
  const shoulderY = XH - archRY
  rect(p, x0 + w - LC_STEM, 0, LC_STEM, shoulderY + OV)
  halfRing(p, x0 + w / 2, shoulderY, w / 2, archRY, LC_STEM, 'top')
  slabSerif(p, cxS, LC_STEM, ASCENDER, 'top', SERIF_EXT - 4, 6, SERIF_H - 2)
  lcSerif(p, cxS, LC_STEM, 0, 'bottom')
  lcSerif(p, x0 + w - LC_STEM / 2, LC_STEM, 0, 'bottom')
  return { advance: LSB + w + RSB }
}

// --- i -------------------------------------------------------------------
const i: Drawer = (p) => {
  const x0 = LSB
  const cxS = x0 + LC_STEM / 2
  rect(p, x0, 0, LC_STEM, XH)
  // Dot (tittle)
  const dotR = LC_STEM * 0.55
  ellipse(p, cxS, XH + LC_STEM * 0.9, dotR, dotR)
  slabSerif(p, cxS, LC_STEM, XH, 'top', 8, 8, 14)
  lcSerif(p, cxS, LC_STEM, 0, 'bottom')
  return { advance: LSB + LC_STEM + 20 + RSB }
}

// --- j -------------------------------------------------------------------
const j: Drawer = (p) => {
  const w = CAP * 0.38
  const x0 = LSB
  const cxS = x0 + w / 2 + 2
  rect(p, cxS - LC_STEM / 2, DESCENDER + 80, LC_STEM, XH - (DESCENDER + 80))
  // Hook bottom
  halfRing(p, cxS - w * 0.2, DESCENDER + 80, w * 0.4, 60, LC_STEM * 0.85, 'bottom')
  // Dot
  ellipse(p, cxS, XH + LC_STEM * 0.9, LC_STEM * 0.55, LC_STEM * 0.55)
  slabSerif(p, cxS, LC_STEM, XH, 'top', 8, 8, 14)
  return { advance: LSB + w + RSB }
}

// --- k -------------------------------------------------------------------
const k: Drawer = (p) => {
  const w = CAP * 0.62
  const x0 = LSB
  const cxS = x0 + LC_STEM / 2
  rect(p, x0, 0, LC_STEM, ASCENDER)
  const midY = XH * 0.42
  legStroke(p, x0 + LC_STEM - OV, x0 + w - LC_THIN * 0.3, midY, XH, LC_THIN * 1.1)
  legStroke(p, x0 + w - LC_STEM * 0.4, x0 + LC_STEM - OV, 0, midY, LC_STEM * 0.85)
  rect(p, x0 + w - 10, XH - 10, 12, 10)
  slabSerif(p, cxS, LC_STEM, ASCENDER, 'top', SERIF_EXT - 4, 6, 16)
  lcSerif(p, cxS, LC_STEM, 0, 'bottom', 18, 0)
  lcSerif(p, x0 + w - LC_STEM * 0.4, LC_STEM * 0.6, 0, 'bottom', 8, 16)
  return { advance: LSB + w + RSB }
}

// --- l -------------------------------------------------------------------
const l: Drawer = (p) => {
  const x0 = LSB
  const cxS = x0 + LC_STEM / 2
  rect(p, x0, 0, LC_STEM, ASCENDER)
  slabSerif(p, cxS, LC_STEM, ASCENDER, 'top', SERIF_EXT - 4, 6, 16)
  lcSerif(p, cxS, LC_STEM, 0, 'bottom')
  return { advance: LSB + LC_STEM + 18 + RSB }
}

// --- m -------------------------------------------------------------------
// Built from two n-arches sharing the middle stem.
const m: Drawer = (p) => {
  const archRY = XH * 0.55
  const shoulderY = XH - archRY
  const barWidth = CAP * 0.48 // one n-arch width
  const w = barWidth * 2 - LC_STEM
  const x0 = LSB
  // Three stems up to shoulderY (middle stem shared)
  rect(p, x0, 0, LC_STEM, shoulderY + OV)
  rect(p, x0 + barWidth - LC_STEM, 0, LC_STEM, shoulderY + OV)
  rect(p, x0 + w - LC_STEM, 0, LC_STEM, shoulderY + OV)
  // Two arches
  halfRing(p, x0 + barWidth / 2, shoulderY, barWidth / 2, archRY, LC_STEM, 'top')
  halfRing(p, x0 + barWidth - LC_STEM / 2 + (barWidth - LC_STEM) / 2, shoulderY, (barWidth) / 2, archRY, LC_STEM, 'top')
  lcSerif(p, x0 + LC_STEM / 2, LC_STEM, 0, 'bottom')
  lcSerif(p, x0 + barWidth - LC_STEM / 2, LC_STEM, 0, 'bottom')
  lcSerif(p, x0 + w - LC_STEM / 2, LC_STEM, 0, 'bottom')
  return { advance: LSB + w + RSB }
}

// --- n -------------------------------------------------------------------
// Arch is the FULL top half of an ellipse — its vertical legs ARE the
// stems from shoulderY up to XH. The standalone rects only fill the stems
// from 0 up to shoulderY+OV to avoid double-drawing the arch legs.
const n: Drawer = (p) => {
  const w = CAP * 0.66
  const x0 = LSB
  const archRY = XH * 0.55
  const shoulderY = XH - archRY
  // Stems from baseline up to shoulder
  rect(p, x0, 0, LC_STEM, shoulderY + OV)
  rect(p, x0 + w - LC_STEM, 0, LC_STEM, shoulderY + OV)
  // Arch — outer radii meet stem outer edges
  halfRing(p, x0 + w / 2, shoulderY, w / 2, archRY, LC_STEM, 'top')
  lcSerif(p, x0 + LC_STEM / 2, LC_STEM, 0, 'bottom')
  lcSerif(p, x0 + w - LC_STEM / 2, LC_STEM, 0, 'bottom')
  return { advance: LSB + w + RSB }
}

// --- o -------------------------------------------------------------------
const o: Drawer = (p) => {
  const w = CAP * 0.62
  const x0 = LSB
  const cx = x0 + w / 2
  oRing(p, cx, XH / 2, w / 2, XH / 2)
  return { advance: LSB + w + RSB }
}

// --- p -------------------------------------------------------------------
const pGlyph: Drawer = (p) => {
  const w = CAP * 0.64
  const x0 = LSB
  const cxS = x0 + LC_STEM / 2
  rect(p, x0, DESCENDER, LC_STEM, XH - DESCENDER)
  drawBowl(p, x0 + LC_STEM - OV, 0, w - LC_STEM, XH, LC_STEM * 0.95)
  slabSerif(p, cxS, LC_STEM, XH, 'top', SERIF_EXT - 4, 4, 14)
  lcSerif(p, cxS, LC_STEM, DESCENDER, 'bottom', 14, 14)
  return { advance: LSB + w + RSB }
}

// --- q -------------------------------------------------------------------
const q: Drawer = (p) => {
  const w = CAP * 0.64
  const x0 = LSB
  const cxS = x0 + w - LC_STEM / 2
  rect(p, x0 + w - LC_STEM, DESCENDER, LC_STEM, XH - DESCENDER)
  // Bowl on left
  const cy = XH / 2
  const rx = (w - LC_STEM)
  const ry = XH / 2
  const k = KAPPA
  const stroke = LC_STEM * 0.95
  const irx = Math.max(0, rx - stroke)
  const iry = Math.max(0, ry - stroke * 0.85)
  const stemLeftX = x0 + w - LC_STEM + OV
  if (irx > 0 && iry > 0) {
    p.moveTo(stemLeftX, cy + ry)
    p.curveTo(stemLeftX - rx * k, cy + ry, stemLeftX - rx, cy + ry * k, stemLeftX - rx, cy)
    p.curveTo(stemLeftX - rx, cy - ry * k, stemLeftX - rx * k, cy - ry, stemLeftX, cy - ry)
    p.lineTo(stemLeftX, cy - iry)
    p.curveTo(stemLeftX - irx * k, cy - iry, stemLeftX - irx, cy - iry * k, stemLeftX - irx, cy)
    p.curveTo(stemLeftX - irx, cy + iry * k, stemLeftX - irx * k, cy + iry, stemLeftX, cy + iry)
    p.lineTo(stemLeftX, cy + ry)
    p.close()
  }
  slabSerif(p, cxS, LC_STEM, XH, 'top', 4, SERIF_EXT - 4, 14)
  lcSerif(p, cxS, LC_STEM, DESCENDER, 'bottom', 14, 14)
  return { advance: LSB + w + RSB }
}

// --- r -------------------------------------------------------------------
const r: Drawer = (p) => {
  const w = CAP * 0.46
  const x0 = LSB
  const cxS = x0 + LC_STEM / 2
  rect(p, x0, 0, LC_STEM, XH)
  // Shoulder arc — little flag off the top
  const shRX = w - LC_STEM
  const shRY = LC_THIN * 1.5
  halfRing(p, x0 + LC_STEM + shRX * 0.35, XH - shRY, shRX * 0.8, shRY, LC_STEM * 0.85, 'top')
  // Tiny terminal serif on arc
  rect(p, x0 + w - 10, XH - 14, 10, 14)
  lcSerif(p, cxS, LC_STEM, 0, 'bottom')
  return { advance: LSB + w + RSB }
}

// --- s -------------------------------------------------------------------
const s: Drawer = (p) => {
  const w = CAP * 0.52
  const x0 = LSB
  const cx = x0 + w / 2
  const upperCY = XH * 0.72
  const lowerCY = XH * 0.28
  const rx = w / 2
  const ry = XH * 0.28
  halfRing(p, cx, upperCY, rx, ry, LC_STEM * 0.9, 'top')
  halfRing(p, cx, lowerCY, rx, ry, LC_STEM * 0.9, 'bottom')
  legStroke(p, x0 + w - LC_STEM * 0.45, x0 + LC_STEM * 0.45, lowerCY - LC_STEM * 0.1, upperCY + LC_STEM * 0.1, LC_STEM * 0.85)
  return { advance: LSB + w + RSB }
}

// --- t -------------------------------------------------------------------
const t: Drawer = (p) => {
  const w = CAP * 0.42
  const x0 = LSB
  const cxS = x0 + LC_STEM / 2 + 6
  const topY = XH + 140
  rect(p, cxS - LC_STEM / 2, 0, LC_STEM, topY)
  // Crossbar at x-height
  rect(p, x0, XH - LC_THIN * 0.6, w, LC_THIN)
  // Bottom right curve (like j hook but smaller)
  halfRing(p, cxS + LC_STEM * 0.4, LC_STEM * 0.4, LC_STEM * 0.6, LC_STEM * 0.5, LC_STEM * 0.5, 'bottom')
  return { advance: LSB + w + RSB }
}

// --- u -------------------------------------------------------------------
const u: Drawer = (p) => {
  const w = CAP * 0.66
  const x0 = LSB
  const cxL = x0 + LC_STEM / 2
  const cxR = x0 + w - LC_STEM / 2
  const stemBot = XH * 0.28
  rect(p, x0, stemBot, LC_STEM, XH - stemBot)
  rect(p, x0 + w - LC_STEM, 0, LC_STEM, XH)
  drawBottomBowl(p, x0, x0 + w, stemBot + OV, stemBot, LC_STEM * 0.95)
  slabSerif(p, cxL, LC_STEM, XH, 'top', 16, 6, 14)
  slabSerif(p, cxR, LC_STEM, XH, 'top', 6, 16, 14)
  lcSerif(p, cxR, LC_STEM, 0, 'bottom')
  return { advance: LSB + w + RSB }
}

// --- v -------------------------------------------------------------------
const v: Drawer = (p) => {
  const w = CAP * 0.62
  const x0 = LSB
  const cx = x0 + w / 2
  const dia = LC_THIN + 4
  legStroke(p, cx + OV, x0 + dia / 2, 0, XH, dia)
  legStroke(p, cx - OV, x0 + w - dia / 2, 0, XH, dia)
  rect(p, cx - dia, 0, dia * 2, 4)
  slabSerif(p, x0 + dia / 2, dia, XH, 'top', 14, 12, 12)
  slabSerif(p, x0 + w - dia / 2, dia, XH, 'top', 12, 14, 12)
  return { advance: LSB + w + RSB }
}

// --- w -------------------------------------------------------------------
const w: Drawer = (p) => {
  const W_ = CAP * 0.94
  const x0 = LSB
  const cx = x0 + W_ / 2
  const dia = LC_THIN * 0.9
  const footL = x0 + W_ * 0.28
  const footR = x0 + W_ * 0.72
  legStroke(p, footL + OV, x0 + dia / 2, 0, XH, dia)
  legStroke(p, footL - OV, cx - dia / 2 + OV, 0, XH, dia)
  legStroke(p, footR + OV, cx + dia / 2 - OV, 0, XH, dia)
  legStroke(p, footR - OV, x0 + W_ - dia / 2, 0, XH, dia)
  rect(p, footL - dia, 0, dia * 2, 4)
  rect(p, footR - dia, 0, dia * 2, 4)
  rect(p, cx - dia, XH - 5, dia * 2, 5)
  slabSerif(p, x0 + dia / 2, dia, XH, 'top', 12, 10, 12)
  slabSerif(p, cx - dia / 2 + OV, dia, XH, 'top', 10, 10, 12)
  slabSerif(p, cx + dia / 2 - OV, dia, XH, 'top', 10, 10, 12)
  slabSerif(p, x0 + W_ - dia / 2, dia, XH, 'top', 10, 12, 12)
  return { advance: LSB + W_ + RSB }
}

// --- x -------------------------------------------------------------------
const x: Drawer = (p) => {
  const w = CAP * 0.60
  const x0 = LSB
  legStroke(p, x0, x0 + w, 0, XH, LC_THIN + 2)
  legStroke(p, x0 + w, x0, 0, XH, LC_THIN + 2)
  const cx = x0 + w / 2
  rect(p, cx - LC_THIN * 0.4, XH / 2 - LC_THIN * 0.4, LC_THIN * 0.8, LC_THIN * 0.8)
  slabSerif(p, x0, LC_THIN + 2, 0, 'bottom', 14, 12, 12)
  slabSerif(p, x0 + w, LC_THIN + 2, 0, 'bottom', 12, 14, 12)
  slabSerif(p, x0, LC_THIN + 2, XH, 'top', 14, 12, 12)
  slabSerif(p, x0 + w, LC_THIN + 2, XH, 'top', 12, 14, 12)
  return { advance: LSB + w + RSB }
}

// --- y -------------------------------------------------------------------
const y: Drawer = (p) => {
  const w = CAP * 0.62
  const x0 = LSB
  const cx = x0 + w / 2
  const dia = LC_THIN + 4
  // Right leg full to baseline then continues as descender
  legStroke(p, x0 + w - dia / 2 + 4, x0 + w - dia / 2, DESCENDER + 30, XH, dia)
  // Left leg stops at junction
  const junctionY = XH * 0.28
  legStroke(p, cx - dia + OV, x0 + dia / 2, junctionY, XH, dia)
  // Fill junction
  rect(p, cx - dia, junctionY - OV, (x0 + w - dia / 2) - (cx - dia), dia)
  slabSerif(p, x0 + dia / 2, dia, XH, 'top', 14, 12, 12)
  slabSerif(p, x0 + w - dia / 2, dia, XH, 'top', 12, 14, 12)
  return { advance: LSB + w + RSB }
}

// --- z -------------------------------------------------------------------
const z: Drawer = (p) => {
  const w = CAP * 0.56
  const x0 = LSB
  rect(p, x0, XH - LC_THIN * 1.3, w, LC_THIN * 1.3)
  rect(p, x0, 0, w, LC_THIN * 1.3)
  legStroke(p, x0 + LC_THIN * 0.4, x0 + w - LC_THIN * 0.4, LC_THIN * 1.3 - OV, XH - LC_THIN * 1.3 + OV, LC_THIN + 4)
  return { advance: LSB + w + RSB }
}

// ---------------------------------------------------------------------------
// Digits (cap-height)
// ---------------------------------------------------------------------------

const zero: Drawer = (p) => {
  const w = CAP * 0.60
  const x0 = LSB
  const cx = x0 + w / 2
  stressedRing(p, cx, CAP / 2, w / 2, CAP / 2, STEM * 0.85, THIN * 1.2)
  return { advance: LSB + w + RSB }
}
const one: Drawer = (p) => {
  const w = CAP * 0.50
  const x0 = LSB
  const stemCx = x0 + w - STEM * 0.6
  rect(p, stemCx - STEM / 2, 0, STEM, CAP)
  legStroke(p, stemCx - STEM / 2, x0 + STEM * 0.2, CAP - STEM * 1.4, CAP, STEM * 0.8)
  slabSerif(p, stemCx, STEM, 0, 'bottom')
  return { advance: LSB + w + RSB }
}
const two: Drawer = (p) => {
  const w = CAP * 0.62
  const x0 = LSB
  const cx = x0 + w / 2
  const upperCY = CAP * 0.70
  const upperRX = w / 2
  const upperRY = CAP * 0.30
  halfRing(p, cx, upperCY, upperRX, upperRY, STEM * 0.9, 'top')
  rect(p, cx + upperRX - STEM, upperCY - STEM * 0.4, STEM, upperRY * 0.6)
  legStroke(p, x0 + STEM * 0.4, cx + upperRX - STEM * 0.5, THIN * 1.3, upperCY, STEM * 0.9)
  rect(p, x0, 0, w, THIN * 1.3)
  return { advance: LSB + w + RSB }
}
const three: Drawer = (p) => {
  const w = CAP * 0.60
  const x0 = LSB
  const cx = x0 + w / 2
  const upperCY = CAP * 0.74
  const lowerCY = CAP * 0.26
  const rx = w / 2
  const ry = CAP * 0.26
  halfRing(p, cx, upperCY, rx, ry, STEM * 0.9, 'right')
  halfRing(p, cx, lowerCY, rx, ry, STEM * 0.9, 'right')
  rect(p, cx - STEM * 0.4, CAP / 2 - STEM * 0.4, STEM * 1.2, STEM * 0.8)
  return { advance: LSB + w + RSB }
}
const four: Drawer = (p) => {
  const w = CAP * 0.68
  const x0 = LSB
  rect(p, x0 + w - STEM * 1.2, 0, STEM, CAP)
  const barY = CAP * 0.30
  const barH = STEM * 0.85
  legStroke(p, x0, x0 + w - STEM * 1.2, barY, CAP, STEM * 0.85)
  rect(p, x0, barY, w, barH)
  slabSerif(p, x0 + w - STEM * 0.7, STEM, 0, 'bottom')
  return { advance: LSB + w + RSB }
}
const five: Drawer = (p) => {
  const w = CAP * 0.60
  const x0 = LSB
  const cx = x0 + w / 2
  rect(p, x0, CAP - THIN * 1.3, w, THIN * 1.3)
  rect(p, x0, CAP * 0.5, STEM * 0.9, CAP / 2)
  halfRing(p, cx, CAP * 0.28, w / 2, CAP * 0.28, STEM * 0.9, 'right')
  rect(p, x0, CAP * 0.48, STEM * 1.4, STEM * 0.9)
  return { advance: LSB + w + RSB }
}
const six: Drawer = (p) => {
  const w = CAP * 0.62
  const x0 = LSB
  const cx = x0 + w / 2
  const lowerRY = CAP * 0.32
  const lowerCY = lowerRY
  const lowerRX = w / 2
  ellipse(p, cx, lowerCY, lowerRX, lowerRY)
  ellipse(p, cx, lowerCY, Math.max(1, lowerRX - STEM * 0.9), Math.max(1, lowerRY - STEM * 0.85), true)
  rect(p, x0, lowerCY, STEM * 0.9, CAP - lowerCY)
  halfRing(p, x0 + STEM * 0.45 + (w - STEM) / 4, CAP - STEM * 0.8, (w - STEM) / 4, STEM * 0.8, STEM * 0.85, 'top')
  return { advance: LSB + w + RSB }
}
const seven: Drawer = (p) => {
  const w = CAP * 0.62
  const x0 = LSB
  rect(p, x0, CAP - THIN * 1.3, w, THIN * 1.3)
  legStroke(p, x0 + STEM * 0.5, x0 + w - STEM * 0.4, 0, CAP - THIN * 1.3, STEM * 0.85)
  return { advance: LSB + w + RSB }
}
const eight: Drawer = (p) => {
  const w = CAP * 0.62
  const x0 = LSB
  const cx = x0 + w / 2
  const upperCY = CAP * 0.70
  const lowerCY = CAP * 0.28
  const upperRX = w * 0.42
  const upperRY = CAP * 0.28
  const lowerRX = w / 2
  const lowerRY = CAP * 0.30
  ellipse(p, cx, upperCY, upperRX, upperRY)
  ellipse(p, cx, upperCY, Math.max(1, upperRX - STEM * 0.82), Math.max(1, upperRY - STEM * 0.82), true)
  ellipse(p, cx, lowerCY, lowerRX, lowerRY)
  ellipse(p, cx, lowerCY, Math.max(1, lowerRX - STEM * 0.85), Math.max(1, lowerRY - STEM * 0.85), true)
  return { advance: LSB + w + RSB }
}
const nine: Drawer = (p) => {
  const w = CAP * 0.62
  const x0 = LSB
  const cx = x0 + w / 2
  const upperRY = CAP * 0.32
  const upperCY = CAP - upperRY
  const upperRX = w / 2
  ellipse(p, cx, upperCY, upperRX, upperRY)
  ellipse(p, cx, upperCY, Math.max(1, upperRX - STEM * 0.9), Math.max(1, upperRY - STEM * 0.85), true)
  rect(p, x0 + w - STEM * 0.9, STEM * 0.8, STEM * 0.9, upperCY - STEM * 0.6)
  halfRing(p, x0 + STEM * 0.45 + (w - STEM) * 0.75 / 2, STEM * 0.8, (w - STEM) / 4, STEM * 0.8, STEM * 0.85, 'bottom')
  return { advance: LSB + w + RSB }
}

// ---------------------------------------------------------------------------
// Punctuation
// ---------------------------------------------------------------------------

const period: Drawer = (p) => {
  const r = LC_STEM * 0.45
  const cx = LSB + r
  ellipse(p, cx, r, r, r)
  return { advance: LSB + r * 2 + RSB }
}
const comma: Drawer = (p) => {
  const r = LC_STEM * 0.45
  const cx = LSB + r
  ellipse(p, cx, r, r, r)
  legStroke(p, cx - r * 0.2, cx - r * 0.6, -LC_STEM * 1.2, 0, LC_STEM * 0.6)
  return { advance: LSB + r * 2 + RSB }
}
const colon: Drawer = (p) => {
  const r = LC_STEM * 0.45
  const cx = LSB + r
  ellipse(p, cx, r, r, r)
  ellipse(p, cx, XH - r, r, r)
  return { advance: LSB + r * 2 + RSB }
}
const semicolon: Drawer = (p) => {
  const r = LC_STEM * 0.45
  const cx = LSB + r
  ellipse(p, cx, r, r, r)
  legStroke(p, cx - r * 0.2, cx - r * 0.6, -LC_STEM * 1.2, 0, LC_STEM * 0.6)
  ellipse(p, cx, XH - r, r, r)
  return { advance: LSB + r * 2 + RSB }
}
const exclam: Drawer = (p) => {
  const r = LC_STEM * 0.45
  const cx = LSB + r
  ellipse(p, cx, r, r, r)
  // Tapered stem (thicker at top)
  p.moveTo(cx - LC_STEM * 0.45, CAP)
  p.lineTo(cx + LC_STEM * 0.45, CAP)
  p.lineTo(cx + LC_STEM * 0.25, r * 2 + 8)
  p.lineTo(cx - LC_STEM * 0.25, r * 2 + 8)
  p.close()
  return { advance: LSB + LC_STEM + RSB }
}
const question: Drawer = (p) => {
  const w = CAP * 0.50
  const x0 = LSB
  const cx = x0 + w / 2
  const upperCY = CAP * 0.78
  const upperRX = w / 2
  const upperRY = CAP * 0.22
  halfRing(p, cx, upperCY, upperRX, upperRY, LC_STEM * 0.9, 'top')
  rect(p, cx + upperRX - LC_STEM, upperCY - LC_STEM * 0.3, LC_STEM, upperRY * 0.7)
  rect(p, cx + upperRX * 0.1 - LC_STEM * 0.4, CAP * 0.22, LC_STEM * 0.8, CAP * 0.30)
  const r = LC_STEM * 0.45
  ellipse(p, cx + upperRX * 0.1, r, r, r)
  return { advance: LSB + w + RSB }
}
const hyphen: Drawer = (p) => {
  const w = CAP * 0.36
  rect(p, LSB, XH / 2 - LC_THIN * 0.5, w, LC_THIN)
  return { advance: LSB + w + RSB }
}
const apostrophe: Drawer = (p) => {
  const x0 = LSB
  legStroke(p, x0 + LC_STEM * 0.4, x0, CAP * 0.68, CAP - LC_STEM * 0.15, LC_STEM * 0.6)
  return { advance: LSB + LC_STEM + RSB }
}
const quotedbl: Drawer = (p) => {
  const x0 = LSB
  const gap = LC_STEM
  legStroke(p, x0 + LC_STEM * 0.4, x0, CAP * 0.68, CAP - LC_STEM * 0.15, LC_STEM * 0.6)
  legStroke(p, x0 + gap + LC_STEM * 0.4, x0 + gap, CAP * 0.68, CAP - LC_STEM * 0.15, LC_STEM * 0.6)
  return { advance: LSB + gap + LC_STEM + RSB }
}
const parenleft: Drawer = (p) => {
  const w = CAP * 0.30
  const x0 = LSB
  const cx = x0 + w + LC_STEM
  halfRing(p, cx, CAP / 2, w + LC_STEM, CAP * 0.55, LC_STEM * 0.8, 'left')
  return { advance: LSB + w + RSB }
}
const parenright: Drawer = (p) => {
  const w = CAP * 0.30
  const x0 = LSB
  const cx = x0 - LC_STEM
  halfRing(p, cx, CAP / 2, w + LC_STEM, CAP * 0.55, LC_STEM * 0.8, 'right')
  return { advance: LSB + w + RSB }
}
const slash: Drawer = (p) => {
  const w = CAP * 0.42
  const x0 = LSB
  legStroke(p, x0, x0 + w, -LC_STEM * 0.5, CAP, LC_STEM * 0.75)
  return { advance: LSB + w + RSB }
}
const middot: Drawer = (p) => {
  const r = LC_STEM * 0.42
  const cx = LSB + r
  ellipse(p, cx, CAP * 0.4, r, r)
  return { advance: LSB + r * 2 + RSB }
}

// ---------------------------------------------------------------------------
// Glyph table
// ---------------------------------------------------------------------------

interface GlyphSpec {
  name: string
  unicodes: number[]
  draw: Drawer
}

const GLYPHS: GlyphSpec[] = [
  { name: 'A', unicodes: [0x41], draw: A },
  { name: 'B', unicodes: [0x42], draw: B },
  { name: 'C', unicodes: [0x43], draw: C },
  { name: 'D', unicodes: [0x44], draw: D },
  { name: 'E', unicodes: [0x45], draw: E },
  { name: 'F', unicodes: [0x46], draw: F },
  { name: 'G', unicodes: [0x47], draw: G },
  { name: 'H', unicodes: [0x48], draw: H },
  { name: 'I', unicodes: [0x49], draw: I },
  { name: 'J', unicodes: [0x4A], draw: J },
  { name: 'K', unicodes: [0x4B], draw: K },
  { name: 'L', unicodes: [0x4C], draw: L },
  { name: 'M', unicodes: [0x4D], draw: M },
  { name: 'N', unicodes: [0x4E], draw: N },
  { name: 'O', unicodes: [0x4F], draw: O },
  { name: 'P', unicodes: [0x50], draw: P },
  { name: 'Q', unicodes: [0x51], draw: Q },
  { name: 'R', unicodes: [0x52], draw: R },
  { name: 'S', unicodes: [0x53], draw: S },
  { name: 'T', unicodes: [0x54], draw: T },
  { name: 'U', unicodes: [0x55], draw: U },
  { name: 'V', unicodes: [0x56], draw: V },
  { name: 'W', unicodes: [0x57], draw: W },
  { name: 'X', unicodes: [0x58], draw: X },
  { name: 'Y', unicodes: [0x59], draw: Y },
  { name: 'Z', unicodes: [0x5A], draw: Z },
  { name: 'a', unicodes: [0x61], draw: a },
  { name: 'b', unicodes: [0x62], draw: b },
  { name: 'c', unicodes: [0x63], draw: c },
  { name: 'd', unicodes: [0x64], draw: d },
  { name: 'e', unicodes: [0x65], draw: e },
  { name: 'f', unicodes: [0x66], draw: f },
  { name: 'g', unicodes: [0x67], draw: g },
  { name: 'h', unicodes: [0x68], draw: h },
  { name: 'i', unicodes: [0x69], draw: i },
  { name: 'j', unicodes: [0x6A], draw: j },
  { name: 'k', unicodes: [0x6B], draw: k },
  { name: 'l', unicodes: [0x6C], draw: l },
  { name: 'm', unicodes: [0x6D], draw: m },
  { name: 'n', unicodes: [0x6E], draw: n },
  { name: 'o', unicodes: [0x6F], draw: o },
  { name: 'p', unicodes: [0x70], draw: pGlyph },
  { name: 'q', unicodes: [0x71], draw: q },
  { name: 'r', unicodes: [0x72], draw: r },
  { name: 's', unicodes: [0x73], draw: s },
  { name: 't', unicodes: [0x74], draw: t },
  { name: 'u', unicodes: [0x75], draw: u },
  { name: 'v', unicodes: [0x76], draw: v },
  { name: 'w', unicodes: [0x77], draw: w },
  { name: 'x', unicodes: [0x78], draw: x },
  { name: 'y', unicodes: [0x79], draw: y },
  { name: 'z', unicodes: [0x7A], draw: z },
  { name: 'zero', unicodes: [0x30], draw: zero },
  { name: 'one', unicodes: [0x31], draw: one },
  { name: 'two', unicodes: [0x32], draw: two },
  { name: 'three', unicodes: [0x33], draw: three },
  { name: 'four', unicodes: [0x34], draw: four },
  { name: 'five', unicodes: [0x35], draw: five },
  { name: 'six', unicodes: [0x36], draw: six },
  { name: 'seven', unicodes: [0x37], draw: seven },
  { name: 'eight', unicodes: [0x38], draw: eight },
  { name: 'nine', unicodes: [0x39], draw: nine },
  { name: 'period', unicodes: [0x2E], draw: period },
  { name: 'comma', unicodes: [0x2C], draw: comma },
  { name: 'colon', unicodes: [0x3A], draw: colon },
  { name: 'semicolon', unicodes: [0x3B], draw: semicolon },
  { name: 'exclam', unicodes: [0x21], draw: exclam },
  { name: 'question', unicodes: [0x3F], draw: question },
  { name: 'hyphen', unicodes: [0x2D], draw: hyphen },
  { name: 'apostrophe', unicodes: [0x27], draw: apostrophe },
  { name: 'quotedbl', unicodes: [0x22], draw: quotedbl },
  { name: 'parenleft', unicodes: [0x28], draw: parenleft },
  { name: 'parenright', unicodes: [0x29], draw: parenright },
  { name: 'slash', unicodes: [0x2F], draw: slash },
  { name: 'middot', unicodes: [0x00B7], draw: middot },
]

async function build() {
  const notdef = new opentype.Glyph({
    name: '.notdef',
    unicode: 0,
    advanceWidth: CAP * 0.82 + LSB + RSB,
    path: new opentype.Path(),
  })
  const space = new opentype.Glyph({
    name: 'space',
    unicode: 0x20,
    advanceWidth: CAP * 0.34 + LSB,
    path: new opentype.Path(),
  })
  ;(space as opentype.Glyph & { unicodes: number[] }).unicodes = [0x20, 0xA0]

  const glyphs: opentype.Glyph[] = [notdef, space]

  for (const spec of GLYPHS) {
    const path = new opentype.Path()
    const { advance } = spec.draw(path)
    const g = new opentype.Glyph({
      name: spec.name,
      unicode: spec.unicodes[0]!,
      advanceWidth: advance,
      path,
    })
    if (spec.unicodes.length > 1) {
      (g as opentype.Glyph & { unicodes: number[] }).unicodes = spec.unicodes
    }
    glyphs.push(g)
  }

  const font = new opentype.Font({
    familyName: 'Redwood Serif',
    styleName: 'Regular',
    unitsPerEm: UPM,
    ascender: ASCENDER,
    descender: DESCENDER,
    designer: 'NPS Fonts contributors',
    designerURL: 'https://github.com/stacksjs/nps-fonts',
    manufacturer: 'NPS Fonts',
    license: 'This Font Software is licensed under the SIL Open Font License, Version 1.1.',
    licenseURL: 'https://openfontlicense.org',
    version: '0.8.0',
    description: 'Redwood Serif — old-style / transitional serif inspired by NPS Rawlinson OT and Plantin. John Muir field-journal warmth.',
    copyright: 'Copyright (c) 2026, NPS Fonts contributors. With Reserved Font Name "Redwood Serif".',
    trademark: '',
    glyphs,
  })

  if (font.tables.os2) {
    font.tables.os2.usWeightClass = 400
    font.tables.os2.achVendID = 'NPSF'
    font.tables.os2.fsSelection = 0x40
  }

  const otfBuf = Buffer.from(font.toArrayBuffer() as ArrayBuffer)

  await mkdir(resolve(FONTS, 'otf'), { recursive: true })
  await mkdir(resolve(FONTS, 'ttf'), { recursive: true })
  await mkdir(resolve(FONTS, 'woff'), { recursive: true })
  await mkdir(resolve(FONTS, 'woff2'), { recursive: true })

  await writeFile(resolve(FONTS, 'otf', 'RedwoodSerif-Regular.otf'), otfBuf)
  await writeFile(resolve(FONTS, 'ttf', 'RedwoodSerif-Regular.ttf'), otfBuf)
  await writeFile(resolve(FONTS, 'woff', 'RedwoodSerif-Regular.woff'), sfntToWoff(otfBuf))
  const woff2Buf = Buffer.from(await wawoff2.compress(otfBuf))
  await writeFile(resolve(FONTS, 'woff2', 'RedwoodSerif-Regular.woff2'), woff2Buf)

  console.log(`✓ Redwood Serif: ${GLYPHS.length} glyphs · ${(otfBuf.length / 1024).toFixed(1)}KB OTF`)
}

await build()
export const REDWOOD_SERIF_GLYPHS = GLYPHS
