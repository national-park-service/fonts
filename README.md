# NPS Fonts

Open-source typefaces inspired by U.S. National Park Service signage, posters, and trail markers — built from scratch and released under the SIL Open Font License 1.1.

> **Disclaimer.** This project is independent and **not affiliated with, endorsed by, or sponsored by** the U.S. National Park Service or the U.S. Department of the Interior. The names, designs, and aesthetics here are *inspired by* park signage and the broader public-lands visual tradition — they are not reproductions of any official or trademarked NPS typeface. See [`DISCLAIMER.md`](./DISCLAIMER.md).

## The families

| Family               | Style                          | Weights                                  | Best for                          |
| -------------------- | ------------------------------ | ---------------------------------------- | --------------------------------- |
| **Wayfinder Sans**   | Humanist sans-serif            | Light · Regular · Medium · Bold · Black + Italics | Body, UI, signage |
| **Wayfinder Serif**  | Slab/transitional serif        | Light · Regular · Medium · Bold · Black + Italics | Long-form text     |
| **Campfire Script**  | Casual brush script            | Regular                                  | Headlines, accents                |
| **Switchback**       | Rugged condensed slab display  | Regular                                  | Posters, display                  |
| **Cairn**            | Bold geometric all-caps        | Regular · Bold                           | Signs, badges, wayfinding         |

All families ship in **`.otf`**, **`.woff`**, and **`.woff2`**.

## Install

### Desktop

Download the family ZIP from the [latest release](https://github.com/stacksjs/nps-fonts/releases) and double-click each `.otf` to install.

### Web (CDN)

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@nps-fonts/wayfinder-sans/index.css">
```

```css
body { font-family: "Wayfinder Sans", system-ui, sans-serif; }
```

### npm

```bash
bun add @nps-fonts/wayfinder-sans
# or: npm install @nps-fonts/wayfinder-sans
```

```css
@import "@nps-fonts/wayfinder-sans";
```

### Self-hosted `@font-face`

```css
@font-face {
  font-family: "Wayfinder Sans";
  src: url("/fonts/WayfinderSans-Regular.woff2") format("woff2"),
       url("/fonts/WayfinderSans-Regular.woff")  format("woff");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
```

## Specimen site

Live demo: <https://stacksjs.github.io/nps-fonts/>

## Build from source

Requires [Bun](https://bun.sh) 1.1+.

```bash
bun install
bun run build              # builds all families, all formats
bun run build:family cairn # builds one family
bun run web                # builds the specimen site under web/dist
bun run check              # runs sanity checks on built fonts
```

Outputs land under `fonts/<family>/{otf,woff,woff2}/`.

## Repository layout

```
nps-fonts/
├── sources/        # design briefs + per-family source notes
├── fonts/          # built artifacts (.otf .woff .woff2)
├── packages/       # npm packages (one per family + meta)
├── scripts/        # Bun/TypeScript build pipeline
├── specimens/      # generated PDF/PNG specimens
├── web/            # specimen site (deploys to GitHub Pages)
├── tests/          # outline + metric checks
└── .github/        # CI/CD
```

## Contributing

This is a long-term project — type design takes years. Pull requests welcome at every level: glyph drawing, kerning, hinting, OpenType features, character coverage, documentation. See [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## License

[SIL Open Font License 1.1](./OFL.txt). You may use, modify, and redistribute these fonts — including in commercial work — provided you retain the license. Reserved Font Names: *Wayfinder Sans*, *Wayfinder Serif*, *Campfire Script*, *Switchback*, *Cairn*.

## Status

**v0.0.1 — early seed.** The current outlines are procedurally generated as a starting point. Real type design is iterative work; expect significant refinement family-by-family. See [`FONTLOG.txt`](./FONTLOG.txt) for per-family changelog.
