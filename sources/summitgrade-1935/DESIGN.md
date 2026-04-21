# Summitgrade 1935 — Design brief

Vintage NPS display caps in the idiom of the 1930s CCC-era
park-entrance signage — chunky, confident, legible at distance,
routed-redwood aesthetic. All-caps face (lowercase codepoints map to
the uppercase glyphs).

## Inspiration

- 1935-era NPS wood signage (the routed, stamped lettering on old
  park-entrance shields and trailhead boards).
- CCC-era typography: heavy monolinear strokes, wide apertures,
  slab-influenced terminals.
- Secondary reference: the "NPS 1935" typeface commonly found on
  vintage NPS reproductions.

## Targets

| Metric              | Value (em units, UPM 1000) |
| ------------------- | -------------------------- |
| Cap height          | 720                        |
| Ascender            | 800                        |
| Descender           | -180                       |
| Main stroke         | 120                        |
| Diagonal stroke     | 114 (0.95 × main)          |
| Default sidebearing | 80                         |

## Character

- **All caps.** Lowercase a–z codepoints share glyphs with the caps.
- **Wide proportions.** Body widths are 0.82–1.00 × cap height.
- **Square bowls.** B/D/P/R bowls have slightly square shoulders.
- **Flat terminals.** A/V/W/M/N have flat ("stopped") terminal cuts
  where the diagonals meet the cap line or baseline.
- **Monolinear.** No stroke contrast — everything is 120 em-units.

## Drawing

Source: [`scripts/summitgrade-1935.ts`](../../scripts/summitgrade-1935.ts).
