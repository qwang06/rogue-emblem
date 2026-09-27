---
name: tileset
description: Reference for the game's art — the overworld terrain sheet (blob autotiles, 32x32 tiles, with a catalog of everything on it) and the standalone unit sprites (the tile cursor and movement arrow are tiles of the sheet) — plus how they're wired into code and a script to inspect any PNG as ASCII. Use whenever work touches art — choosing or changing terrain frame indices or sprite keys, TERRAIN_SHEET / TERRAIN_AUTOTILES / CURSOR_ANIMATION / ARROW_TILES / UNIT_SPRITES / UNIT_IDLE_ANIMATION in src/game/tileset.js, src/assets/sprites.js, terrain autotiling (src/game/autotile.js), adding terrain types, new unit/UI sprites, or rendering the tilemap and sprites in GridScene.
---

# Tileset and sprites

A map tile (`TILE_SIZE`) is **32px**. The art comes in two forms:

| Art | Files | Size | Drawn as |
|---|---|---|---|
| Terrain | `src/assets/overworld.png` (made from the Tactical RPG Overworld Pack sheet) | 32x32 tiles, 42x63 sheet | Phaser tilemaps: grass base plus half-tile autotile layers |
| Units | `src/assets/villager-1.png` (player), `soldier-3.png` (enemy) | 4x4 sheet of 32x32 frames | Sprite looping row 0's frames (`UNIT_IDLE_ANIMATION`) |
| Cursor | `src/assets/overworld.png` tiles `[28, 62]` and `[29, 62]` | 32x32 | Sprite looping the two tiles (`CURSOR_ANIMATION`) |
| Movement arrow | `src/assets/overworld.png` tiles in columns 29–31, rows 56–60 (`ARROW_TILES`) | 32x32 | One sprite per route tile, drawn from the sheet |

The arrow is a continuous 8px pink band through tile centers. Straights and rounded corners come from the pack's pink rounded-square loop (a 3x3 of path tiles around a gem), and the heads from the tiles just below it. Pieces are named after `src/game/moveArrow.js`: `head-up`, `head-down`, `head-left`, `head-right`, `left-right`, `up-down`, `up-left`, `up-right`, `down-left`, `down-right`. Each corner piece is named for the two tile edges it joins. The sheet also has a *broken* (segmented, directional) arrow set in rows 50–55, which we don't use; see the catalog.

## Units: idle sheets

`villager-1.png` and `soldier-3.png` were made from `Villager_01_Idle.png` and `Soldier_03_Idle.png` (192x192, drawn at 3x; not kept in the repo) redrawn at 2x with `rescale-png.js --from 3 --to 2`, giving 128x128 sheets of 4x4 32px frames. Each row is a facing direction, each column an idle animation frame (a small bob). Row 0 faces the camera (down), which is the only row we use for now; the other rows are the remaining three directions (their exact order is undecoded). The source PNGs are RGB with a `tRNS` color key making black transparent. Feet: the villager's bottom outline is x 10–21, y 28–29; the soldier's is wider (a spear sticks out lower left) down to y 31.

`GridScene` loads every sprite in `SPRITE_URLS` as a 32px spritesheet and plays `<key>-idle` on each unit. The React `UnitSprite` crops row 0 out of the sheet with a CSS background, showing its first frame, or with `animated` looping the same idle frames as the map (the deployment roster uses this).

## Terrain: overworld sheet

**[overworld-catalog.md](overworld-catalog.md)** lists everything on the sheet: grass variants, the water, sand and deep-water sets, mountains, forests, bridges, team-colored buildings and UI. Read it before picking any terrain art.

