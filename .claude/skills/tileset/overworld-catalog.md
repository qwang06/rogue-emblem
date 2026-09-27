# Overworld sheet catalog

What's where on **Tactical RPG Overworld Pack**. Positions are `[column, row]`
in **16px source tiles**, which are the same numbers as 32px tiles in the
game's `src/assets/overworld.png`. That sheet is 42 x 63 tiles, and a tile's
frame is `row * 42 + column`.

- **Source:** `src/assets/Tactical RPG Overworld Pack - Tilesheet.png`, 3072x3072.
  The art is drawn at 3x (every art pixel is a 3x3 block), so it's natively
  1024x1024. Only the top-left 672x1008 native pixels are used; the rest is
  transparent.
- **Game sheet:** `src/assets/overworld.png` is the used area redrawn at 2x,
  so 16px tiles become the game's 32px tiles. Regenerate it with:
  `node .claude/skills/tileset/scripts/rescale-png.js --from 3 --to 2 --crop 672x1008 "src/assets/Tactical RPG Overworld Pack - Tilesheet.png" src/assets/overworld.png`

Nothing is on a dual grid. Terrain uses **blob autotiles**: a terrain is drawn
in its own cells, with its border inside the edge cells, over a grass base.

## Autotile set layout

Every terrain set below has the same 7-tile-wide layout, starting at `[c, r]`:

```
c   c+1 c+2 c+3   c+4 c+5 c+6
|   N   N   N     B   B   B      r      | = 1-wide vertical strip (top cap / middle / bottom cap)
|   N   N   N     B   B   B      r+1    N = "notched" 3x3: same as B but with an inside
|   N   N   N     B   B   B      r+2        corner cut into every inner corner
-   -   -   o     I   I          r+3    B = plain 3x3: outer corners, edges, full middle
                  I   I          r+4    - = 1-tall horizontal strip, o = single-cell island
                                        I = 2x2 of full tiles with one inside corner meeting
                                            at their shared center
```

`src/game/autotile.js` needs only `B` (as `block: [c+4, r]`) and one
all-corners-notched tile (`inner: [c+2, r+1]`, the middle of `N`). Every one
of the 47 neighbor combinations is assembled from quarters of those tiles.
The strips, island and `I` tiles are pre-assembled versions of some of those
combinations.

**Lighting:** the border is thick on the side facing west or north (with a dark
shadow on the water) and a thin lip on the south and east. That's how the pack
draws it, not a bug.

## Terrain

| What | Where | Notes |
|---|---|---|
| Grass, light (plain) | `[0, 0]` | Base fill under everything. Colors `#b7d463` / `#ceda62` |
| Grass, dark (plain) | `[12, 6]` | Same pixel pattern as `[0, 0]`, darker: `#84b14d` / `#abc75c` |
| Sand patch set | N at `[1, 3]`, strip `[0, 3]`, h-strip `[0, 6]`, island `[3, 6]` | Sand patches on grass. No plain 3x3, so it's notched only |
| Light water / puddle set | N at `[5, 3]`, strip `[4, 3]`, h-strip `[4, 6]`, island `[7, 6]` | Pale shallow water with a teal edge. Notched only |
| Dark grass patch set | strip `[8, 3]`, N-like blob `[9, 3]`, plain `[12, 3]` (3x3), full 2x2 `[12, 6]` | Darker grass patches over light grass |
| **Water, rocky shore** | set at `[0, 8]`, **6 animation frames** at columns 0, 7, 14, 21, 28, 35 | **In use** (`TERRAIN_AUTOTILES.water`: block `[4, 8]`, inner `[2, 9]`) |
| Water, sandy beach | set at `[0, 13]`, 6 frames, 7 columns apart | Same layout. Swap in with block `[4, 13]`, inner `[2, 14]` |
| Beach foam rings | rows 18–24, 6 frames | Pre-assembled water tiles around 2x2 and 1x1 land holes (octagon and diamond shapes) |
| Grass-edge foam rings | rows 24–27, 6 frames | Same idea, with green foam where water meets grass |
| Deep water in water | rows 28–31, 6 frames, 7 columns apart | Dark-blue deep-water set drawn over open water, same 7-wide layout |

