#!/usr/bin/env bun
/**
 * Build orchestrator. v0.2.0+ delegates to the fork pipeline — each
 * family is built by downloading + renaming an OFL-licensed source
 * font (see scripts/sources.ts).
 *
 *   bun run scripts/build.ts --all
 *   bun run scripts/build.ts --family wayfinder-sans
 */

await import('./fork.ts')
export {}
