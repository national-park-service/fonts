# Campmate Script — Design brief

A rounded upright script with brush-style contrast. Hand-painted
trailhead board lettering. Ships with OpenType `liga` ligatures
designed into the source, plus source-level GPOS kerning for dense
cursive pairs like `as`, `ks`, `ps`, `es`, `os`, `oss`, `nx`, `wx`,
`yx`, and `yz`.

## Metrics

| Metric     | Value (em units, UPM 1000) |
| ---------- | -------------------------- |
| Cap height | 626                        |
| x-height   | 435                        |
| Ascender   | 763                        |
| Descender  | -200                       |
| Weight     | 400 (Regular)              |

## Ligatures

The source ships designer-drawn ligature glyphs named with the
suffix `.liga` (e.g. `ll.liga`, `oss.liga`) and embedded GPOS kerning
for script rhythm. The build reconstructs the ligature feature from
glyph names so the committed source data stays compact.

[`scripts/campmate-script.ts`](../../scripts/campmate-script.ts)
reconstructs the GSUB `liga` feature before writing outputs by parsing
each ligature glyph name back into its component letters and
registering an opentype.js substitution rule. So `ll` → `ll.liga`,
`os` → `os.liga`, `oss` → `oss.liga`, `yx` → `yx.liga`, etc. Dense
non-ligature joins connect through source kerning rather than added
bridge strokes or build-time outline patches.

To enable in CSS:

```css
font-family: "Campmate Script";
font-feature-settings: "liga" on;
/* or use the shorthand: */
font-variant-ligatures: common-ligatures;
```

## Build

Source files:

- [`outlines.json`](./outlines.json) — per-glyph snapshot plus GPOS
  kerning source data.
- [`scripts/campmate-script.ts`](../../scripts/campmate-script.ts) —
  load outlines, brand the name table, emit OTF/TTF/WOFF/WOFF2 via
  [`scripts/lib/extracted.ts`](../../scripts/lib/extracted.ts).
  WOFF/WOFF2 are wrapped from the TTF, which carries the GSUB ligature
  table and GPOS kerning so browser-side script spacing works out of
  the box.
