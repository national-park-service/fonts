# Sources

The source of truth for each family is the committed outline data in
`sources/<family>/outlines*.json` plus its TypeScript build script in
`scripts/<family>.ts`. This directory also holds **design briefs** for
the public-lands signage proportions and atmosphere each family targets.

| Family               | Brief                                                         |
| -------------------- | ------------------------------------------------------------- |
| NPS 2026     | [`nps-2026/DESIGN.md`](./nps-2026/DESIGN.md)  |
| Redwood Serif        | [`redwood-serif/DESIGN.md`](./redwood-serif/DESIGN.md)        |
| Campmate Script      | [`campmate-script/DESIGN.md`](./campmate-script/DESIGN.md)    |
| Sequoia Sans         | [`sequoia-sans/DESIGN.md`](./sequoia-sans/DESIGN.md)          |
| Switchback           | [`switchback/DESIGN.md`](./switchback/DESIGN.md)              |

The NPS Symbols pictograph font has no design brief — see
[`../scripts/symbols.ts`](../scripts/symbols.ts) for the glyph code.

When iterating on a glyph, prefer drawing in your editor of choice
(Glyphs, FontForge, Illustrator), then update the committed source
outline data and rebuild.
