/**
 * Reusable outline primitives. Each primitive draws into an opentype.js
 * Path using moveTo / lineTo / curveTo / close. All shapes are filled
 * counter-clockwise (outer) by default; pass {hole:true} for the
 * clockwise (inner) variant when drawing counters.
 */

import type { Path } from 'opentype.js'

/** Bezier circle constant — distance from on-curve to handle for a 4-segment circle. */
export const KAPPA = 0.5522847498307936

export interface Point {
  x: number
  y: number
}

export function rect(p: Path, x: number, y: number, w: number, h: number): void {
  p.moveTo(x, y)
  p.lineTo(x + w, y)
  p.lineTo(x + w, y + h)
  p.lineTo(x, y + h)
  p.close()
}

export function rectHole(p: Path, x: number, y: number, w: number, h: number): void {
  p.moveTo(x, y)
  p.lineTo(x, y + h)
  p.lineTo(x + w, y + h)
  p.lineTo(x + w, y)
  p.close()
}

export function roundRect(p: Path, x: number, y: number, w: number, h: number, r: number): void {
  r = Math.min(r, w / 2, h / 2)
  const k = r * KAPPA
  p.moveTo(x + r, y)
  p.lineTo(x + w - r, y)
  p.curveTo(x + w - r + k, y, x + w, y + r - k, x + w, y + r)
  p.lineTo(x + w, y + h - r)
  p.curveTo(x + w, y + h - r + k, x + w - r + k, y + h, x + w - r, y + h)
  p.lineTo(x + r, y + h)
  p.curveTo(x + r - k, y + h, x, y + h - r + k, x, y + h - r)
  p.lineTo(x, y + r)
  p.curveTo(x, y + r - k, x + r - k, y, x + r, y)
  p.close()
}

export function ellipse(
  p: Path,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  opts: { hole?: boolean } = {},
): void {
  const { hole = false } = opts
  const kx = rx * KAPPA
  const ky = ry * KAPPA
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

/** Annular ring: outer ellipse minus inner ellipse. */
export function ring(
  p: Path,
  cx: number,
  cy: number,
  outerRx: number,
  outerRy: number,
  thickness: number,
): void {
  ellipse(p, cx, cy, outerRx, outerRy)
  ellipse(p, cx, cy, outerRx - thickness, outerRy - thickness, { hole: true })
}

/** Horizontal stroke: rectangle of given weight, vertically centered on y. */
export function strokeH(p: Path, x: number, y: number, length: number, weight: number): void {
  rect(p, x, y - weight / 2, length, weight)
}

/** Vertical stroke: rectangle of given weight, horizontally centered on x. */
export function strokeV(p: Path, x: number, y: number, height: number, weight: number): void {
  rect(p, x - weight / 2, y, weight, height)
}

/** Diagonal stroke between two points; rectangle of given weight. */
export function strokeLine(
  p: Path,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  weight: number,
): void {
  const dx = x2 - x1
  const dy = y2 - y1
  const length = Math.hypot(dx, dy)
  if (length === 0) return
  const nx = -dy / length
  const ny = dx / length
  const hx = (nx * weight) / 2
  const hy = (ny * weight) / 2
  p.moveTo(x1 + hx, y1 + hy)
  p.lineTo(x2 + hx, y2 + hy)
  p.lineTo(x2 - hx, y2 - hy)
  p.lineTo(x1 - hx, y1 - hy)
  p.close()
}

export function polygon(p: Path, points: Point[]): void {
  if (points.length < 3) return
  p.moveTo(points[0]!.x, points[0]!.y)
  for (let i = 1; i < points.length; i++) {
    p.lineTo(points[i]!.x, points[i]!.y)
  }
  p.close()
}

/** Slab serif: small horizontal bar centered at (x, y). */
export function slab(p: Path, x: number, y: number, w: number, weight: number): void {
  rect(p, x - w / 2, y - weight / 2, w, weight)
}

/** Triangular wedge serif (used by Trailbum). */
export function wedge(p: Path, x: number, y: number, w: number, h: number): void {
  polygon(p, [
    { x: x - w / 2, y },
    { x: x + w / 2, y },
    { x, y: y - h },
  ])
}

/** Apex of curves: simple stroked semicircle for letter tops. */
export function arc(
  p: Path,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  weight: number,
  start: 'top' | 'bottom' | 'left' | 'right',
): void {
  const k = KAPPA
  const inner = (r: number) => Math.max(0, r - weight)
  const orx = rx
  const ory = ry
  const irx = inner(rx)
  const iry = inner(ry)
  const okx = orx * k
  const oky = ory * k
  const ikx = irx * k
  const iky = iry * k
  switch (start) {
    case 'top':
      p.moveTo(cx - orx, cy)
      p.curveTo(cx - orx, cy + oky, cx - okx, cy + ory, cx, cy + ory)
      p.curveTo(cx + okx, cy + ory, cx + orx, cy + oky, cx + orx, cy)
      p.lineTo(cx + irx, cy)
      p.curveTo(cx + irx, cy + iky, cx + ikx, cy + iry, cx, cy + iry)
      p.curveTo(cx - ikx, cy + iry, cx - irx, cy + iky, cx - irx, cy)
      p.close()
      break
    case 'bottom':
      p.moveTo(cx - orx, cy)
      p.lineTo(cx - irx, cy)
      p.curveTo(cx - irx, cy - iky, cx - ikx, cy - iry, cx, cy - iry)
      p.curveTo(cx + ikx, cy - iry, cx + irx, cy - iky, cx + irx, cy)
      p.lineTo(cx + orx, cy)
      p.curveTo(cx + orx, cy - oky, cx + okx, cy - ory, cx, cy - ory)
      p.curveTo(cx - okx, cy - ory, cx - orx, cy - oky, cx - orx, cy)
      p.close()
      break
    case 'left':
      p.moveTo(cx, cy - ory)
      p.curveTo(cx - okx, cy - ory, cx - orx, cy - oky, cx - orx, cy)
      p.curveTo(cx - orx, cy + oky, cx - okx, cy + ory, cx, cy + ory)
      p.lineTo(cx, cy + iry)
      p.curveTo(cx - ikx, cy + iry, cx - irx, cy + iky, cx - irx, cy)
      p.curveTo(cx - irx, cy - iky, cx - ikx, cy - iry, cx, cy - iry)
      p.close()
      break
    case 'right':
      p.moveTo(cx, cy - ory)
      p.lineTo(cx, cy - iry)
      p.curveTo(cx + ikx, cy - iry, cx + irx, cy - iky, cx + irx, cy)
      p.curveTo(cx + irx, cy + iky, cx + ikx, cy + iry, cx, cy + iry)
      p.lineTo(cx, cy + ory)
      p.curveTo(cx + okx, cy + ory, cx + orx, cy + oky, cx + orx, cy)
      p.curveTo(cx + orx, cy - oky, cx + okx, cy - ory, cx, cy - ory)
      p.close()
      break
  }
}
