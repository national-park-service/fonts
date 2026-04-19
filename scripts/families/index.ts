/**
 * Registry of all families. Imported by the build orchestrator.
 */

import { family as cairn } from './cairn.ts'
import { family as campfireScript } from './campfire-script.ts'
import { family as switchback } from './switchback.ts'
import { family as wayfinderSans } from './wayfinder-sans.ts'
import { family as wayfinderSerif } from './wayfinder-serif.ts'
import type { FamilySpec } from '../lib/types.ts'
import type { FamilyId } from '../lib/common.ts'

export const FAMILIES: Record<FamilyId, FamilySpec> = {
  'wayfinder-sans': wayfinderSans,
  'wayfinder-serif': wayfinderSerif,
  'campfire-script': campfireScript,
  'switchback': switchback,
  'cairn': cairn,
}
