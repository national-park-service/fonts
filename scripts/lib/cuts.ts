/**
 * Discover and classify the static font cuts on disk for a family. Used
 * by both pack.ts (to emit @font-face per cut in the published npm CSS)
 * and web.ts (to render every cut on the specimen site).
 */

import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { FAMILY_DISPLAY, type FamilyId } from './common.ts'

const ROOT = resolve(import.meta.dir, '..', '..')
const FONTS = resolve(ROOT, 'fonts')

export const NAMED_WEIGHT: Record<string, number> = {
  Thin: 100,
  ExtraLight: 200,
  Light: 300,
  Regular: 400,
  Medium: 500,
  SemiBold: 600,
  Bold: 700,
  ExtraBold: 800,
  Black: 900,
}

export const NAMED_STRETCH: Record<string, string> = {
  UltraCondensed: '50%',
  ExtraCondensed: '62.5%',
  Condensed: '75%',
  SemiCondensed: '87.5%',
  Normal: '100%',
  SemiExpanded: '112.5%',
  Wide: '125%',
  Expanded: '125%',
  ExtraExpanded: '150%',
  UltraExpanded: '200%',
}

export interface StaticCut {
  /** Filename stem, e.g. "SequoiaSans-Wide". */
  stem: string
  /** Style name parsed from stem, e.g. "Wide". */
  style: string
  /** CSS font-weight derived from style name (default = meta.weight). */
  weight: number
  /** CSS font-stretch (e.g. "100%", "125%") if the style implies one. */
  stretch?: string
  /**
   * If set, this cut publishes under a sibling family name (e.g.
   * "Switchback Rough" instead of "Switchback") because the style has no
   * clean representation in CSS weight/stretch axes.
   */
  siblingFamily?: string
}

export function hasVariable(id: FamilyId): boolean {
  const meta = FAMILY_DISPLAY[id]
  return existsSync(resolve(FONTS, id, 'ttf', `${meta.file}[wght].ttf`))
}

/** Discover every static cut built under fonts/<id>/otf/. */
export async function discoverStaticCuts(id: FamilyId): Promise<StaticCut[]> {
  const meta = FAMILY_DISPLAY[id]
  const dir = resolve(FONTS, id, 'otf')
  if (!existsSync(dir)) return []
  const entries = await readdir(dir)
  const cuts: StaticCut[] = []
  for (const f of entries) {
    if (!f.endsWith('.otf')) continue
    const stem = f.slice(0, -4)
    if (stem.includes('[')) continue // skip variable fonts
    const dash = stem.lastIndexOf('-')
    const style = dash > 0 ? stem.slice(dash + 1) : 'Regular'
    const isWeight = style in NAMED_WEIGHT
    const isStretch = style in NAMED_STRETCH
    const siblingFamily = !isWeight && !isStretch && style !== 'Regular'
      ? `${meta.display} ${style}`
      : undefined
    cuts.push({
      stem,
      style,
      weight: NAMED_WEIGHT[style] ?? meta.weight,
      stretch: NAMED_STRETCH[style],
      siblingFamily,
    })
  }
  cuts.sort((a, b) => {
    if (a.style === 'Regular' && b.style !== 'Regular') return -1
    if (b.style === 'Regular' && a.style !== 'Regular') return 1
    return a.style.localeCompare(b.style)
  })
  return cuts
}