## Terrain features (overlays, 1-cell footprint)

Mountains and some trees are **taller than one tile**: their footprint is the
bottom tile, and the art rises about half a tile to a tile into the cell above.
Draw them as sprites anchored at their footprint's bottom edge, sorted by row,
so a southern object covers the one behind it.

| What | Where |
|---|---|
| Pine forest (dense) | `[0, 1]` |
| Broadleaf trees (small / round) | `[1, 1]`, `[2, 1]` |
| Hill (low, 1 tile) | `[3, 1]` |
| Mountain, single | `[4, 1]` (peak rises into row 0) |
| Mountain, 2-stack column | `[5, 1]`–`[5, 2]` (a vertical run; the bottom one overlaps the top) |
| Mountain, twin peak / 3-stack | `[6, 0]`–`[6, 1]`, `[7, 0]`–`[7, 2]` |
| Forest behind mountain | `[8, 1]`–`[8, 2]`, `[9, …]`, `[10, …]` (trees on top, mountain below) |
| Bridge, horizontal / vertical | `[11, 1]` / `[11, 2]` |
| Rocks in water (shoal) | `[12, 1]`, `[12, 2]` |

## Buildings (team-colored)

Two palette sets of five colors each, which suit team ownership (Advance
Wars–style captured buildings):

- **Set A**, columns 0–4 (and 12–16): white, orange, teal, pink, brown.
- **Set B**, columns 6–10 (and 18–22): white, red, blue, green, orange.

| What | Where |
|---|---|
| Wall / fortress autotile | rows 33–38 (set A) and 41–46 (set B), one 6–7-column group per color. Strip + 3x3 wall block, plus wall caps, towers and gate pieces beside it |
| Wall fragments (L-pieces, singles) | rows 37–40 and 45–48 |
| 1x1 buildings, one type per row | rows 50, 52, 54, 56, 58, 60, 62 (odd rows empty). Roughly: shop/port, barracks/fort, temple, workshop, windmill, camp, village. Flags poke into the tile's top edge |
| More 1x1 buildings (pools, domes, towers) | the same rows, columns 12–16 and 18–22 |
| Tall towers / castles (1 wide, 2–3 tall) | columns 24–28, rows ~50–61 (four blocks, one per style) |

## UI

| What | Where |
|---|---|
| **Movement arrow** (continuous) | The pink rounded-square loop is a 3x3 of path tiles, columns 29–31, rows 56–58: corners `[29, 56]` down-right, `[31, 56]` down-left, `[29, 58]` up-right, `[31, 58]` up-left; straights `[30, 56]`/`[30, 58]` left-right, `[29, 57]`/`[31, 57]` up-down (opposite sides are identical). **In use** (`ARROW_TILES`) |
| Gem marker | `[30, 57]`, the middle of the loop |
| Broken arrow, directional (in → out) | Segmented pieces, each open on the edge the route leaves by and notched on the edge it came in by. Straights: `[29, 50]` left→right, `[30, 50]` up→down, `[29, 51]` down→up, `[30, 51]` right→left. Corners: `[29, 52]` left→up, `[30, 52]` right→up, `[29, 53]` left→down, `[30, 53]` right→down, `[29, 54]` down→left, `[30, 54]` down→right, `[29, 55]` up→left, `[30, 55]` up→right. Not used |
| **Arrow heads** | `[29, 59]` right, `[30, 59]` down, `[29, 60]` up, `[30, 60]` left. Each has a stub on the same 8px band, reaching the edge it comes in by. **In use** |
| **Tile cursor**, 2 frames | `[28, 62]` (cream corner brackets on the tile's corners) and `[29, 62]` (the same, 1px in). **In use** (`CURSOR_ANIMATION`) |
| Digits 0–9 (small white) | row 61.9–62, columns 24–29, ~6px each |
| HP / progress bar bits | row 62, columns 24–26 |
| Map pins / unit markers | row 61, columns 28–31 |
| Hatched tile | `[30, 62]` |

The pack has **no unit sprites**; units still come from `warrior-*.png`.
