# Campmate Script — Design brief

A rounded upright script with soft, monoline letterforms and a
"perfectly imperfect" feel — hand-painted trailhead board lettering.
Ships with OpenType `liga` ligatures for the five most common
double-letter pairs.

## Inspiration

- Vicarel Studios' *VS Outdoor Script* (general genre and mood).
- Cream-on-brown USFS / NPS trailhead board lettering.
- Hand-painted park signs and WPA-era poster lettering.

## Targets

| Metric              | Value (em units, UPM 1000) |
| ------------------- | -------------------------- |
| Cap height          | 650                        |
| x-height            | 400                        |
| Ascender            | 780                        |
| Descender           | -230                       |
| Stroke              | 85 (monoline, no contrast) |
| Default sidebearing | 45                         |

## Character

- **Upright, no slant.**
- **Rounded monoline strokes** — all stems capped with semicircular
  terminals (via `roundStem` helper: a rect + two circles).
- **"Perfectly imperfect"** — each lowercase letter receives a small
  deterministic x/y jitter (±3 em-units typical) from a fixed table,
  so words read as hand-painted rather than mechanically aligned. Not
  random — reproducible across builds.
- **Liga ligatures** (GSUB `liga` feature): `oo`, `ll`, `tt`, `ee`,
  `ss`. Each is a separately-drawn merged glyph (e.g., `oo` shares a
  tiny ink-bridge between the two bowls).
- **Two-case.** Full A–Z caps (simplified, not flourished) and a–z
  lowercase, plus digits and basic punctuation.

## Ligatures

| Sub | By  | Notes                                    |
| --- | --- | ---------------------------------------- |
| o o | o_o | Two bowls with a mid-ink bridge          |
| l l | l_l | Two l stems joined by a short crossbar   |
| t t | t_t | Two stems sharing a single wide crossbar |
| e e | e_e | Two bowls sharing one continuous crossbar |
| s s | s_s | Two s shapes kissing at the terminal     |

To enable in CSS:

```css
font-family: "Campmate Script";
font-feature-settings: "liga" on;
/* or use the shorthand: */
font-variant-ligatures: common-ligatures;
```

## Drawing

Source: [`scripts/campmate-script.ts`](../../scripts/campmate-script.ts).
