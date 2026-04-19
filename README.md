# NPS Fonts

Open-source typefaces inspired by U.S. National Park Service signage. Each family is a fork of a complementary OFL-licensed typeface, renamed and rebundled — released under the SIL Open Font License 1.1.

> **Disclaimer.** This project is independent and **not affiliated with, endorsed by, or sponsored by** the U.S. National Park Service or the U.S. Department of the Interior. The names, designs, and aesthetics here are *inspired by* the broader public-lands visual tradition. See [`DISCLAIMER.md`](./DISCLAIMER.md).

## The families

| Family               | Genre                              | Forked from                                                                                                  |
| -------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Wayfinder Sans**   | Vintage condensed display sans     | [Big Shoulders Display](https://fonts.google.com/specimen/Big+Shoulders+Display) — Patric King · OFL · variable axis |
| **Wayfinder Serif**  | Friendly slab serif                | [Zilla Slab](https://fonts.google.com/specimen/Zilla+Slab) — Typotheque/Mozilla · OFL · 4 weights × italics    |
| **Campfire Script**  | Casual upright brush script        | [Caveat Brush](https://fonts.google.com/specimen/Caveat+Brush) — Pablo Impallari · OFL                          |
| **Switchback**       | Soft chunky display caps           | [Bowlby One](https://fonts.google.com/specimen/Bowlby+One) — Vernon Adams · OFL                                 |
| **Cairn**            | Humanist signage sans              | [Public Sans](https://public-sans.digital.gov/) — USWDS · OFL · variable axis + italic                          |

All families ship in **`.otf`**, **`.ttf`**, **`.woff`**, and **`.woff2`**. Wayfinder Sans and Cairn ship as variable fonts (single file with full weight axis 100–900).

## Install

### Desktop

Download the family ZIP from the [latest release](https://github.com/stacksjs/nps-fonts/releases) and install.

### Web (CDN)

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@nps-fonts/wayfinder-sans/index.css">
```

### npm

```bash
bun add @nps-fonts/wayfinder-sans
# or: npm install @nps-fonts/wayfinder-sans
```

```css
@import "@nps-fonts/wayfinder-sans";

body { font-family: "Wayfinder Sans", system-ui, sans-serif; }

/* Variable font — any weight 100–900 works */
h1 { font-weight: 800; }
```

### Self-hosted `@font-face`

```css
@font-face {
  font-family: "Wayfinder Sans";
  src: url("/fonts/WayfinderSans-Variable.woff2") format("woff2-variations"),
       url("/fonts/WayfinderSans-Variable.woff2") format("woff2");
  font-weight: 100 900;
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
bun run build              # download upstream sources, rename, output to fonts/
bun run build:family wayfinder-sans
bun run web                # build the specimen site under web/dist
bun run check              # sanity-check built fonts
bun test tests/            # run smoke tests
```

The build script downloads OFL sources from `google/fonts` to `vendor/`, renames the `name` table (preserving original copyright + appending ours), and writes OTF/TTF/WOFF/WOFF2 per master under `fonts/<family>/`.

## Repository layout

```
nps-fonts/
├── sources/        # design briefs (human-readable per-family notes)
├── vendor/        # cached OFL source files (git-ignored)
├── fonts/         # built artifacts (.otf .ttf .woff .woff2) — committed
├── packages/      # generated npm packages (one per family + meta)
├── scripts/
│   ├── sources.ts        # per-family source URLs + attribution
│   ├── fork.ts           # download + rename + emit
│   ├── build.ts          # entry point (delegates to fork)
│   ├── check.ts          # sanity checks
│   ├── pack.ts           # generate npm packages
│   ├── web.ts            # build specimen site
│   └── lib/              # sfnt utilities, name-table rebuilder, woff wrapper
├── web/           # specimen site source
├── tests/         # smoke tests
└── .github/       # CI/CD
```

## Why fork?

Quality type design takes years per family. Forking established OFL fonts — five exemplars of the genres we want to evoke — gives us **type-designer-quality outlines from day one** with full Latin coverage, kerning, ligatures, hinting, and (for Sans/Cairn) variable axes. We focus our effort on packaging, distribution, and the NPS-themed identity layer.

The original authors retain full credit in the binary, in `FONTLOG.txt`, and in `AUTHORS.md`. The OFL is built for exactly this kind of collaboration.

## Contributing

PRs welcome at every level — additional families, design notes, specimen polish, packaging improvements, hinting refinements, language coverage extensions. See [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## License

[SIL Open Font License 1.1](./OFL.txt). You may use, modify, and redistribute these fonts — including in commercial work — provided you retain the license. **Reserved Font Names**: *Wayfinder Sans*, *Wayfinder Serif*, *Campfire Script*, *Switchback*, *Cairn*.

## Status

**v0.2.0 — fork release.** All five families produce production-quality outlines (the originals are mature shipping fonts). Per-family aesthetic refinement (custom alternates, NPS-themed glyphs, badges) is the work for v0.3+.
