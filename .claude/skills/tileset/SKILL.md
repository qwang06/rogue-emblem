---
name: tileset
description: Reference for the game's art — the grass/water dual-grid terrain tileset (32x32 frames) and the standalone sprite images for units, the cursor, and movement-arrow pieces — plus how they're wired into code and a script to inspect any PNG as ASCII. Use whenever work touches art — choosing or changing terrain frame indices or sprite keys, TERRAIN_CORNER_FRAMES / UNIT_SPRITES / UI_SPRITES / ARROW_SPRITES in src/game/tileset.js, src/assets/sprites.js, dual-grid terrain logic (src/game/terrainTiles.js), adding terrain types, new unit/UI sprites, or rendering the tilemap and sprites in GridScene.
---

# Tileset and sprites

A map tile (`TILE_SIZE`) is **32px**. The art comes in two forms:

| Art | Files | Size | Drawn as |
|---|---|---|---|
| Terrain | `src/assets/tileset-grass-water.png` | 32x32 frames, 4x4 sheet | Phaser tilemap, picked by frame number |
| Units | `src/assets/warrior-1.png` (player), `warrior-2.png` (enemy) | 32x32 | One image per sprite |
| Cursor | `src/assets/cursor.png` | 16x16 | One image, stretched to the tile |
| Movement arrow | `src/assets/path/<piece>.png` | 16x16 | One image per piece, stretched to the tile |

The arrow pieces are named after the pieces in `src/game/moveArrow.js`: `head-up`, `head-down`, `head-left`, `head-right`, `left-right`, `up-down`, `up-left`, `up-right`, `down-left`, `down-right`. Each corner piece is named for the two tile edges it joins.

## Terrain: grass/water dual grid

`frame = row * 4 + col`. Every tile shows grass and water meeting at its midlines: each **quadrant** is either water or grass, with a brown shoreline drawn where they meet. That's a *dual-grid* tileset (the 4x4 layout is the standard dual-grid template). Tiles are not drawn on the map's cells. They sit on a second grid offset by half a tile, so each tile covers the point where four cells meet. The tile's frame is chosen by which of those four cells are water.

Frames by which corners hold water (TL TR BL BR; `W` water, `.` grass):

```
 0 . . W .    1 . W . W    2 W . W W    3 . . W W
 4 W . . W    5 . W W W    6 W W W W    7 W W W .
 8 . W . .    9 W W . .   10 W W . W   11 W . W .
12 . . . .   13 . . . W   14 . W W .   15 W . . .
```

`12` is plain grass and `6` open water. The single-corner pieces (0, 8, 13, 15) have only a small water blob tucked in the corner, so a 16x16 quadrant majority count reads them as all grass. Sample the 8px block at the tile's outer corner instead. The sheet's palette is free-form: blue-dominant pixels (`b > r + 30`) are water.

## Inspecting art

Images this small are unreadable when viewed directly — dump them as ASCII:

```sh
node .claude/skills/tileset/scripts/dump-png.js src/assets/cursor.png src/assets/path/head-up.png
node .claude/skills/tileset/scripts/dump-png.js --tile 32 src/assets/tileset-grass-water.png:15   # one frame of a sheet
node .claude/skills/tileset/scripts/dump-png.js --colors src/assets/warrior-1.png                 # colors + pixel counts
```

Each distinct color gets its own character (most common first), with a `char=hex` legend under the image; transparent pixels are spaces. Characters are assigned per image, so the same character can mean different colors in two dumps.

## How the code uses the art

- **`src/game/tileset.js`** — the only place art is chosen. Everything else refers to art by name (terrain piece, team, UI element, arrow piece). `TERRAIN_CORNER_FRAMES.water` maps the 16 dual-grid corner pieces to frames. `UNIT_SPRITES` (by team), `UI_SPRITES`, and `ARROW_SPRITES` (by arrow piece) map to **texture keys**. Never put frame numbers or keys directly in scenes or logic.
- **`src/assets/sprites.js`** — `SPRITE_URLS`, texture key → imported image URL for every standalone sprite. GridScene preloads each under its key; the React `UnitSprite` component shows one by key. A new sprite means importing its file here and naming its key in `tileset.js`. `tileset.test.js` checks every key in `tileset.js` has a URL.
- **`src/game/terrainTiles.js`** — pure dual-grid logic. The terrain grid is one tile bigger than the map each way (`getTerrainGridSize`); terrain tile `(x, y)` has cell `(x-1, y-1)` in its top-left corner and `(x, y)` in its bottom-right. `getCornerPiece(grid, x, y, terrain)` names which corners hold the terrain (`'none'`, `'top-left+bottom-right'`, …, `'all'`); corners off the map take the nearest cell on it, so terrain continues past the edge. `getTerrainFrame` maps that to a frame via `TERRAIN_CORNER_FRAMES`.
- **`GridScene`** — `renderTerrain` builds the Phaser tilemap from `getTerrainFrame`, offset by half a tile up and left, with a geometry mask cropping the half tile that hangs past the map. `addTileSprite(x, y, key)` draws a sprite stretched to exactly one tile, so 16px and 32px images both fit. The unit sprites have no shadows of their own, so `addUnitShadow` (`src/scenes/unitShadow.js`) puts a translucent pixel ellipse under each unit's feet. Its size, position and opacity are `UNIT_SHADOW` in `tileset.js`, set for where the warriors' feet touch the ground (x 8–25, bottom row y 29–30), so retune it if new unit art stands differently. No art-choice rules in the scene.

## Rules when changing art

1. If you decode something about an image that isn't written down here (a new sheet's layout, what a sprite shows), add it to this file so it isn't re-derived.
2. Keep frame numbers and sprite keys in `tileset.js`, and image imports in `sprites.js`. Keep tile-selection rules as pure functions in `src/game/` with Vitest tests (see `terrainTiles.test.js`): test piece names, plus one test pinning the actual frame numbers.
3. New art should be 32x32, or a clean fraction of it (16x16 is drawn at 2x), so it drops onto the grid without special-casing.
4. A dual-grid set covers exactly two terrains (here water over grass). A third terrain needs its own dual-grid set drawn as another layer, or a set covering its borders with each terrain it meets.
