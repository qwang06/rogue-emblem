# Overworld sheet: UI pieces

UI art on `src/assets/overworld.png`, kept apart from
[overworld-catalog.md](overworld-catalog.md) so map generation and terrain
work only look at map tiles. **None of these are terrain**: never place them
as map cells. They're drawn as sprites over the map (cursor, arrow, markers) or
belong in React UI (digits, bars). Positions are `[column, row]` 32px tiles, as
in the map catalog. Everything here sits in columns 24–31, rows 50–62, beside
the buildings.

## In use

| What                            | Where                                                                                                                                                                                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Movement arrow** (continuous) | The pink rounded-square loop is a 3x3 of path tiles, columns 29–31, rows 56–58: corners `[29, 56]` down-right, `[31, 56]` down-left, `[29, 58]` up-right, `[31, 58]` up-left; straights `[30, 56]`/`[30, 58]` left-right, `[29, 57]`/`[31, 57]` up-down (opposite sides are identical). **In use** (`ARROW_TILES`) |
| **Arrow heads**                 | `[29, 59]` right, `[30, 59]` down, `[29, 60]` up, `[30, 60]` left. Each has a stub on the same 8px band, reaching the edge it comes in by. **In use**                                                                                                                                                              |
| **Tile cursor**, 2 frames       | `[28, 62]` (cream corner brackets on the tile's corners) and `[29, 62]` (the same, 1px in). **In use** (`CURSOR_ANIMATION`)                                                                                                                                                                                        |

## Not used yet

| What                                 | Where                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gem marker                           | `[30, 57]`, the middle of the loop                                                                                                                                                                                                                                                                                                                                                                |
| Broken arrow, directional (in → out) | Segmented pieces, each open on the edge the route leaves by and notched on the edge it came in by. Straights: `[29, 50]` left→right, `[30, 50]` up→down, `[29, 51]` down→up, `[30, 51]` right→left. Corners: `[29, 52]` left→up, `[30, 52]` right→up, `[29, 53]` left→down, `[30, 53]` right→down, `[29, 54]` down→left, `[30, 54]` down→right, `[29, 55]` up→left, `[30, 55]` up→right. Not used |
| Digits 0–9                           | Row 61 from column 24, y 0–11. Ten 10x12px glyphs, cream `#f5ffe8` on a dark `#291d2b` box, on a **12px pitch**: digit d starts at x = 24 × 32 + 12d (they cross tile boundaries, so crop by pixel, not by tile). Blocky 5x6-art-pixel font; the 8 has a dot in its upper hole                                                                                                                    |
| HP / progress bar                    | Row 62. `[24, 62]`: the empty bar, 20x6px at the tile's top-left (dark `#291d2b` frame, purple `#4f1d4c` inside). `[25, 62]`: the same bar full (red `#e64539` inside). `[26, 62]`: just the red fill, 16x2px at x 2–17, y 2–3, to crop to a fraction over the empty bar. Better drawn in React from these colors                                                                                 |
| Map marker / beacon, 4 frames        | `[28, 61]`–`[31, 61]`: one 20x24px marker (a silver base with an orange-red flame, outlined dark, with a cream halo), the same pixels in every frame but bobbing: its top is at y 8, 6, 4, 6, so play 28 → 29 → 30 → 31 and loop. Suits an objective, a seize point or a "move here" marker                                                                                                       |
| Hatched tile                         | `[30, 62]`: opaque cream `#f5ffe8` diagonal stripes (top-left to bottom-right) with transparent gaps, covering the whole tile. Could mark blocked or danger tiles, or be tinted for attack range                                                                                                                                                                                                  |

`[27, 62]` and `[31, 62]` are empty.
