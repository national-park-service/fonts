import type { Path } from 'opentype.js'
import type { WeightName } from './common.ts'

export interface DrawContext {
  /** Stroke thickness for the master being drawn. */
  stroke: number
  /** True if italic/oblique. */
  italic: boolean
  /** Per-family knobs the drawer sets up (e.g. serifLength, brushAngle). */
  [key: string]: unknown
}

export type GlyphDraw = (path: Path, ctx: DrawContext) => void

export interface GlyphSpec {
  name: string
  /** Single codepoint or array (for cases like NBSP sharing the space glyph). */
  unicode: number | number[] | undefined
  advanceWidth: number
  draw: GlyphDraw
}

export interface MasterSpec {
  styleName: string
  weight: WeightName
  italic: boolean
  glyphs: GlyphSpec[]
  ctx: DrawContext
  /** Optional per-master kerning override (else FamilySpec.kerningPairs is used). */
  kerningPairs?: Record<string, number>
}

export interface FamilySpec {
  id: string
  /** Display family name (e.g. "John Muir Sans"). */
  familyName: string
  /** Filename stem (e.g. "JohnMuirSans"). */
  fileStem: string
  /** Vendor info, copyright, etc. */
  copyright: string
  designer: string
  designerURL: string
  manufacturer: string
  vendorID: string
  version: string
  license: string
  licenseURL: string
  /** Em metrics. */
  unitsPerEm: number
  ascender: number
  descender: number
  capHeight: number
  xHeight: number
  /** All masters in this family. */
  masters: MasterSpec[]
  /** Optional family-wide kerning. Keys: "leftname,rightname", value: em-unit shift (negative tightens). */
  kerningPairs?: Record<string, number>
}
