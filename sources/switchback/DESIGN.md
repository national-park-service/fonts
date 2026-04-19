# Switchback — Design brief

A routed-trail display family for backcountry signage — chiseled
caps with two sibling cuts: clean machine-routed (Regular) and
distressed/chiseled (Rough).

## Cuts

| Style    | OS/2 weight | Source                        |
| -------- | ----------: | ----------------------------- |
| Regular  | 400         | `outlines-clean.json` (clean) |
| Rough    | 400         | `outlines-rough.json` (rough) |

In CSS the Rough cut ships under a sibling family name `Switchback
Rough` (rather than collide with Regular at the same weight/stretch).

## Metrics

| Metric     | Value (em units, UPM 1000) |
| ---------- | -------------------------- |
| Cap height | 660                        |
| x-height   | 476                        |
| Ascender   | 812                        |
| Descender  | -200                       |

## Build

Source files:

- `outlines-clean.json` and `outlines-rough.json` — pristine per-cut
  snapshots. Generated once by
  [`scripts/_extract-source.ts`](../../scripts/_extract-source.ts).
- [`scripts/switchback.ts`](../../scripts/switchback.ts) — for each
  variant, load the outlines, brand, emit OTF/TTF/WOFF/WOFF2 via
  [`scripts/lib/extracted.ts`](../../scripts/lib/extracted.ts).
