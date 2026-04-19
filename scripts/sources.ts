/**
 * OFL-licensed source fonts that we fork (rename + repackage) for each
 * NPS Fonts family. All sources are pulled from google/fonts so URLs
 * follow one pattern.
 *
 * OFL fork rules we follow per source:
 *   1. Rename to a different primary name (our Reserved Font Name).
 *   2. Preserve the original copyright in the binary; append ours.
 *   3. Re-release under the OFL (or compatible permissive license).
 *   4. Credit the original author in FONTLOG.txt and AUTHORS.md.
 */

import type { FamilyId } from './lib/common.ts'

export type WeightName = 'Thin' | 'ExtraLight' | 'Light' | 'Regular' | 'Medium' | 'SemiBold' | 'Bold' | 'ExtraBold' | 'Black'

export const WEIGHT_VALUE: Record<WeightName, number> = {
  Thin: 100,
  ExtraLight: 200,
  Light: 300,
  Regular: 400,
  Medium: 500,
  SemiBold: 600,
  Bold: 700,
  ExtraBold: 800,
  Black: 900,
}

export interface FontSource {
  /** Source filename within the upstream repo (raw, no URL-encoding). */
  filename: string
  /** Output style name (e.g. "Light", "Bold Italic", "Variable"). */
  styleName: string
  /** Italic flag — for matching to the right CSS @font-face. */
  italic: boolean
  /** Static fonts: which weight bucket. Undefined for variable. */
  weight?: WeightName
  /** Variable fonts: true. CSS gets `font-weight: 100 900`. */
  variable?: boolean
  /** Variable fonts: weight axis range. */
  weightRange?: [number, number]
}

export interface FamilySource {
  id: FamilyId
  /** Display name we ship as. */
  newFamilyName: string
  /** Filename stem for our outputs. */
  newFileStem: string
  /** Reserved Font Name we claim — must differ from the source's RFN. */
  newReservedFontName: string

  sourceFamily: string
  sourceAuthor: string
  /** Verbatim source copyright line; preserved in the binary. */
  sourceCopyright: string
  sourceLicense: 'OFL-1.1' | 'CC0-1.0'
  sourceRepo: string
  /** URL prefix for raw downloads — filenames append (URL-encoded). */
  baseUrl: string

  sources: FontSource[]
}

const RAW = 'https://raw.githubusercontent.com/google/fonts/main/ofl/'

