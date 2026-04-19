/**
 * Constants shared across families.
 */

export const UPM = 1000

// Vertical metrics (shared across the John Muir families to make pairing trivial).
export const ASCENDER = 800
export const DESCENDER = -200
export const CAP_HEIGHT = 700
export const X_HEIGHT = 500

export const DEFAULT_LSB = 60
export const DEFAULT_RSB = 60

export type WeightName = 'Light' | 'Regular' | 'Medium' | 'Bold' | 'Black'

/** OS/2 weight class per CSS spec. */
export const WEIGHT_CLASS: Record<WeightName, number> = {
  Light: 300,
  Regular: 400,
  Medium: 500,
  Bold: 700,
  Black: 900,
}

/** Default stroke thickness (em units) per weight, used by the parametric drawer. */
export const STROKE: Record<WeightName, number> = {
  Light: 50,
  Regular: 80,
  Medium: 100,
  Bold: 140,
  Black: 180,
}

export interface CharsetEntry {
  name: string
  unicode: number
}

const range = (start: number, end: number, prefix?: string): CharsetEntry[] => {
  const out: CharsetEntry[] = []
  for (let cp = start; cp <= end; cp++) {
    out.push({ name: prefix ? `${prefix}${cp}` : String.fromCodePoint(cp), unicode: cp })
  }
  return out
}

const DIGIT_NAMES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
] as const

const PUNCT_NAMES: Record<number, string> = {
  0x0020: 'space',
  0x0021: 'exclam',
  0x0022: 'quotedbl',
  0x0023: 'numbersign',
  0x0024: 'dollar',
  0x0025: 'percent',
  0x0026: 'ampersand',
  0x0027: 'quotesingle',
  0x0028: 'parenleft',
  0x0029: 'parenright',
  0x002A: 'asterisk',
  0x002B: 'plus',
  0x002C: 'comma',
  0x002D: 'hyphen',
  0x002E: 'period',
  0x002F: 'slash',
  0x003A: 'colon',
  0x003B: 'semicolon',
  0x003C: 'less',
  0x003D: 'equal',
  0x003E: 'greater',
  0x003F: 'question',
  0x0040: 'at',
  0x005B: 'bracketleft',
  0x005C: 'backslash',
  0x005D: 'bracketright',
  0x005E: 'asciicircum',
  0x005F: 'underscore',
  0x0060: 'grave',
  0x007B: 'braceleft',
  0x007C: 'bar',
  0x007D: 'braceright',
  0x007E: 'asciitilde',
}

export const CHARSET: CharsetEntry[] = (() => {
  const entries: CharsetEntry[] = []
  for (let cp = 0x0020; cp <= 0x007E; cp++) {
    if (cp >= 0x0030 && cp <= 0x0039) {
      entries.push({ name: DIGIT_NAMES[cp - 0x0030]!, unicode: cp })
    }
    else if (cp >= 0x0041 && cp <= 0x005A) {
      entries.push({ name: String.fromCodePoint(cp), unicode: cp })
    }
    else if (cp >= 0x0061 && cp <= 0x007A) {
      entries.push({ name: String.fromCodePoint(cp), unicode: cp })
    }
    else if (cp in PUNCT_NAMES) {
      entries.push({ name: PUNCT_NAMES[cp]!, unicode: cp })
    }
  }
  return entries
})()

/** Glyphs keyed by codepoint for quick lookup. */
export const CHARSET_BY_CP: Map<number, CharsetEntry> = new Map(
  CHARSET.map(e => [e.unicode, e]),
)

export const ALL_FAMILIES = [
  'wayfinder-sans',
  'wayfinder-serif',
  'campfire-script',
  'switchback',
  'cairn',
] as const

export type FamilyId = (typeof ALL_FAMILIES)[number]

export const FAMILY_DISPLAY: Record<FamilyId, { display: string, file: string }> = {
  'wayfinder-sans': { display: 'Wayfinder Sans', file: 'WayfinderSans' },
  'wayfinder-serif': { display: 'Wayfinder Serif', file: 'WayfinderSerif' },
  'campfire-script': { display: 'Campfire Script', file: 'CampfireScript' },
  'switchback': { display: 'Switchback', file: 'Switchback' },
  'cairn': { display: 'Cairn', file: 'Cairn' },
}
