#!/usr/bin/env bun
/**
 * Build orchestrator. Compiles every family (or a single one) to OTF,
 * WOFF, and WOFF2 under fonts/<family>/{otf,woff,woff2}/.
 *
 *   bun run scripts/build.ts --all
 *   bun run scripts/build.ts --family cairn
 */

import { resolve } from 'node:path'
import { ALL_FAMILIES, type FamilyId } from './lib/common.ts'
import { buildMaster } from './lib/font-writer.ts'
import { FAMILIES } from './families/index.ts'

const FONTS_DIR = resolve(import.meta.dir, '..', 'fonts')

interface Args {
  all: boolean
  families: FamilyId[]
}

function parseArgs(argv: string[]): Args {
  const args: Args = { all: false, families: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--all') args.all = true
    else if (a === '--family') {
      const v = argv[++i]
      if (!v) throw new Error('--family requires a value')
      if (!(ALL_FAMILIES as readonly string[]).includes(v))
        throw new Error(`Unknown family: ${v}. Known: ${ALL_FAMILIES.join(', ')}`)
      args.families.push(v as FamilyId)
    }
  }
  if (!args.all && args.families.length === 0) args.all = true
  return args
}

async function main() {
  const args = parseArgs(Bun.argv.slice(2))
  const targets: FamilyId[] = args.all ? [...ALL_FAMILIES] : args.families

  let totalMasters = 0
  let totalBytes = 0
  const start = performance.now()

  for (const id of targets) {
    const family = FAMILIES[id]
    console.log(`\n[${family.familyName}] building ${family.masters.length} master(s)`)
    for (const master of family.masters) {
      const t0 = performance.now()
      const out = await buildMaster(family, master, FONTS_DIR)
      const dt = (performance.now() - t0).toFixed(0)
      const otfSize = (await Bun.file(out.otf).arrayBuffer()).byteLength
      const woffSize = (await Bun.file(out.woff).arrayBuffer()).byteLength
      const woff2Size = (await Bun.file(out.woff2).arrayBuffer()).byteLength
      totalBytes += otfSize + woffSize + woff2Size
      totalMasters++
      console.log(
        `  ✓ ${master.styleName.padEnd(16)} `
        + `otf=${kb(otfSize)} woff=${kb(woffSize)} woff2=${kb(woff2Size)} `
        + `(${dt}ms)`,
      )
    }
  }

  const dt = ((performance.now() - start) / 1000).toFixed(1)
  console.log(
    `\nBuilt ${totalMasters} masters across ${targets.length} families `
    + `(${kb(totalBytes)} total) in ${dt}s.`,
  )
}

function kb(n: number): string {
  return `${(n / 1024).toFixed(1)}KB`
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
