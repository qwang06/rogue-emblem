---
name: tileset
description: Reference for the Kenney Tiny Battle tilesheet — a catalog of what every frame index shows (terrain, water, roads, bridges, buildings and units per faction, UI icons), how multi-tile pieces fit together, and a script to inspect tiles as ASCII. Use whenever work touches the tilesheet — choosing or changing frame indices, TERRAIN_FRAMES / TERRAIN_EDGE_FRAMES / UNIT_FRAMES / UI_FRAMES / ARROW_FRAMES in src/game/tileset.js, autotiling or edge logic (src/game/terrainTiles.js), adding terrain types, new unit/UI sprites, or rendering the tilemap in GridScene.
---

# Tileset (Kenney Tiny Battle)

Sheet: `src/assets/kenney_tiny-battle/Tilemap/tilemap_packed.png` — 16x16 tiles, **18 columns x 11 rows** (198 frames), no spacing (the unpacked `tilemap.png` has 1px spacing; the game loads the packed one). Individual tiles live in `Tiles/tile_NNNN.png`, numbered with the same frame index.

`frame = row * 18 + col`, so the tile directly below frame `n` is `n + 18`.

## Finding a frame

**Look it up in [catalog.md](catalog.md).** Every frame has been decoded and confirmed there, with names agreed with the user: buildings and units in per-faction tables (neutral grey, green, blue, red, orange), then a description of every frame row by row. Use the catalog's names when naming frames in code. Don't re-decode a frame the catalog already covers.

## How pieces fit together

The catalog lists frames one at a time; these are the multi-tile arrangements.

**Water edges** (in use, `TERRAIN_EDGE_FRAMES.water`) — water with a grass/sand shoreline on the named sides:

```
18 top-left     19 top      20 top-right
36 left         37 center   38 right
54 bottom-left  55 bottom   56 bottom-right
```

**Water inner corners** (in use, `inner-*` pieces of `TERRAIN_EDGE_FRAMES.water`) — open water with grass only in one corner, for a water cell whose four orthogonal neighbors are water but a diagonal neighbor is grass: `90` top-left, `91` top-right, `92` bottom-right, `93` bottom-left. `72`/`74` are variants of 91/90 with a 3px notch on the bottom edge that continues into 91/90 when stacked directly above them — use 90–93 for a lone corner.

**Rivers (1 tile wide, vertical)** — `75` (river enters open water from above) → `57` (straight river, repeat as needed) → `39` (open water narrows into the river below). `73` is the tip of a 1-wide grass strip reaching into water from above.

**Bridges** — `130` horizontal bridge, with `148` (water under a bridge: shadow and supports) directly beneath it; `166` vertical bridge.

**Ponds** — `3 4 / 21 22` is a self-contained 2x2 pond.

**Roads** — columns 0–3 of rows 6–9. The 3x3 block is laid out like the water set: each tile opens toward its neighbors in the block.

```
108 isolated    109 left end   110 horizontal  111 right end
126 top end     127 ┌ turn     128 ┬ T         129 ┐ turn     130 bridge (horizontal)
144 vertical    145 ├ T        146 ┼ cross     147 ┤ T        148 water under bridge
162 bottom end  163 └ turn     164 ┴ T         165 ┘ turn     166 bridge (vertical)
```

**Overlays** — sprites with transparent backgrounds (mountain, trees, SUV, units, arrows, cursor, badges, aircraft shadow, road ends/turns) are drawn on top of a terrain tile, not used as terrain. Draw the aircraft shadow (`197`) under aircraft; digit badges (`180 + digit`) sit in the tile's bottom-right corner.

## Inspecting a tile

Only needed for a frame the catalog doesn't answer, or to double-check one. Images this small are unreadable when viewed directly — dump them as ASCII:

```sh
node .claude/skills/tileset/scripts/dump-tile.js 18 37 90            # draw as ASCII
node .claude/skills/tileset/scripts/dump-tile.js --colors 18 37 90   # list hex colors + pixel counts
```

The whole sheet uses one 35-color palette; every color has its own character:

| Char | Meaning | Char | Meaning |
|---|---|---|---|
| ` ` | transparent | `#` | dark outline |
| `.` `,` `:` | grass (main, shade, highlight) | `~` `-` `=` `o` | water (main, light, deep/shadow, foam) |
| `s` `S` | sand / shoreline | `l` `m` `k` `d` | neutral grey (light, mid, slate, dark) |
| `b` `B` `c` | blue faction (main, dark, light) | `r` `R` `p` | red faction (main, dark, pink highlight) |
| `y` `Y` `h` | orange faction (main, dark, yellow highlight) | `G` `g` | green faction dark / light |
| `f` `F` `T` | skin, skin shade, brown (hair, boots) | `w` | white |
| `*` | flower petals | `?` | color missing from the legend — add it to `LEGEND` in the script |

The green faction's main body color is the same as grass (`.`), so a `.` inside an outlined sprite is green team, not terrain.

## How the code uses the sheet

- **`src/game/tileset.js`** — the only place frame numbers live. Everything else refers to frames by name (terrain, piece, team). Add new frames here as named tables, never as magic numbers in scenes or logic. Frames in use: `TERRAIN_FRAMES` (0 grass, 37 water), `TERRAIN_EDGE_FRAMES.water` (the 3x3 set and inner corners 90–93), `UNIT_FRAMES` (124 green soldier = player, 160 red soldier = enemy), `UI_FRAMES.cursor` (61), `ARROW_FRAMES` (40–43, 58–60, 76–78).
- **`src/game/terrainTiles.js`** — pure autotiling: `getEdgePiece(grid, x, y)` names the piece a cell needs from its orthogonal neighbors (map edge counts as the same terrain; a side bordered on both sides falls back to the middle), or an `inner-*` corner when only one diagonal borders other terrain; `getTerrainFrame` maps that to a frame via `TERRAIN_EDGE_FRAMES`, or `TERRAIN_FRAMES` for terrain without an edge set.
- **`GridScene.renderTerrain`** — builds the Phaser tilemap from `getTerrainFrame`. No tile-choice rules in the scene.

## Rules when changing tile logic

1. Look frames up in the catalog. If you have to decode a frame, or learn something new about one, update `catalog.md` so it isn't re-derived.
2. Keep frame numbers in `tileset.js`; keep tile-selection rules as pure functions in `src/game/` with Vitest tests (see `terrainTiles.test.js`) — test piece names, plus one test pinning the actual frame numbers.
3. Edge pieces are drawn on the **water** tile (water with a grass rim), not on the grass tile. Grass stays plain.
4. Not yet wired into the autotiler: the 1-wide river pieces (75, 57, 39) — 1-wide water and cells touching other terrain at several diagonals fall back to `center`. A 1-wide horizontal river has no piece on the sheet.
