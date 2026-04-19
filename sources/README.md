# Sources

The "source of truth" for each family is the TypeScript drawing script
in `scripts/families/<family>.ts` plus the shared library in
`scripts/lib/`. This directory holds **design briefs** — the human
references and proportions that the drawing scripts target.

| Family               | Brief                                             |
| -------------------- | ------------------------------------------------- |
| Wayfinder Sans       | [`wayfinder-sans/DESIGN.md`](./wayfinder-sans/DESIGN.md)     |
| Wayfinder Serif      | [`wayfinder-serif/DESIGN.md`](./wayfinder-serif/DESIGN.md)   |
| Campfire Script      | [`campfire-script/DESIGN.md`](./campfire-script/DESIGN.md)   |
| Switchback           | [`switchback/DESIGN.md`](./switchback/DESIGN.md)             |
| Cairn                | [`cairn/DESIGN.md`](./cairn/DESIGN.md)                       |

When iterating on a glyph, prefer drawing in your editor of choice
(Glyphs, FontForge, Illustrator), then port the shapes back to the
drawing script under `scripts/families/`.
