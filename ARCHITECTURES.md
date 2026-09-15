# ARCHITECTURES.md

Living documentation of how Rogue Emblem is structured. This tracks the *shape* of the system — modules, their responsibilities, and how they connect — not implementation detail that's better read from the code itself.

## Stack

- [Phaser 3](https://phaser.io/) for rendering, scenes, and the game loop.
- [Vite](https://vitejs.dev/) for dev server (hot reload) and production bundling.
- [Vitest](https://vitest.dev/) for unit tests.

## Layering

The codebase is split into two layers that don't reach into each other's internals:

- **Pure game logic** (`src/game/`) — plain JS functions and data, no Phaser imports, no rendering, no hidden state. Every rule of the game (grid layout, movement, combat, turn order, etc.) belongs here so it can be unit tested without spinning up a `Phaser.Game`.
- **Phaser presentation** (`src/scenes/`) — Scenes are the thin glue layer. They call into `src/game/` for state and rules, then use Phaser APIs to draw the result and handle input. Game rules should never be implemented inline in a scene.

```
src/
  game/       pure logic + data (tested with Vitest, no Phaser dependency)
  scenes/     Phaser.Scene subclasses (rendering + input, calls into src/game/)
  assets/     art/tileset source files
  main.js     composition root — builds Phaser.Game, lists scenes
```

## Modules

### `src/game/grid.js`
Pure grid data structure for the tactics board. Grid state is `{ width, height, cells }`, cells stored row-major, each cell `{ x, y, terrain, unitId }`. All mutator-shaped functions (`setTerrain`, `setUnit`) return a **new** grid rather than mutating the input.

Key functions: `createGrid`, `isInBounds`, `getCell`, `setTerrain`, `setUnit`, `getNeighbors` (orthogonal only — no diagonal movement), `gridToWorld` / `worldToGrid` (grid coordinates ↔ pixel coordinates).

Tested in `src/game/grid.test.js`.

### `src/game/tileset.js`
Constants describing the active tileset: tile size (16px), sheet dimensions, and named frame-index lookups (`TERRAIN_FRAMES`, `UNIT_FRAMES`, `UI_FRAMES`) so scenes reference terrain/units/UI elements by name instead of magic frame numbers.

### `src/game/cursor.js`
Pure logic for the map cursor: a `{ x, y }` grid position. `moveCursor` takes a delta and clamps the result to the grid bounds; it never mutates the cursor it's given. Tested in `src/game/cursor.test.js`.

### `src/scenes/GridScene.js`
The Phaser scene that renders a grid. Loads the tileset spritesheet, builds/receives grid state from `src/game/grid.js`, converts it into a Phaser tilemap for terrain, and places sprites for occupied cells using `gridToWorld` for positioning. Also renders a cursor sprite (same tileset spritesheet, frame from `UI_FRAMES.cursor`) and moves it one tile per keypress by calling `src/game/cursor.js` from `update()` and re-rendering the sprite at the new position — the scene holds no movement rules itself. Runs at 4x zoom with `pixelArt: true` (set in `main.js`) for crisp scaling of 16x16 art.

### `src/main.js`
Composition root. Constructs the single `Phaser.Game` instance and registers the scene list. Should stay free of game logic.

### `src/assets/kenney_tiny-battle/`
Source art: a 16x16 tileset (18 cols x 11 rows, CC0 licensed, see `License.txt`) covering terrain, buildings, vehicles, and unit sprites for multiple factions (color-coded). `Tilemap/tilemap_packed.png` is the version loaded at runtime (no spacing between tiles); the other files (`Tiles/`, `Tiled/`, `Tilesheet.txt`) are reference/source material from the asset pack, not loaded directly.

## Conventions to keep in mind

See `AGENTS.md` for the coding philosophy (modular pieces, pure functions, unit tests) that this structure exists to support.
