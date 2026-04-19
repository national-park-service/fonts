#!/usr/bin/env bun
/**
 * Sanitize committed `sources/<family>/outlines*.json` files: strip the
 * source font's `name`-table identifiers and any other strings that could
 * tie the snapshot back to a specific upstream font.
 *
 * Why: outlines.json files are working JSON snapshots used to bootstrap
 * a family. Their `name`-table fields are *not* used at build time —
 * `scripts/lib/extracted.ts#brandNameTable` rewrites every relevant
 * field with NPS Fonts branding before any artifact is emitted. Keeping
 * the original strings in the committed JSON serves no build purpose
 * and just adds noise. This script removes them.
 *
 *   bun run scripts/_sanitize-sources.ts            # all sources/**\/outlines*.json
 *   bun run scripts/_sanitize-sources.ts <path>     # single file
 *
 * Idempotent: re-running on already-clean files is a no-op.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, relative } from 'node:path'

const ROOT = resolve(import.meta.dir, '..')

/** Fields stripped from the name table. brandNameTable() repopulates these. */
const SCRUBBED_NAME_FIELDS = [
  'fontFamily', 'fontSubFamily', 'uniqueSubFamily', 'fullName',
  'version', 'postScriptName', 'preferredFamily', 'preferredSubFamily',
  'compatibleFull', 'copyright', 'trademark', 'manufacturer', 'designer',
  'designerURL', 'manufacturerURL', 'license', 'licenseURL', 'description',
  'sampleText',
] as const

interface NameTable {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [k: string]: any
}

interface FontJson {
  name?: NameTable
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [k: string]: any
}

export function sanitizeNameTable(name: NameTable | undefined): NameTable {
  if (!name) return {}
  const out: NameTable = {}
  for (const k of Object.keys(name)) {
    if ((SCRUBBED_NAME_FIELDS as readonly string[]).includes(k)) continue
    if (k === 'extra') continue // multi-language NameID 21/22 entries — also identifying
    out[k] = name[k]
  }
  return out
}

async function listOutlines(): Promise<string[]> {
  const sourcesDir = resolve(ROOT, 'sources')
  const families = await readdir(sourcesDir, { withFileTypes: true })
  const out: string[] = []
  for (const f of families) {
    if (!f.isDirectory()) continue
    const familyDir = resolve(sourcesDir, f.name)
    for (const entry of await readdir(familyDir)) {
      if (entry.startsWith('outlines') && entry.endsWith('.json')) {
        out.push(resolve(familyDir, entry))
      }
    }
  }
  return out
}

async function sanitizeFile(path: string): Promise<boolean> {
  const raw = await readFile(path, 'utf8')
  const data: FontJson = JSON.parse(raw)
  const before = JSON.stringify(data.name ?? {})
  data.name = sanitizeNameTable(data.name)
  const after = JSON.stringify(data.name)
  if (before === after) return false
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`)
  return true
}

async function main() {
  const arg = Bun.argv[2]
  const targets = arg ? [resolve(ROOT, arg)] : await listOutlines()
  let changed = 0
  for (const t of targets) {
    const did = await sanitizeFile(t)
    const rel = relative(ROOT, t)
    console.log(`${did ? '✓ scrubbed' : '· clean   '} ${rel}`)
    if (did) changed++
  }
  console.log(`\n${changed}/${targets.length} file(s) updated.`)
}

if (import.meta.path === Bun.main) await main()
