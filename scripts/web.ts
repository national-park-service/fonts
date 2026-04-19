#!/usr/bin/env bun
/**
 * Build the static specimen site under web/dist/. Outputs:
 *   web/dist/index.html
 *   web/dist/families/<family>.html
 *   web/dist/assets/css/main.css         (copied)
 *   web/dist/assets/js/typetester.js     (copied)
 *   web/dist/fonts/<family>/...          (copied from /fonts)
 *   web/dist/css/<family>.css            (generated @font-face)
 *
 *   bun run scripts/web.ts            # build
 *   bun run scripts/web.ts --serve    # build + serve on http://localhost:3000
 */

import { copyFile, mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { ALL_FAMILIES, FAMILY_DISPLAY, type FamilyId } from './lib/common.ts'
import { FAMILIES } from './families/index.ts'

const ROOT = resolve(import.meta.dir, '..')
const FONTS_DIR = resolve(ROOT, 'fonts')
const WEB_SRC = resolve(ROOT, 'web')
const DIST = resolve(WEB_SRC, 'dist')

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
  ]
  for (const m of family.masters) {
    const styleSuffix = m.styleName.replace(/\s+/g, '')
    const base = `${family.fileStem}-${styleSuffix}`
    const url = `../fonts/${id}`
    const weightVal = ({
      Light: 300, Regular: 400, Medium: 500, Bold: 700, Black: 900,
    } as Record<string, number>)[m.weight] ?? 400
    lines.push(
      '@font-face {',
      `  font-family: "${family.familyName}";`,
      `  src: url("${url}/woff2/${base}.woff2") format("woff2"),`,
      `       url("${url}/woff/${base}.woff") format("woff"),`,
      `       url("${url}/otf/${base}.otf") format("opentype");`,
      `  font-weight: ${weightVal};`,
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

function familyWaterfall(id: FamilyId): string {
  const family = FAMILIES[id]
  const sample = PANGRAMS[id]
  return family.masters
    .map((m) => {
      const weight = ({
        Light: 300, Regular: 400, Medium: 500, Bold: 700, Black: 900,
      } as Record<string, number>)[m.weight] ?? 400
      const style = m.italic ? 'italic' : 'normal'
      return `<div class="row">
  <span class="label">${m.styleName}</span>
  <span class="specimen" style="font-family: '${family.familyName}'; font-weight: ${weight}; font-style: ${style};">${sample}</span>
</div>`
    })
    .join('\n')
}

function familyCard(id: FamilyId): string {
  const family = FAMILIES[id]
  const displayWeight = family.masters.length > 1 ? 700 : 400
  const cssHref = `./css/${id}.css`
  return `
<section class="family" id="${id}">
  <link rel="stylesheet" href="${cssHref}">
  <header class="family-head">
    <h2 class="family-name">${family.familyName}</h2>
    <span class="family-meta">${family.masters.length} master${family.masters.length > 1 ? 's' : ''} · OTF · WOFF · WOFF2</span>
  </header>
  <div class="family-display" style="font-family: '${family.familyName}'; font-weight: ${displayWeight};">
    ${displayString(id)}
  </div>
  <div class="family-waterfall">
    ${familyWaterfall(id)}
  </div>
  <div class="family-actions">
    <a class="btn primary" href="./families/${id}.html">Specimen</a>
    <a class="btn" href="./fonts/${id}/">Download</a>
  </div>
  <pre class="snippet">@import url("https://cdn.jsdelivr.net/npm/@nps-fonts/${id}/index.css");

font-family: "${family.familyName}";</pre>
</section>`
}

function displayString(id: FamilyId): string {
  const map: Record<FamilyId, string> = {
    'wayfinder-sans': 'Wayfinder',
    'wayfinder-serif': 'Wayfinder',
    'campfire-script': 'Campfire',
    'switchback': 'Switchback',
    'cairn': 'CAIRN',
  }
  return map[id]
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
  <meta name="description" content="Open-source typefaces inspired by U.S. National Park Service signage. Built from scratch, released under the SIL Open Font License 1.1.">
  ${fontFaceImports}
  <link rel="stylesheet" href="./assets/css/main.css">
</head>
<body>
  <header class="site-header">
    <div class="wrap">
      <span class="brand">NPS Fonts</span>
      <nav class="nav">
        <a href="#wayfinder-sans">Wayfinder Sans</a>
        <a href="#wayfinder-serif">Wayfinder Serif</a>
        <a href="#campfire-script">Campfire Script</a>
        <a href="#switchback">Switchback</a>
        <a href="#cairn">Cairn</a>
        <a href="https://github.com/stacksjs/nps-fonts">GitHub</a>
      </nav>
    </div>
  </header>

  <main class="wrap">
    <section class="hero">
      <h1>Built for the long trail.</h1>
      <p class="lede">Five open-source typefaces inspired by U.S. National Park Service signage, posters, and trail markers — released under the SIL Open Font License 1.1, free for any use.</p>
      <p class="signature">Pack it in, pack it out.</p>
      <p class="disclaimer">This project is independent and not affiliated with, endorsed by, or sponsored by the U.S. National Park Service. Names and aesthetics are inspired by the broader public-lands visual tradition.</p>
    </section>

    <section class="families">
      ${families}
    </section>
  </main>

  <footer class="site-footer">
    <div class="wrap">
      <span>© 2026 NPS Fonts contributors · OFL-1.1</span>
      <span><a href="https://github.com/stacksjs/nps-fonts">GitHub</a> · <a href="https://github.com/stacksjs/nps-fonts/issues">Issues</a></span>
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
  const tester = `
<section class="tester" data-tester>
  <h2>Type tester</h2>
  <div class="tester-controls">
    <label>Size <input type="range" data-control="size" min="14" max="160" value="56"></label>
    <label>Tracking <input type="range" data-control="tracking" min="-0.05" max="0.3" step="0.005" value="0"></label>
    <label>Weight <select data-control="weight">${family.masters.filter(m => !m.italic).map((m) => {
    const w = ({ Light: 300, Regular: 400, Medium: 500, Bold: 700, Black: 900 } as Record<string, number>)[m.weight] ?? 400
    return `<option value="${w}">${m.styleName} (${w})</option>`
  }).join('')}</select></label>
    <label>Style <select data-control="style"><option>normal</option><option>italic</option></select></label>
  </div>
  <textarea class="tester-area" style="font-family: '${family.familyName}'">The quick brown fox jumps over the lazy dog.
0123456789</textarea>
</section>`

  const glyphs = '<section class="tester"><h2>Character set</h2><div class="glyphs" style="font-family: \''
    + family.familyName + '\'">'
    + Array.from({ length: 0x7E - 0x20 + 1 }, (_, i) => {
      const cp = 0x20 + i
      return `<span class="cell">${escapeHtml(String.fromCodePoint(cp))}</span>`
    }).join('')
    + '</div></section>'

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
      <a href="../" class="brand">NPS Fonts</a>
      <nav class="nav"><a href="../">All families</a> <a href="https://github.com/stacksjs/nps-fonts">GitHub</a></nav>
    </div>
  </header>
  <main class="wrap">
    <section class="hero">
      <h1 style="font-family: '${family.familyName}'">${family.familyName}</h1>
      <p class="lede">${PANGRAMS[id]}</p>
    </section>
    <section class="families">
      <div class="family">
        <div class="family-waterfall">${familyWaterfall(id)}</div>
        <pre class="snippet">@import url("https://cdn.jsdelivr.net/npm/@nps-fonts/${id}/index.css");

font-family: "${family.familyName}";</pre>
      </div>
    </section>
    ${tester}
    ${glyphs}
  </main>
  <footer class="site-footer">
    <div class="wrap">
      <span>© 2026 NPS Fonts · OFL-1.1</span>
      <span><a href="https://github.com/stacksjs/nps-fonts">GitHub</a></span>
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

  // Copy assets and fonts
  await copyDir(resolve(WEB_SRC, 'assets'), resolve(DIST, 'assets'))
  await copyDir(FONTS_DIR, resolve(DIST, 'fonts'))

  // Generate per-family CSS
  await mkdir(resolve(DIST, 'css'), { recursive: true })
  for (const id of ALL_FAMILIES) {
    await writeFile(resolve(DIST, 'css', `${id}.css`), await buildFamilyCss(id))
  }

  // Generate HTML pages
  await writeFile(resolve(DIST, 'index.html'), indexHtml())
  await mkdir(resolve(DIST, 'families'), { recursive: true })
  for (const id of ALL_FAMILIES) {
    await writeFile(resolve(DIST, 'families', `${id}.html`), familyPageHtml(id))
  }

  console.log(`Built specimen site → ${DIST}`)
}

async function serve() {
  const port = 3000
  Bun.serve({
    port,
    fetch(req) {
      const url = new URL(req.url)
      let p = decodeURIComponent(url.pathname)
      if (p.endsWith('/')) p += 'index.html'
      const file = Bun.file(resolve(DIST, '.' + p))
      return new Response(file)
    },
  })
  console.log(`Serving ${DIST} at http://localhost:${port}`)
}

const argv = Bun.argv.slice(2)
await build()
if (argv.includes('--serve')) {
  await serve()
}
// Reference unused names so tools don't strip them.
void FAMILY_DISPLAY