The sheet comes from a pack drawn at 3x (every art pixel is a 3x3 block, so it's natively 1024x1024, 16px tiles). `scripts/rescale-png.js` redraws the used area at 2x as `src/assets/overworld.png` (see the catalog for the command), so tile `[column, row]` on the pack is 32px tile `[column, row]` in the game, frame `row * 42 + column`.

Terrain is **blob-autotiled on the map's own cells** (not a dual grid). Grass (`TERRAIN_BASE_TILE`) fills every cell; each terrain in `TERRAIN_AUTOTILES` is drawn over it, with its border inside its own edge cells. Every set uses the same 7-column layout (strip, notched 3x3, plain 3x3), which the catalog diagrams. Water, sand beach and deep water come in **6 animation frames** laid 7 columns apart.

## Inspecting art

Images this small are unreadable when viewed directly — dump them as ASCII:

```sh
node .claude/skills/tileset/scripts/dump-png.js src/assets/villager-1.png src/assets/soldier-3.png
node .claude/skills/tileset/scripts/dump-png.js --tile 32 src/assets/overworld.png:0     # one tile of a sheet
node .claude/skills/tileset/scripts/dump-png.js --colors src/assets/villager-1.png                # colors + pixel counts
```

Each distinct color gets its own character (most common first), with a `char=hex` legend under the image; transparent pixels are spaces. Characters are assigned per image, so the same character can mean different colors in two dumps.

`scripts/rescale-png.js --from N --to M [--crop WxH] in.png out.png` changes the scale of upscaled pixel art (it checks every NxN block is one color). `dump-png.js` exports `decode` for other scripts.

## How the code uses the art

- **`src/game/tileset.js`** — the only place art is chosen. Everything else refers to art by name (terrain, team, UI element, arrow piece). `TERRAIN_SHEET` (texture key and size), `TERRAIN_BASE_TILE`, and `TERRAIN_AUTOTILES` (per terrain: `block`, the plain 3x3's top-left tile; `inner`, the all-corners-notched tile; `animation`) place terrain as `[column, row]` tiles. `CURSOR_ANIMATION` lists the cursor's two sheet tiles and how long each shows, and `ARROW_TILES` gives each arrow piece its sheet tile. `UNIT_SPRITES` (by team) maps to **texture keys**, and `UNIT_IDLE_ANIMATION` says how unit sheets are cut and animated. Never put frame numbers or keys directly in scenes or logic.
- **`src/assets/sprites.js`** — `SPRITE_URLS`, texture key → imported image URL for every standalone sprite. GridScene preloads each under its key; the React `UnitSprite` component shows one by key. A new sprite means importing its file here and naming its key in `tileset.js`. `tileset.test.js` checks every key in `tileset.js` has a URL.
- **`src/game/autotile.js`** — pure autotile logic. Each terrain cell is drawn as four quarter tiles; `getQuarterShapes(grid, x, y, terrain)` names each quarter's shape from its two side neighbors and the diagonal between them (`'outer'`, `'horizontal'`, `'vertical'`, `'inner'`, `'full'`). That covers all 47 blob combinations. Cells off the map take the nearest cell on it, so terrain continues past the edge. `getShapeTile` picks which sheet tile's same quarter draws a shape, and `getQuarterFrames` turns that into frame numbers on the sheet cut into 16px quarters (2 x 42 per row), shifted by `columnStride` for each animation frame.
- **`GridScene`** — `renderTerrain` lays a 32px grass tilemap, then one 16px-tile layer per autotiled terrain from `getQuarterFrames`, precomputing every animation frame and stepping the layer's tile indices on a timer. `addTileSprite(x, y, key)` draws a sprite stretched to exactly one tile, so 16px and 32px images both fit. The unit sprites have no shadows of their own, so `addUnitShadow` (`src/scenes/unitShadow.js`) puts a translucent pixel ellipse under each unit's feet. Its size, position and opacity are `UNIT_SHADOW` in `tileset.js`, set for where the units' feet touch the ground (see Units above), so retune it if new unit art stands differently. GridScene loads the overworld sheet as a 32px spritesheet, so the tilemaps use it whole and the cursor and arrow sprites draw single frames of it. No art-choice rules in the scene.

## Rules when changing art

1. If you decode something about an image that isn't written down here (a new sheet's layout, what a sprite shows), add it to this file so it isn't re-derived.
2. Keep frame numbers and sprite keys in `tileset.js`, and image imports in `sprites.js`. Keep tile-selection rules as pure functions in `src/game/` with Vitest tests (see `autotile.test.js`): test shape names, plus one test pinning the actual frame numbers.
3. New art should be 32x32, or a clean fraction of it (16x16 is drawn at 2x), so it drops onto the grid without special-casing.
4. An autotile set only borders its own cells against *anything else*, so any number of terrains can each be a layer over grass. Two sets that meet directly (e.g. sand next to water) just butt their borders together.
5. To preview terrain art without a browser, compose tiles with `decode` from `scripts/dump-png.js` and the pure `autotile.js` functions into a PNG, and view that.
