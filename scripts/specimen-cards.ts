#!/usr/bin/env bun
/**
 * Generate a single HTML page with one self-contained "specimen card"
 * per family — laid out for clean per-card screenshot capture (used in
 * the README and on GitHub).
 *
 *   bun run scripts/specimen-cards.ts            # build cards + screenshot each
 *   bun run scripts/specimen-cards.ts --html     # build HTML only (no screenshots)
 *
 * Each card is an isolated 1200x630-ish block (Twitter/Open-Graph-ish
 * aspect) that the `screenshot.ts` helper can target by CSS selector.
 * Output PNGs land in `specimens/cards/<family-id>.png`.
 *
 * The cards are served from the running dev server at
 * http://localhost:3001/specimen-cards.html so the screenshot script
 * can resolve `url("./fonts/...")` paths.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { ALL_FAMILIES, FAMILY_DISPLAY, type FamilyId } from './lib/common.ts'
import { discoverStaticCuts, hasVariable, type StaticCut } from './lib/cuts.ts'

const ROOT = resolve(import.meta.dir, '..')
const DIST = resolve(ROOT, 'web', 'dist')
const SPECIMENS = resolve(ROOT, 'specimens', 'cards')

const CARD_W = 1200
const CARD_H = 630

interface CardSpec {
  id: FamilyId
  hero: string
  /** Sample lines shown beneath the hero (in family's font). */
  samples: string[]
  /** When true, render the family-name title in the family's own font. */
  titleInFamily?: boolean
  /** Override the body sample CSS for unusual layouts (e.g. pictograph grid). */
  customBody?: string
}

function ligaStyle(id: FamilyId): string {
  return id === 'campmate-script' ? '; font-feature-settings: "liga" on' : ''
}

function fontFaceLink(id: FamilyId): string {
  return `<link rel="stylesheet" href="./css/${id}.css">`
}

function cuts(id: FamilyId): Promise<StaticCut[]> {
  return discoverStaticCuts(id)
}

async function cutLabel(id: FamilyId): Promise<string> {
  const list = await cuts(id)
  const variable = hasVariable(id)
  const total = list.length + (variable ? 1 : 0)
  const styles = (variable ? ['Variable'] : []).concat(list.map(c => c.style))
  return `${total} ${total === 1 ? 'cut' : 'cuts'} · ${styles.join(' · ')}`
}

async function renderCard(spec: CardSpec): Promise<string> {
  const meta = FAMILY_DISPLAY[spec.id]
  const extra = ligaStyle(spec.id)
  const titleStyle = spec.titleInFamily
    ? `font-family: '${meta.display}'${extra}`
    : `font-family: 'Redwood Serif', Georgia, serif`
  const cutsLabel = await cutLabel(spec.id)
  const body = spec.customBody ?? `
        <div class="card-hero" style="font-family: '${meta.display}'${extra}">${spec.hero}</div>
        <div class="card-samples" style="font-family: '${meta.display}'${extra}">
          ${spec.samples.map(s => `<div class="card-line">${s}</div>`).join('\n          ')}
        </div>`
  return `
<section class="card" data-card="${spec.id}" id="card-${spec.id}">
  <header class="card-head">
    <h2 class="card-name" style="${titleStyle}">${meta.display}</h2>
    <span class="card-cuts">${cutsLabel}</span>
  </header>
  ${body}
  <footer class="card-foot">
    <span class="card-tag">${meta.tagline}</span>
  </footer>
</section>`
}

const SPECS: CardSpec[] = [
  {
    id: 'nps-2026',
    hero: '2026',
    samples: [
      'CRATER LAKE · EST 1902 · ELEV 7100 FT',
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789',
    ],
    titleInFamily: true,
  },
  {
    id: 'redwood-serif',
    hero: 'Redwood',
    samples: [
      'The mountains are calling and I must go.',
      'ABCDEFGHIJKLM · abcdefghijklm · 1234567890',
    ],
    titleInFamily: true,
  },
  {
    id: 'campmate-script',
    hero: 'Campmate',
    samples: [
      'Welcome to Crooked River Camp',
      'oo · ll · oss · or · os · zz · ax · ux · ex · br',
    ],
    titleInFamily: true,
  },
  {
    id: 'nps-symbols',
    hero: '',
    samples: [],
    customBody: `
        <div class="card-hero card-hero-symbols" style="font-family: 'NPS Symbols'">AMTFPCSLW*BHODX</div>
        <div class="card-symbol-labels">arrowhead · mountain · tent · campfire · pine · compass · sun · lake · trail · star · backpack · hiker · check · diamond · close</div>`,
  },
  {
    id: 'sequoia-sans',
    hero: 'Sequoia',
    samples: [
      'YOSEMITE valley · est 1864 · Half Dome',
      'ABCDEFGHIJKLM · abcdefghijklm · 1234567890',
    ],
    titleInFamily: true,
  },
  {
    id: 'switchback',
    hero: 'SWITCHBACK',
    samples: [
      'NORTH RIM · 7100 FT · NEXT WATER 4 MI',
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789',
    ],
    titleInFamily: true,
  },
]

