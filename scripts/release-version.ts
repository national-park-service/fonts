#!/usr/bin/env bun

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

type Bump = 'patch' | 'minor' | 'major'

const bump = (Bun.argv[2] || 'patch') as Bump
const root = resolve(import.meta.dir, '..')

function readJson(path: string): any {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeJson(path: string, value: any): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function nextVersion(current: string, kind: Bump): string {
  const [major = 0, minor = 0, patch = 0] = current.split('.').map(Number)
  if (kind === 'major') return `${major + 1}.0.0`
  if (kind === 'minor') return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}

function run(command: string[]): void {
  const proc = Bun.spawnSync(command, { cwd: root, stdout: 'inherit', stderr: 'inherit' })
  if (!proc.success)
    process.exit(proc.exitCode || 1)
}

const rootPackagePath = resolve(root, 'package.json')
const rootPackage = readJson(rootPackagePath)
const version = nextVersion(rootPackage.version || '0.0.0', bump)
rootPackage.version = version
writeJson(rootPackagePath, rootPackage)

const packageJsonPaths = readdirSync(resolve(root, 'packages'), { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => resolve(root, 'packages', entry.name, 'package.json'))

for (const path of packageJsonPaths) {
  const pkg = readJson(path)
  pkg.version = version

  if (pkg.dependencies) {
    for (const name of Object.keys(pkg.dependencies)) {
      if (name.startsWith('@nps-fonts/'))
        pkg.dependencies[name] = version
    }
  }

  writeJson(path, pkg)
}

run(['git', 'add', 'package.json', 'packages'])
run(['git', 'commit', '-m', `chore: release v${version}`])
run(['git', 'tag', `v${version}`])
run(['git', 'push', 'origin', 'main', `v${version}`])

console.log(`Released v${version}`)
