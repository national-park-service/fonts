#!/usr/bin/env bun
/**
 * Build the static specimen site under web/dist/.
 *
 *   bun run scripts/web.ts            # build
 *   bun run scripts/web.ts --serve    # build + serve on http://localhost:3000
 */

import { copyFile, mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { ALL_FAMILIES, type FamilyId } from './lib/common.ts'
import { FAMILIES } from './families/index.ts'

const ROOT = resolve(import.meta.dir, '..')
const FONTS_DIR = resolve(ROOT, 'fonts')
const WEB_SRC = resolve(ROOT, 'web')
const DIST = resolve(WEB_SRC, 'dist')

const WEIGHT_VAL: Record<string, number> = {
  Light: 300, Regular: 400, Medium: 500, Bold: 700, Black: 900,
}

async function copyDir(src: string, dst: string) {
  await mkdir(dst, { recursive: true })
  for (const entry of await readdir(src, { withFileTypes: true })) {
    const s = resolve(src, entry.name)
    const d = resolve(dst, entry.name)
    if (entry.isDirectory()) await copyDir(s, d)
    else await copyFile(s, d)
  }
}

async function buildFamilyCss(id: FamilyId): Promise<string> {
  const family = FAMILIES[id]
  const lines: string[] = [
    `/* ${family.familyName} — generated @font-face declarations. */`,
    '',
  ]
  for (const m of family.masters) {
    const styleSuffix = m.styleName.replace(/\s+/g, '')
    const base = `${family.fileStem}-${styleSuffix}`
    const url = `../fonts/${id}`
    const w = WEIGHT_VAL[m.weight] ?? 400
    lines.push(
      '@font-face {',
      `  font-family: "${family.familyName}";`,
      `  src: url("${url}/woff2/${base}.woff2") format("woff2"),`,
      `       url("${url}/woff/${base}.woff") format("woff"),`,
      `       url("${url}/otf/${base}.otf") format("opentype");`,
      `  font-weight: ${w};`,
      `  font-style: ${m.italic ? 'italic' : 'normal'};`,
      '  font-display: swap;',
      '}',
      '',
    )
  }
  return lines.join('\n')
}

const PANGRAMS: Record<FamilyId, string> = {
  'wayfinder-sans': 'Where wild rivers carve quartz canyons.',
  'wayfinder-serif': 'Of ridges, switchbacks & freezing fog.',
  'campfire-script': 'Pack out everything you packed in.',
  'switchback': 'NORTH RIM · 14.7 MILES · ELEV 8200',
  'cairn': 'TRAIL CLOSED 18:00',
}

const HERO_DISPLAY: Record<FamilyId, string> = {
  'wayfinder-sans': 'Wayfinder',
  'wayfinder-serif': 'Wayfinder',
  'campfire-script': 'Campfire',
  'switchback': 'Switchback',
  'cairn': 'CAIRN',
}

function familyWaterfall(id: FamilyId): string {
  const family = FAMILIES[id]
  const sample = PANGRAMS[id]
  return family.masters
    .map((m) => {
      const w = WEIGHT_VAL[m.weight] ?? 400
      const style = m.italic ? 'italic' : 'normal'
      return `<div class="row">
        <span class="label">${m.styleName} · ${w}</span>
        <span class="specimen" style="font-family: '${family.familyName}'; font-weight: ${w}; font-style: ${style};">${sample}</span>
      </div>`
    })
    .join('\n')
}

function familyCard(id: FamilyId): string {
  const family = FAMILIES[id]
  const displayWeight = family.masters.some(m => m.weight === 'Bold' || m.weight === 'Black') ? 700 : 400
  return `
<section class="family" id="${id}">
  <link rel="stylesheet" href="./css/${id}.css">
  <header class="family-head">
    <h2 class="family-name">${family.familyName}</h2>
    <span class="family-meta">${family.masters.length} master${family.masters.length > 1 ? 's' : ''} · OTF · WOFF · WOFF2 · Latin-1</span>
  </header>
  <div class="family-display" style="font-family: '${family.familyName}'; font-weight: ${displayWeight};">
    ${HERO_DISPLAY[id]}
  </div>
  <div class="family-waterfall">
    ${familyWaterfall(id)}
  </div>
  <div class="family-actions">
    <a class="btn primary" href="./families/${id}.html">Open specimen</a>
    <a class="btn" href="./fonts/${id}/">Download files</a>
  </div>
  <pre class="snippet"><button class="copy">copy</button>bun add @nps-fonts/${id}

@import "@nps-fonts/${id}";
font-family: "${family.familyName}";</pre>
</section>`
}

function pairings(): string {
  return `
<section class="pairings">
  <h2>Pairings</h2>
  <div class="pairing">
    <div class="pair-meta">
      Cairn over Wayfinder Serif
      <strong>Display + body</strong>
    </div>
    <div>
      <h3 class="pair-headline">Half Dome at first light</h3>
      <p class="pair-body">A four-mile climb out of the valley brings you to the cables — set early, climb deliberately, and turn back if the granite is wet. The afternoon thunderstorms come fast in July.</p>
    </div>
  </div>
  <div class="pairing script">
    <div class="pair-meta">
      Campfire Script over Wayfinder Sans
      <strong>Headline + body</strong>
    </div>
    <div>
      <h3 class="pair-headline">From the trailhead</h3>
      <p class="pair-body" style="font-family: 'Wayfinder Sans', sans-serif;">Three rangers, two switchbacks, and one borrowed map later, we found the unmarked spring half a mile past the burned cedar. Best water on the loop.</p>
    </div>
  </div>
  <div class="pairing switchback">
    <div class="pair-meta">
      Switchback over Wayfinder Serif
      <strong>Poster + body</strong>
    </div>
    <div>
      <h3 class="pair-headline">North Rim · 14.7 mi</h3>
      <p class="pair-body">Long, exposed, and worth every step. Carry three liters and start before sunrise — the rim trail offers no shade until the spruce-fir at mile nine.</p>
    </div>
  </div>
</section>`
}

function indexHtml(): string {
  const families = ALL_FAMILIES.map(familyCard).join('\n')
  const fontFaceImports = ALL_FAMILIES.map(id => `<link rel="stylesheet" href="./css/${id}.css">`).join('\n  ')
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NPS Fonts — open-source typefaces inspired by U.S. national parks</title>
  <meta name="description" content="Open-source typefaces inspired by U.S. National Park Service signage. Built from scratch, released under the SIL Open Font License 1.1. Wayfinder Sans, Wayfinder Serif, Campfire Script, Switchback, Cairn.">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cpath fill='%23b04a2e' d='M32 4 L60 56 L4 56 Z'/%3E%3C/svg%3E">
  ${fontFaceImports}
  <link rel="stylesheet" href="./assets/css/main.css">
</head>
<body>
  <header class="site-header">
    <div class="wrap">
      <span class="brand">NPS Fonts<span class="dot">.</span></span>
      <nav class="nav">
        <a href="#wayfinder-sans">Sans</a>
        <a href="#wayfinder-serif">Serif</a>
        <a href="#campfire-script">Script</a>
        <a href="#switchback">Switchback</a>
        <a href="#cairn">Cairn</a>
        <a href="https://github.com/stacksjs/nps-fonts">GitHub</a>
      </nav>
    </div>
  </header>

  <main class="wrap">
    <section class="hero">
      <h1>Built for the<br><span class="accent">long trail.</span></h1>
      <p class="lede">Five open-source typefaces inspired by U.S. National Park Service signage, posters, and trail markers — released under the SIL Open Font License 1.1, free for any use.</p>
      <p class="signature">Pack it in, pack it out.</p>
      <div class="pills">
        <span class="pill">5 families</span>
        <span class="pill">24 masters</span>
        <span class="pill">Latin-1</span>
        <span class="pill">Kerning</span>
        <span class="pill">Ligatures</span>
        <span class="pill">OTF · WOFF · WOFF2</span>
      </div>
      <p class="disclaimer">This project is independent and not affiliated with, endorsed by, or sponsored by the U.S. National Park Service. Names and aesthetics are inspired by the broader public-lands visual tradition.</p>
    </section>

    <section class="families">
      ${families}
    </section>

    ${pairings()}
  </main>

  <footer class="site-footer">
    <div class="wrap">
      <div>
        <h4>NPS Fonts</h4>
        <p>Open-source typefaces inspired by U.S. National Park Service signage. Released under the SIL Open Font License 1.1.</p>
        <p>© 2026 NPS Fonts contributors</p>
      </div>
      <div>
        <h4>Project</h4>
        <ul>
          <li><a href="https://github.com/stacksjs/nps-fonts">Repository</a></li>
          <li><a href="https://github.com/stacksjs/nps-fonts/issues">Issues</a></li>
          <li><a href="https://github.com/stacksjs/nps-fonts/blob/main/CONTRIBUTING.md">Contributing</a></li>
          <li><a href="https://github.com/stacksjs/nps-fonts/blob/main/OFL.txt">License (OFL)</a></li>
        </ul>
      </div>
      <div>
        <h4>Install</h4>
        <ul>
          <li><a href="https://www.npmjs.com/package/@nps-fonts/all">npm</a></li>
          <li><a href="https://www.jsdelivr.com/package/npm/@nps-fonts/all">jsDelivr</a></li>
          <li><a href="https://github.com/stacksjs/nps-fonts/releases">Release ZIPs</a></li>
        </ul>
      </div>
    </div>
  </footer>

  <script src="./assets/js/typetester.js"></script>
</body>
</html>`
}

function familyPageHtml(id: FamilyId): string {
  const family = FAMILIES[id]
  const cssHref = `../css/${id}.css`
  const mainCss = '../assets/css/main.css'
  const distinctWeights = Array.from(new Set(family.masters.filter(m => !m.italic).map(m => m.weight)))

  const tester = `
<section class="tester" data-tester>
  <h2>Type tester</h2>
  <div class="tester-controls">
    <label>Size <span class="value" data-value="size">64px</span><input type="range" data-control="size" min="14" max="200" value="64"></label>
    <label>Tracking <span class="value" data-value="tracking">0.000</span><input type="range" data-control="tracking" min="-0.05" max="0.3" step="0.005" value="0"></label>
    <label>Weight <select data-control="weight">${distinctWeights.map((w) => {
      const v = WEIGHT_VAL[w] ?? 400
      return `<option value="${v}">${w} (${v})</option>`
    }).join('')}</select></label>
    <label>Style <select data-control="style"><option>normal</option><option>italic</option></select></label>
  </div>
  <textarea class="tester-area" style="font-family: '${family.familyName}'">The quick brown fox jumps over the lazy dog.
0123456789 — “fi fl” · café résumé naïve coöperate
HALF DOME · NORTH RIM · 14.7 MI</textarea>
</section>`

  const codePoints: number[] = []
  for (let cp = 0x21; cp <= 0x7E; cp++) codePoints.push(cp)
  for (const cp of [0xA1, 0xA2, 0xA3, 0xA5, 0xA7, 0xA9, 0xAE, 0xB0, 0xB1, 0xB5, 0xB6, 0xB7, 0xBF]) codePoints.push(cp)
  for (let cp = 0xC0; cp <= 0xFF; cp++) {
    if (cp === 0xD7 || cp === 0xF7 || cp === 0xDE || cp === 0xFE || cp === 0xD0 || cp === 0xF0) continue
    codePoints.push(cp)
  }
  const glyphs = `<section class="glyphs-section"><h2>Character map</h2><div class="glyphs" style="font-family: '${family.familyName}'">${
    codePoints.map(cp => `<span class="cell" data-cp="${cp.toString(16).toUpperCase().padStart(4, '0')}">${escapeHtml(String.fromCodePoint(cp))}</span>`).join('')
  }</div></section>`

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${family.familyName} · NPS Fonts</title>
  <link rel="stylesheet" href="${cssHref}">
  <link rel="stylesheet" href="${mainCss}">
</head>
<body>
  <header class="site-header">
    <div class="wrap">
      <a href="../" class="brand">NPS Fonts<span class="dot">.</span></a>
      <nav class="nav"><a href="../">All families</a> <a href="https://github.com/stacksjs/nps-fonts">GitHub</a></nav>
    </div>
  </header>
  <main class="wrap">
    <section class="hero">
      <h1 style="font-family: '${family.familyName}'">${HERO_DISPLAY[id]}</h1>
      <p class="lede">${PANGRAMS[id]}</p>
      <div class="pills">
        <span class="pill">${family.masters.length} masters</span>
        <span class="pill">OTF · WOFF · WOFF2</span>
        <span class="pill">Latin-1 supplement</span>
        <span class="pill">Kerning</span>
        ${family.id.startsWith('wayfinder') ? '<span class="pill">Ligatures</span>' : ''}
      </div>
    </section>
    <section class="families">
      <div class="family">
        <div class="family-waterfall">${familyWaterfall(id)}</div>
        <pre class="snippet"><button class="copy">copy</button>bun add @nps-fonts/${id}

@import "@nps-fonts/${id}";
font-family: "${family.familyName}";</pre>
      </div>
    </section>
    ${tester}
    ${glyphs}
  </main>
  <footer class="site-footer">
    <div class="wrap">
      <div><h4>NPS Fonts</h4><p>© 2026 contributors · OFL-1.1</p></div>
      <div><h4>Project</h4><ul><li><a href="https://github.com/stacksjs/nps-fonts">Repository</a></li><li><a href="../">All families</a></li></ul></div>
      <div></div>
    </div>
  </footer>
  <script src="../assets/js/typetester.js"></script>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
}

async function build() {
  await rm(DIST, { recursive: true, force: true })
  await mkdir(DIST, { recursive: true })

  await copyDir(resolve(WEB_SRC, 'assets'), resolve(DIST, 'assets'))
  await copyDir(FONTS_DIR, resolve(DIST, 'fonts'))

  await mkdir(resolve(DIST, 'css'), { recursive: true })
  for (const id of ALL_FAMILIES) {
    await writeFile(resolve(DIST, 'css', `${id}.css`), await buildFamilyCss(id))
  }

  await writeFile(resolve(DIST, 'index.html'), indexHtml())
  await mkdir(resolve(DIST, 'families'), { recursive: true })
  for (const id of ALL_FAMILIES) {
    await writeFile(resolve(DIST, 'families', `${id}.html`), familyPageHtml(id))
  }

  console.log(`Built specimen site → ${DIST}`)
}

async function serve() {
  const argv = Bun.argv.slice(2)
  const portArg = argv[argv.indexOf('--port') + 1]
  const requested = portArg ? Number(portArg) : Number(process.env.PORT ?? 3000)
  const handler = (req: Request) => {
    const url = new URL(req.url)
    let p = decodeURIComponent(url.pathname)
    if (p.endsWith('/')) p += 'index.html'
    const file = Bun.file(resolve(DIST, '.' + p))
    return new Response(file)
  }
  // Try the requested port, then walk forward up to 20 ports if it's busy.
  for (let port = requested; port < requested + 20; port++) {
    try {
      Bun.serve({ port, fetch: handler })
      console.log(`Serving ${DIST} at http://localhost:${port}`)
      return
    }
    catch (err) {
      const e = err as { code?: string }
      if (e.code !== 'EADDRINUSE') throw err
      console.log(`port ${port} busy, trying ${port + 1}…`)
    }
  }
  throw new Error(`No free port found in range ${requested}–${requested + 19}`)
}

const argv = Bun.argv.slice(2)
await build()
if (argv.includes('--serve')) {
  await serve()
}