export const FAMILY_SOURCES: Record<FamilyId, FamilySource> = {
  'wayfinder-sans': {
    id: 'wayfinder-sans',
    newFamilyName: 'Wayfinder Sans',
    newFileStem: 'WayfinderSans',
    newReservedFontName: 'Wayfinder Sans',
    sourceFamily: 'Big Shoulders Display',
    sourceAuthor: 'Patric King (House Industries) and the Big Shoulders Project Authors',
    sourceCopyright: 'Copyright 2018 The Big Shoulders Project Authors (https://github.com/PatricKing/big-shoulders)',
    sourceLicense: 'OFL-1.1',
    sourceRepo: 'https://github.com/google/fonts/tree/main/ofl/bigshouldersdisplay',
    baseUrl: `${RAW}bigshouldersdisplay/`,
    sources: [
      { filename: 'BigShouldersDisplay[wght].ttf', styleName: 'Variable', italic: false, variable: true, weightRange: [100, 900] },
    ],
  },

  'wayfinder-serif': {
    id: 'wayfinder-serif',
    newFamilyName: 'Wayfinder Serif',
    newFileStem: 'WayfinderSerif',
    newReservedFontName: 'Wayfinder Serif',
    sourceFamily: 'Zilla Slab',
    sourceAuthor: 'Typotheque (commissioned by Mozilla)',
    sourceCopyright: 'Copyright 2017 The Zilla Slab Project Authors (https://github.com/mozilla/zilla-slab)',
    sourceLicense: 'OFL-1.1',
    sourceRepo: 'https://github.com/google/fonts/tree/main/ofl/zillaslab',
    baseUrl: `${RAW}zillaslab/`,
    sources: [
      { filename: 'ZillaSlab-Light.ttf', styleName: 'Light', italic: false, weight: 'Light' },
      { filename: 'ZillaSlab-LightItalic.ttf', styleName: 'Light Italic', italic: true, weight: 'Light' },
      { filename: 'ZillaSlab-Regular.ttf', styleName: 'Regular', italic: false, weight: 'Regular' },
      { filename: 'ZillaSlab-Italic.ttf', styleName: 'Italic', italic: true, weight: 'Regular' },
      { filename: 'ZillaSlab-Medium.ttf', styleName: 'Medium', italic: false, weight: 'Medium' },
      { filename: 'ZillaSlab-MediumItalic.ttf', styleName: 'Medium Italic', italic: true, weight: 'Medium' },
      { filename: 'ZillaSlab-Bold.ttf', styleName: 'Bold', italic: false, weight: 'Bold' },
      { filename: 'ZillaSlab-BoldItalic.ttf', styleName: 'Bold Italic', italic: true, weight: 'Bold' },
    ],
  },

  'campfire-script': {
    id: 'campfire-script',
    newFamilyName: 'Campfire Script',
    newFileStem: 'CampfireScript',
    newReservedFontName: 'Campfire Script',
    sourceFamily: 'Caveat Brush',
    sourceAuthor: 'Pablo Impallari (Impallari Type)',
    sourceCopyright: 'Copyright 2018 The Caveat Brush Project Authors (https://github.com/impallari/Caveat-Brush)',
    sourceLicense: 'OFL-1.1',
    sourceRepo: 'https://github.com/google/fonts/tree/main/ofl/caveatbrush',
    baseUrl: `${RAW}caveatbrush/`,
    sources: [
      { filename: 'CaveatBrush-Regular.ttf', styleName: 'Regular', italic: false, weight: 'Regular' },
    ],
  },

  switchback: {
    id: 'switchback',
    newFamilyName: 'Switchback',
    newFileStem: 'Switchback',
    newReservedFontName: 'Switchback',
    sourceFamily: 'Bowlby One',
    sourceAuthor: 'Vernon Adams',
    sourceCopyright: 'Copyright 2011 The Bowlby One Project Authors (vernnobile@gmail.com)',
    sourceLicense: 'OFL-1.1',
    sourceRepo: 'https://github.com/google/fonts/tree/main/ofl/bowlbyone',
    baseUrl: `${RAW}bowlbyone/`,
    sources: [
      { filename: 'BowlbyOne-Regular.ttf', styleName: 'Regular', italic: false, weight: 'Regular' },
    ],
  },

  cairn: {
    id: 'cairn',
    newFamilyName: 'Cairn',
    newFileStem: 'Cairn',
    newReservedFontName: 'Cairn',
    sourceFamily: 'Public Sans',
    sourceAuthor: 'U.S. Web Design System (USWDS) and Public Sans Project Authors',
    sourceCopyright: 'Copyright 2015 The Public Sans Project Authors (https://github.com/uswds/public-sans)',
    sourceLicense: 'OFL-1.1',
    sourceRepo: 'https://github.com/google/fonts/tree/main/ofl/publicsans',
    baseUrl: `${RAW}publicsans/`,
    sources: [
      { filename: 'PublicSans[wght].ttf', styleName: 'Variable', italic: false, variable: true, weightRange: [100, 900] },
      { filename: 'PublicSans-Italic[wght].ttf', styleName: 'Italic Variable', italic: true, variable: true, weightRange: [100, 900] },
    ],
  },
}

/** OFL.txt URL for each source — fetched once and cached for vendor/<id>/OFL.txt. */
export function ofltxtUrl(fam: FamilySource): string {
  return `${fam.baseUrl}OFL.txt`
}

/** Encode the filename for fetch URL (handles brackets in variable fonts). */
export function encodeFilename(filename: string): string {
  return filename.replace(/\[/g, '%5B').replace(/\]/g, '%5D')
}

/** Sanitize the local cache filename (strip brackets that some filesystems dislike). */
export function sanitizeFilename(filename: string): string {
  return filename.replace(/\[/g, '_').replace(/\]/g, '')
}
