#!/usr/bin/env bun
/**
 * Quantify how much the family transform pipelines actually change the
 * outlines vs the (sanitized) source JSON. Used as the safety-metric
 * report after design-pass changes.
 *
 *   bun run scripts/_measure-transforms.ts
 *
 * Reports per-family:
 *   - total points across all glyphs
 *   - mean/max per-coordinate displacement (em units, UPM=1000)
 *   - % of points moved by ≥ 1 unit
 *   - % of glyphs whose bounding box changed
 */
import { resolve } from 'node:path'
import { loadOutlines, type FontData } from './lib/extracted.ts'
import { PIPELINES } from './lib/transforms.ts'

interface Diff { meanShift: number, maxShift: number, pctMoved: number, bboxChanged: number, totalPoints: number, totalGlyphs: number }

function diffData(before: FontData, after: FontData): Diff {
  let totalPoints = 0, totalGlyphs = 0, sumShift = 0, maxShift = 0, moved = 0, bboxChanged = 0
  // Pipelines mutate in place without changing glyph order — match by index.
  const n = Math.min(before.glyf.length, after.glyf.length)
  for (let gi = 0; gi < n; gi++) {
    const a = after.glyf[gi]!, b = before.glyf[gi]!
    if (!a.contours || !b.contours) continue
    totalGlyphs++
    if (a.xMin !== b.xMin || a.yMin !== b.yMin || a.xMax !== b.xMax || a.yMax !== b.yMax) bboxChanged++
    if (a.contours.length !== b.contours.length) continue
    for (let ci = 0; ci < a.contours.length; ci++) {
      const ac = a.contours[ci]!, bc = b.contours[ci]!
      if (ac.length !== bc.length) continue
      for (let pi = 0; pi < ac.length; pi++) {
        totalPoints++
        const dx = ac[pi]!.x - bc[pi]!.x
        const dy = ac[pi]!.y - bc[pi]!.y
        const dist = Math.hypot(dx, dy)
        sumShift += dist
        if (dist > maxShift) maxShift = dist
        if (dist >= 1) moved++
      }
    }
  }
  return {
    meanShift: totalPoints ? sumShift / totalPoints : 0,
    maxShift,
    pctMoved: totalPoints ? (moved * 100) / totalPoints : 0,
    bboxChanged,
    totalPoints,
    totalGlyphs,
  }
}

function fmt(d: Diff): string {
  return `points=${d.totalPoints.toString().padStart(5)} | mean=${d.meanShift.toFixed(2).padStart(5)}u max=${d.maxShift.toFixed(1).padStart(4)}u | moved≥1u: ${d.pctMoved.toFixed(1).padStart(5)}% | bbox-changed: ${d.bboxChanged}/${d.totalGlyphs}`
}

interface Target { label: string, src: string, pipelineKey: keyof typeof PIPELINES }

const TARGETS: Target[] = [
  { label: 'redwood-serif (Regular base)', src: 'sources/redwood-serif/outlines.json', pipelineKey: 'redwood-serif' },
  { label: 'redwood-serif (Wide caps)',    src: 'sources/redwood-serif/outlines-wide.json', pipelineKey: 'redwood-serif' },
  { label: 'sequoia-sans (Regular)',       src: 'sources/sequoia-sans/outlines.json', pipelineKey: 'sequoia-sans' },
  { label: 'sequoia-sans (Light)',         src: 'sources/sequoia-sans/outlines-light.json', pipelineKey: 'sequoia-sans' },
  { label: 'sequoia-sans (Thin)',          src: 'sources/sequoia-sans/outlines-thin.json', pipelineKey: 'sequoia-sans' },
  { label: 'sequoia-sans (Wide)',          src: 'sources/sequoia-sans/outlines-wide.json', pipelineKey: 'sequoia-sans' },
  { label: 'campmate-script',              src: 'sources/campmate-script/outlines.json', pipelineKey: 'campmate-script' },
  { label: 'switchback (Clean)',           src: 'sources/switchback/outlines-clean.json', pipelineKey: 'switchback-clean' },
  { label: 'switchback (Rough)',           src: 'sources/switchback/outlines-rough.json', pipelineKey: 'switchback-rough' },
  { label: 'nps-2026',                     src: 'sources/nps-2026/outlines.json', pipelineKey: 'nps-2026' },
]

async function main() {
  console.log(`\nTransform-impact metrics (UPM = 1000)\n`)
  for (const t of TARGETS) {
    const before = await loadOutlines(t.src)
    const after = JSON.parse(JSON.stringify(before)) as FontData
    PIPELINES[t.pipelineKey]!(after)
    const d = diffData(before, after)
    console.log(`${t.label.padEnd(34)} ${fmt(d)}`)
  }
  console.log()
}

await main()
