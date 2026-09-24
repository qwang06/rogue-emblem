# ARCHITECTURES.md

Living documentation of how Rogue Emblem is structured. This tracks the *shape* of the system — modules, their responsibilities, and how they connect — not implementation detail that's better read from the code itself.

## Stack

- [Phaser 3](https://phaser.io/) for the game world: tilemap, sprites, animations, camera, map input, and the game loop.
- [React](https://react.dev/) for UI: HUD panels, menus, dialogs — anything that's DOM-shaped rather than world-shaped. Rendered as a DOM overlay on top of the Phaser canvas.
- [Vite](https://vitejs.dev/) for dev server (hot reload) and production bundling.
- [Vitest](https://vitest.dev/) for unit tests.

## Layering

The codebase is split into layers that don't reach into each other's internals:

- **Pure game logic** (`src/game/`) — plain JS functions and data, no Phaser imports, no rendering, no hidden state. Every rule of the game (grid layout, movement, combat, turn order, etc.) belongs here so it can be unit tested without spinning up a `Phaser.Game`.
- **Phaser presentation** (`src/scenes/`) — Scenes are the thin glue layer. They call into `src/game/` for state and rules, then use Phaser APIs to draw the result and handle input. Game rules should never be implemented inline in a scene.
- **Bridge** (`src/bridge/`) — framework-agnostic store that Phaser writes to and React reads from. Neither Phaser nor React imports the other; this is the only point of contact.
- **React UI** (`src/ui/`) — components that render UI state from the bridge store. No game rules here either; components display snapshots and (in future) send commands back through the bridge.

```
 src/game/  ◄── scenes call rules
     ▲
     │
 src/scenes/ ──setState(snapshot)──► src/bridge/gameStore ──useSyncExternalStore──► src/ui/
  (Phaser)                            (plain JS store)                              (React)
```

```
src/
  game/       pure logic + data (tested with Vitest, no Phaser dependency)
  scenes/     Phaser.Scene subclasses (rendering + input, calls into src/game/)
  bridge/     Phaser → React state channel (plain JS, tested with Vitest)
  ui/         React components for the HUD overlay
  assets/     art/tileset source files
  main.js     composition root — builds Phaser.Game, mounts the React UI
```

## Modules

### `src/game/grid.js`
Pure grid data structure for the tactics board. Grid state is `{ width, height, cells }`, cells stored row-major, each cell `{ x, y, terrain, unitId }`. All mutator-shaped functions (`setTerrain`, `setUnit`) return a **new** grid rather than mutating the input.

Key functions: `createGrid`, `isInBounds`, `getCell`, `setTerrain`, `setUnit`, `moveUnit` (relocates a unit id, throwing if the source is empty or the target occupied), `getNeighbors` (orthogonal only — no diagonal movement), `gridToWorld` / `worldToGrid` (grid coordinates ↔ pixel coordinates).

Tested in `src/game/grid.test.js`.

### `src/game/tileset.js`
Constants describing the active tileset: tile size (16px), sheet dimensions, and named frame-index lookups (`TERRAIN_FRAMES`, `UNIT_FRAMES`, `UI_FRAMES`) so scenes reference terrain/units/UI elements by name instead of magic frame numbers.

### `src/game/cursor.js`
Pure logic for the map cursor: a `{ x, y }` grid position. `moveCursor` takes a delta and clamps the result to the grid bounds; it never mutates the cursor it's given. Tested in `src/game/cursor.test.js`.

### `src/game/actionMenu.js`
Pure state for the unit action menu. `UNIT_ACTIONS` lists the offered actions (Move, Attack, Item, Wait) as `{ id, label }`; a menu is a frozen `{ actions, selectedIndex }`. `moveSelection` moves the highlight with wrap-around and returns a new menu (or the same one if nothing changed); `getSelectedAction` reads the highlighted action. The module only tracks selection — carrying out an action belongs to whoever consumes the choice. Tested in `src/game/actionMenu.test.js`.

### `src/game/movement.js`
Pure movement rules. `TERRAIN_MOVE_COSTS` maps terrain to the movement points spent entering it (`Infinity` = impassable; unlisted terrain costs 1). `getMovementRange(grid, origin, movement, { terrainCosts, canPassThrough })` runs Dijkstra over orthogonal neighbors and returns every reachable destination as `[{ x, y, cost }]`, including the origin at cost 0. Other units block unless `canPassThrough(unitId)` allows them, and occupied tiles are never destinations. `getMovePath(grid, origin, destination, movement, options)` uses the same search to return the cheapest route as a list of orthogonally adjacent tiles from origin to destination (one entry per step), or `null` if the destination isn't in range — so the range and the path can never disagree. Tested in `src/game/movement.test.js`.

### `src/game/Unit.js`
Base `Unit` class that specific unit types extend. Holds stats (`name`, `health`/`maxHealth`, `attack`, `defense`, `movement`, `range`, `team`) and the state changes every unit shares: `isAlive()`, `takeDamage(amount)`, `heal(amount)` (both clamp health between `0` and `maxHealth`). No Phaser dependency — subclasses add unit-specific abilities on top. Tested in `src/game/Unit.test.js`.

### `src/scenes/GridScene.js`
The Phaser scene that renders a grid. Loads the tileset spritesheet, builds/receives grid state from `src/game/grid.js`, converts it into a Phaser tilemap for terrain, and places sprites for occupied cells using `gridToWorld` for positioning. Also renders a cursor sprite (same tileset spritesheet, frame from `UI_FRAMES.cursor`) and moves it one tile per keypress by calling `src/game/cursor.js` from `update()` and re-rendering the sprite at the new position — the scene holds no movement rules itself. Runs at 2x zoom with `pixelArt: true` (set in `main.js`) for crisp scaling of 16x16 art.

Occupied cells are backed by `src/game/Unit.js` instances held in a `unitId -> Unit` registry (`this.units`) built alongside the grid; `cell.unitId` stays a plain string so grid data remains Phaser-free, and the registry is where actual stats/behavior live. Each frame, `updateHoveredUnit()` looks up the unit (if any) under the cursor and, only when it changes, publishes `toUnitView(unit)` (or `null`) to `gameStore` as `hoveredUnit`. GridScene has no knowledge of React — it only writes plain state.

Pressing confirm (Enter/Z) while hovering a player unit opens the action menu: GridScene creates it with `src/game/actionMenu.js` and publishes it to `gameStore` as `actionMenu`. While it's open the menu owns input — up/down call `moveSelection`, cancel (Esc/X) closes it, and confirm reads `getSelectedAction`. The scene remembers the unit and tile the menu was opened for (`activeUnit`). Choosing **Move** closes the menu, puts the cursor back on that unit, and draws the tiles from `getMovementRange` as translucent overlays (allies pass through, anyone else blocks). While the range is shown the cursor moves freely; cancel clears it and reopens the menu, and confirm on an in-range tile asks `getMovePath` for the route and walks the unit's sprite along it one tile per timer tick (no tweening yet), ignoring input until it arrives, then commits the move to the grid with `moveUnit`. Sprites are kept in a `unitId -> sprite` map (`this.unitSprites`) so moves can find them. The other actions still just close the menu.

### `src/bridge/store.js`
`createStore(initialState)` → `{ getState, setState, subscribe }`. A minimal observable store: `setState` takes a partial object or `(state) => partial`, shallow-merges into a **new** state object, and notifies subscribers only if a top-level value actually changed. Its shape matches React's `useSyncExternalStore` contract. Tested in `src/bridge/store.test.js`.

### `src/bridge/gameStore.js`
The single app-wide store instance and its initial state shape. New UI-facing state gets added here as plain, serializable values.

### `src/bridge/views.js`
Pure snapshot functions (`toUnitView`) that turn live game objects into frozen plain objects for the UI. React never holds live `Unit` instances — a mutation like `takeDamage()` must be followed by publishing a fresh snapshot, which is what triggers the re-render. Tested in `src/bridge/views.test.js`.

### `src/ui/`
React HUD, mounted by `mountUI(container)` into `#ui`, a DOM element absolutely positioned over the Phaser canvas inside `#stage` (see `index.html`). The HUD root has `pointer-events: none` so input falls through to the canvas; interactive panels (`.panel`) opt back in. Components read state through `useGameStore(selector)` — a thin `useSyncExternalStore` wrapper; selectors must return stored references, not freshly built objects. Current components: `App` (HUD root), `UnitPanel` (stats of the unit under the cursor), `ActionMenu` (the open action menu with its highlighted entry; display only, input is handled by GridScene). Styles live in `ui.css`.

### `src/main.js`
Composition root. Constructs the single `Phaser.Game` instance, registers the scene list, and mounts the React UI. Phaser and React are started independently here and only communicate through `src/bridge/`. Should stay free of game logic.

### `src/assets/kenney_tiny-battle/`
Source art: a 16x16 tileset (18 cols x 11 rows, CC0 licensed, see `License.txt`) covering terrain, buildings, vehicles, and unit sprites for multiple factions (color-coded). `Tilemap/tilemap_packed.png` is the version loaded at runtime (no spacing between tiles); the other files (`Tiles/`, `Tiled/`, `Tilesheet.txt`) are reference/source material from the asset pack, not loaded directly.

## Conventions to keep in mind

See `AGENTS.md` for the coding philosophy (modular pieces, pure functions, unit tests) that this structure exists to support.
