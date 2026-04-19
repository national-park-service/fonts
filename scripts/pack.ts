#!/usr/bin/env bun
/**
 * Generate per-family npm packages under packages/<family>/.
 */

import { copyFile, mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { ALL_FAMILIES, type FamilyId } from './lib/common.ts'
import { FAMILY_SOURCES, WEIGHT_VALUE } from './sources.ts'

const ROOT = resolve(import.meta.dir, '..')
const FONTS = resolve(ROOT, 'fonts')
const PACKAGES = resolve(ROOT, 'packages')

const VERSION = process.env.NPM_VERSION ?? readVersion()

function readVersion(): string {
  const pkg = require(resolve(ROOT, 'package.json'))
  return pkg.version as string
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

function buildCss(id: FamilyId): string {
  const fam = FAMILY_SOURCES[id]
  const lines: string[] = [
    `/* ${fam.newFamilyName} — @font-face declarations. */`,
    `/* Forked from ${fam.sourceFamily} (${fam.sourceLicense}) by ${fam.sourceAuthor}. */`,
    '',
  ]
  for (const m of fam.sources) {
    const styleSuffix = m.styleName.replace(/\s+/g, '')
    const base = `${fam.newFileStem}-${styleSuffix}`
    if (m.variable) {
      const [wMin, wMax] = m.weightRange ?? [100, 900]
      lines.push(
        '@font-face {',
        `  font-family: "${fam.newFamilyName}";`,
        `  src: url("./fonts/woff2/${base}.woff2") format("woff2-variations"),`,
        `       url("./fonts/woff2/${base}.woff2") format("woff2"),`,
        `       url("./fonts/woff/${base}.woff") format("woff"),`,
        `       url("./fonts/otf/${base}.otf") format("opentype-variations"),`,
        `       url("./fonts/otf/${base}.otf") format("opentype");`,
        `  font-weight: ${wMin} ${wMax};`,
        `  font-style: ${m.italic ? 'italic' : 'normal'};`,
        '  font-display: swap;',
        '}',
        '',
      )
    }
    else {
      const w = WEIGHT_VALUE[m.weight ?? 'Regular']
      lines.push(
        '@font-face {',
        `  font-family: "${fam.newFamilyName}";`,
        `  src: url("./fonts/woff2/${base}.woff2") format("woff2"),`,
        `       url("./fonts/woff/${base}.woff") format("woff"),`,
        `       url("./fonts/otf/${base}.otf") format("opentype");`,
        `  font-weight: ${w};`,
        `  font-style: ${m.italic ? 'italic' : 'normal'};`,
        '  font-display: swap;',
        '}',
        '',
      )
    }
  }
  return lines.join('\n')
}

function buildPkgJson(id: FamilyId): object {
  const fam = FAMILY_SOURCES[id]
  return {
    name: `@nps-fonts/${id}`,
    version: VERSION,
    description: `${fam.newFamilyName} — open-source typeface inspired by U.S. National Park Service signage. Forked from ${fam.sourceFamily} (${fam.sourceLicense}). Unaffiliated with the NPS.`,
    keywords: ['font', 'typography', 'webfont', 'ofl', 'national-parks', id],
    license: 'OFL-1.1',
    homepage: `https://github.com/stacksjs/nps-fonts#${id}`,
    repository: {
      type: 'git',
      url: 'git+https://github.com/stacksjs/nps-fonts.git',
      directory: `packages/${id}`,
    },
    bugs: 'https://github.com/stacksjs/nps-fonts/issues',
    main: 'index.css',
    style: 'index.css',
    files: ['index.css', 'fonts/', 'README.md', 'LICENSE'],
    publishConfig: { access: 'public' },
    sideEffects: ['*.css'],
  }
}

function buildReadme(id: FamilyId): string {
  const fam = FAMILY_SOURCES[id]
  return `# @nps-fonts/${id}

${fam.newFamilyName} — open-source typeface inspired by U.S. National Park Service signage. Released under the [SIL Open Font License 1.1](./LICENSE). **Independent project, not affiliated with the U.S. National Park Service.**

## Heritage

Forked from **[${fam.sourceFamily}](${fam.sourceRepo})** by ${fam.sourceAuthor} (${fam.sourceLicense}). Renamed and re-released under SIL OFL 1.1.

## Install

\`\`\`bash
bun add @nps-fonts/${id}
# or: npm install @nps-fonts/${id}
\`\`\`

## Use

\`\`\`css
@import "@nps-fonts/${id}";

body { font-family: "${fam.newFamilyName}", system-ui, sans-serif; }
\`\`\`

Or via CDN:

\`\`\`html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@nps-fonts/${id}/index.css">
\`\`\`

## Files

| Format | Path |
|---|---|
| OTF    | \`fonts/otf/${fam.newFileStem}-*.otf\` |
| TTF    | \`fonts/ttf/${fam.newFileStem}-*.ttf\` |
| WOFF   | \`fonts/woff/${fam.newFileStem}-*.woff\` |
| WOFF2  | \`fonts/woff2/${fam.newFileStem}-*.woff2\` |

## Project

Source, full specimen, and the other four families:
<https://github.com/stacksjs/nps-fonts>
`
}

async function buildFamilyPackage(id: FamilyId) {
  const dir = resolve(PACKAGES, id)
  await rm(dir, { recursive: true, force: true })
  await mkdir(dir, { recursive: true })

  await writeFile(resolve(dir, 'package.json'), `${JSON.stringify(buildPkgJson(id), null, 2)}\n`)
  await writeFile(resolve(dir, 'README.md'), buildReadme(id))
  await writeFile(resolve(dir, 'index.css'), buildCss(id))
  await copyFile(resolve(ROOT, 'OFL.txt'), resolve(dir, 'LICENSE'))

  const fontsSrc = resolve(FONTS, id)
  const fontsDst = resolve(dir, 'fonts')
  await copyDir(fontsSrc, fontsDst)
}

async function buildMetaPackage() {
  const dir = resolve(PACKAGES, 'all')
  await rm(dir, { recursive: true, force: true })
  await mkdir(dir, { recursive: true })

  const pkg = {
    name: '@nps-fonts/all',
    version: VERSION,
    description: 'NPS Fonts meta-package — installs all five families.',
    license: 'OFL-1.1',
    homepage: 'https://github.com/stacksjs/nps-fonts',
    repository: {
      type: 'git',
      url: 'git+https://github.com/stacksjs/nps-fonts.git',
      directory: 'packages/all',
    },
    bugs: 'https://github.com/stacksjs/nps-fonts/issues',
    main: 'index.css',
    style: 'index.css',
    files: ['index.css', 'README.md', 'LICENSE'],
    publishConfig: { access: 'public' },
    sideEffects: ['*.css'],
    dependencies: Object.fromEntries(ALL_FAMILIES.map(id => [`@nps-fonts/${id}`, VERSION])),
  }

  await writeFile(resolve(dir, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`)
  await writeFile(
    resolve(dir, 'index.css'),
    ALL_FAMILIES.map(id => `@import "@nps-fonts/${id}";`).join('\n') + '\n',
  )
  await writeFile(
    resolve(dir, 'README.md'),
    `# @nps-fonts/all

The full NPS Fonts suite — all five families in one install.

\`\`\`bash
bun add @nps-fonts/all
\`\`\`

\`\`\`css
@import "@nps-fonts/all";
\`\`\`

See <https://github.com/stacksjs/nps-fonts> for individual families and the full specimen.
`,
  )
  await copyFile(resolve(ROOT, 'OFL.txt'), resolve(dir, 'LICENSE'))
}

async function main() {
  await mkdir(PACKAGES, { recursive: true })
  for (const id of ALL_FAMILIES) {
    await buildFamilyPackage(id)
    console.log(`✓ packages/${id}`)
  }
  await buildMetaPackage()
  console.log(`✓ packages/all`)
  console.log(`\nVersion: ${VERSION}`)
}

await main()
