# Redwood Serif — Design brief

An old-style / transitional serif with stroke contrast and bracketed
serifs. Bookish, with the warmth of an early-20th-century Yosemite
field journal.

## Sources

The source family ships its lowercase and uppercase shapes in two
separate weight masters:

- `outlines.json`      — extracted from the Regular master (lowercase shapes)
- `outlines-wide.json` — extracted from the Wide master (uppercase shapes)

`scripts/redwood-serif.ts` merges the two: the resulting Redwood Serif
Regular has the lowercase shapes mapped to U+0061..7A (and Latin-1
lowercase accented codepoints) and the uppercase shapes mapped to
U+0041..5A (and Latin-1 uppercase accented codepoints).

## Metrics

| Metric    | Value (em units, UPM 1000) |
| --------- | -------------------------- |
| Cap height | 700                        |
| x-height   | 702 (lowercase shapes are full-cap-height in the source) |
| Ascender   | 776                        |
| Descender  | -200                       |
| Weight     | 400 (Regular)              |
| Width      | 5 (normal)                 |

## Glyph coverage

107 glyphs: full A–Z + a–z, digits, ASCII punctuation, Latin-1
Supplement (incl. accented vowels and ligatures æ, ß).

## Build

The entire pipeline is pure TypeScript — no external binary
dependencies.

Source files:

- [`outlines.json`](./outlines.json) and
  [`outlines-wide.json`](./outlines-wide.json) — pristine per-glyph
  snapshots (points, bounding boxes, advance widths) plus `head`,
  `hhea`, `OS/2`, `post`, `cmap`, `name`, `maxp` tables. Generated
  once by [`scripts/_extract-source.ts`](../../scripts/_extract-source.ts)
  and committed as the sole source of truth. No external font file is
  read at build time.
- [`scripts/redwood-serif.ts`](../../scripts/redwood-serif.ts) — load
  both outlines, merge uppercase from Wide into the Regular base,
  brand the name table, emit OTF/TTF/WOFF/WOFF2 via the shared
  [`scripts/lib/extracted.ts`](../../scripts/lib/extracted.ts) helpers.

## Tests

```bash
bun test
```

The build smoke tests verify the artifact files exist, re-parse
cleanly, and carry the expected family name and copyright credit.
