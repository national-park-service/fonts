#!/usr/bin/env bash
# Publish every @nps-fonts/* package to npm.
# Expects packages/ to already be built (`bun run pack:all`).
# Requires NPM_TOKEN or `bun login` already done.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

for dir in packages/*/; do
  pkg=$(basename "$dir")
  echo "→ Publishing @nps-fonts/$pkg"
  (cd "$dir" && bun publish --access public)
done
