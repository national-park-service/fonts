# Sequoia Sans — Design brief

A humanist sans for park field guides — high-contrast strokes,
slightly extended uppercase, designed to pair with Redwood Serif as
its sans companion.

## Cuts

The committed source data keeps its cases in separate outline files:

- `outlines.json`        — lowercase shapes
- `outlines-light.json`  — uppercase shapes for the Light cut
- `outlines-thin.json`   — uppercase shapes for the Thin cut
- `outlines-wide.json`   — uppercase shapes for the Wide cut

`scripts/sequoia-sans.ts` produces four static cuts:

| Style    | OS/2 weight | OS/2 width | Source pairing                   |
| -------- | ----------: | ---------: | -------------------------------- |
| Regular  | 400         | 5 (normal) | Regular lowercase + Light upper  |
| Wide     | 400         | 7 (wide)   | Regular lowercase + Wide upper   |
| Light    | 300         | 5 (normal) | Light uppercase only (display)   |
| Thin     | 100         | 5 (normal) | Thin uppercase only (display)    |

The build preserves the source outlines and metrics exactly for each
cut; no extra jitter or outline distortion is applied.

## Metrics

| Metric     | Value (em units, UPM 1000) |
| ---------- | -------------------------- |
| Cap height | 700                        |
| x-height   | 702                        |
| Ascender   | 776                        |
| Descender  | -200                       |

## Build

Source files:

- `outlines*.json` — committed per-glyph source data for each cut.
- [`scripts/sequoia-sans.ts`](../../scripts/sequoia-sans.ts) — for
  each cut, load the lowercase + uppercase masters, merge uppercase
  into the lowercase base via `mergeUppercaseFrom`, brand, emit
  OTF/TTF/WOFF/WOFF2 via
  [`scripts/lib/extracted.ts`](../../scripts/lib/extracted.ts).

The CSS package (`@nps-fonts/sequoia-sans`) registers all four cuts
under the `Sequoia Sans` family name with appropriate `font-weight`
and `font-stretch` so a single declaration can target any of them:

```css
@import "@nps-fonts/sequoia-sans";

h1 { font-family: "Sequoia Sans"; font-weight: 100; } /* Thin */
h1 { font-family: "Sequoia Sans"; font-weight: 300; } /* Light */
h1 { font-family: "Sequoia Sans"; font-weight: 400; } /* Regular */
h1 { font-family: "Sequoia Sans"; font-weight: 400; font-stretch: 125%; } /* Wide */
```