function pageHtml(cardsHtml: string): string {
  const links = ALL_FAMILIES.map(fontFaceLink).join('\n  ')
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Specimen cards · NPS Fonts</title>
  ${links}
  <style>
    :root {
      --ink: #1f2a23;
      --ink-soft: #4a5a4d;
      --rust: #b04a2e;
      --moss: #4f6b46;
      --bg: #f5efe2;
      --bg-card: #fbf6e9;
      --rule: #cbbfa2;
    }
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #1a1a14; }
    body {
      font-family: "Redwood Serif", Georgia, serif;
      color: var(--ink);
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
      padding: 32px;
      /* Trailing padding so scrollIntoView({block:'start'}) can push the
         last card to the viewport top when capturing it. */
      padding-bottom: ${CARD_H + 64}px;
      display: grid;
      gap: 32px;
    }
    .card {
      width: ${CARD_W}px;
      height: ${CARD_H}px;
      background: var(--bg);
      border: 1px solid var(--rule);
      border-radius: 12px;
      padding: 56px 64px 44px;
      display: grid;
      grid-template-rows: auto 1fr auto;
      gap: 28px;
      overflow: hidden;
      position: relative;
    }
    .card::before {
      content: "";
      position: absolute; left: 0; top: 0; bottom: 0;
      width: 8px; background: var(--rust);
    }
    .card-head {
      display: flex; align-items: baseline;
      gap: 24px; flex-wrap: wrap;
    }
    .card-name {
      font-weight: 700;
      font-size: 44px;
      letter-spacing: 0.005em;
      margin: 0;
      color: var(--ink);
    }
    .card-cuts {
      font-family: "NPS 2026", sans-serif;
      font-size: 13px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--ink-soft);
    }
    .card-hero {
      font-size: 144px;
      line-height: 0.95;
      letter-spacing: -0.005em;
      color: var(--ink);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: clip;
      align-self: center;
    }
    .card-hero-symbols {
      font-size: 88px;
      letter-spacing: 0.04em;
      color: var(--ink);
    }
    .card-samples {
      display: flex; flex-direction: column; gap: 6px;
      color: var(--ink);
    }
    .card-line {
      font-size: 28px;
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .card-symbol-labels {
      font-family: "Redwood Serif", Georgia, serif;
      font-size: 16px;
      color: var(--ink-soft);
      line-height: 1.4;
    }
    .card-foot {
      border-top: 1px dashed var(--rule);
      padding-top: 16px;
    }
    .card-tag {
      font-family: "Redwood Serif", Georgia, serif;
      font-style: italic;
      font-size: 16px;
      color: var(--ink-soft);
    }
    /* Family-specific tweaks. */
    [data-card="campmate-script"] .card-hero { color: var(--moss); }
    [data-card="campmate-script"] .card-name { color: var(--moss); }
    /* Hero sizing — tuned per family so the chosen string fully fits. */
    [data-card="nps-2026"] .card-hero { font-size: 184px; letter-spacing: 0.005em; }
    [data-card="switchback"] .card-hero { font-size: 110px; letter-spacing: 0.01em; }
    [data-card="redwood-serif"] .card-hero { font-size: 132px; }
    [data-card="sequoia-sans"] .card-hero { font-size: 168px; }
    [data-card="campmate-script"] .card-hero { font-size: 184px; }
  </style>
</head>
<body>
  ${cardsHtml}
</body>
</html>`
}

async function main(): Promise<void> {
  const argv = Bun.argv.slice(2)
  const htmlOnly = argv.includes('--html')

  const cardsHtml = (await Promise.all(SPECS.map(renderCard))).join('\n')
  await mkdir(DIST, { recursive: true })
  const outPath = resolve(DIST, 'specimen-cards.html')
  await writeFile(outPath, pageHtml(cardsHtml))
  console.log(`✓ wrote ${outPath}`)

  if (htmlOnly) return

  // Screenshot each card via the existing helper. Requires the dev server.
  await mkdir(SPECIMENS, { recursive: true })
  const port = process.env.PORT ?? '3001'
  for (const spec of SPECS) {
    const url = `http://localhost:${port}/specimen-cards.html`
    const out = resolve(SPECIMENS, `${spec.id}.png`)
    const proc = Bun.spawn({
      cmd: [
        'bun', 'run', 'scripts/screenshot.ts', url,
        '--width', String(CARD_W + 64), // page padding x2
        '--selector', `[data-card="${spec.id}"]`,
        '--out', out,
        '--wait', '1500',
      ],
      cwd: ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const code = await proc.exited
    if (code !== 0) {
      const err = await new Response(proc.stderr).text()
      console.error(`✗ ${spec.id}: screenshot failed (${code})`)
      console.error(err)
      process.exit(1)
    }
    console.log(`✓ ${spec.id} → specimens/cards/${spec.id}.png`)
  }
}

await main()
