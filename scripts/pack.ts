#!/usr/bin/env bun
/**
 * Generate per-family npm packages under packages/<family>/.
 * Each package ships:
 *   - package.json (@nps-fonts/<family>)
 *   - README.md
 *   - LICENSE -> ../../OFL.txt
 *   - index.css with @font-face declarations
 *   - fonts/  with .otf, .woff, .woff2 copies
 *
 * The meta package @nps-fonts/all imports all five.
 */

import { copyFile, mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { ALL_FAMILIES, type FamilyId } from './lib/common.ts'
import { FAMILIES } from './families/index.ts'

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

const WEIGHT_VAL: Record<string, number> = {
  Light: 300, Regular: 400, Medium: 500, Bold: 700, Black: 900,
}

function buildCss(id: FamilyId): string {
  const family = FAMILIES[id]
  const lines: string[] = [`/* ${family.familyName} — @font-face declarations. */`, '']
  for (const m of family.masters) {
    const styleSuffix = m.styleName.replace(/\s+/g, '')
    const base = `${family.fileStem}-${styleSuffix}`
    const w = WEIGHT_VAL[m.weight] ?? 400
    lines.push(
      '@font-face {',
      `  font-family: "${family.familyName}";`,
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
  return lines.join('\n')
}

function buildPkgJson(id: FamilyId): object {
  const family = FAMILIES[id]
  return {
    name: `@nps-fonts/${id}`,
    version: VERSION,
    description: `${family.familyName} — open-source typeface inspired by U.S. National Park Service signage. Unaffiliated with the NPS.`,
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
  const family = FAMILIES[id]
  return `# @nps-fonts/${id}

${family.familyName} — open-source typeface inspired by U.S. National Park Service signage. Released under the [SIL Open Font License 1.1](./LICENSE). **This project is independent and not affiliated with the U.S. National Park Service.**

## Install

\`\`\`bash
bun add @nps-fonts/${id}
# or: npm install @nps-fonts/${id}
\`\`\`

## Use

\`\`\`css
@import "@nps-fonts/${id}";

body { font-family: "${family.familyName}", system-ui, sans-serif; }
\`\`\`

Or via CDN, no install required:

\`\`\`html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@nps-fonts/${id}/index.css">
\`\`\`

## Masters

${family.masters.map(m => `- **${m.styleName}** — weight ${WEIGHT_VAL[m.weight]}${m.italic ? ', italic' : ''}`).join('\n')}

## Files

| Format | Path |
|---|---|
| OTF    | \`fonts/otf/${family.fileStem}-*.otf\` |
| WOFF   | \`fonts/woff/${family.fileStem}-*.woff\` |
| WOFF2  | \`fonts/woff2/${family.fileStem}-*.woff2\` |

## Project

Source, full specimen, and the other four families in the suite:
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
  console.log(`Run \`bun publish\` from each package directory, or use scripts/publish.sh.`)
}

await main()
