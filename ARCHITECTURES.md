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

Key functions: `createGrid`, `isInBounds`, `getCell`, `setTerrain`, `setUnit`, `moveUnit` (relocates a unit id, throwing if the source is empty or the target occupied), `findUnit` (where a unit id stands, or `null`), `getCornerTiles` (the first/last N tiles in reading order from the top-left/bottom-right corner — used for the deployment zone and enemy spawns), `getNeighbors` (orthogonal only — no diagonal movement), `gridToWorld` / `worldToGrid` (grid coordinates ↔ pixel coordinates).

Tested in `src/game/grid.test.js`.

### `src/game/tileset.js`
Constants describing the active tileset: tile size (16px), sheet dimensions, and named frame-index lookups (`TERRAIN_FRAMES`, `UNIT_FRAMES`, `UI_FRAMES`, `ARROW_FRAMES`) so scenes reference terrain/units/UI elements by name instead of magic frame numbers. `UNIT_FRAMES` is keyed by team, so each side shares one faction color. `getFramePosition(frame)` gives a frame's column/row on the sheet, so the React UI can crop a sprite out of the sheet image. Tested in `src/game/tileset.test.js`.

### `src/game/cursor.js`
Pure logic for the map cursor: a `{ x, y }` grid position. `moveCursor` takes a delta and clamps the result to the grid bounds; it never mutates the cursor it's given. Tested in `src/game/cursor.test.js`.

### `src/game/actionMenu.js`
Pure state for the unit action menu. `UNIT_ACTIONS` lists the offered actions (Move, Attack, Skill, Item, Wait) as `{ id, label }`; `getUnitActions({ hasSkills })` returns them for a particular unit, with Skill marked `disabled` until the unit knows a skill; a menu is a frozen `{ actions, selectedIndex }`. `moveSelection` moves the highlight with wrap-around and returns a new menu (or the same one if nothing changed); `selectIndex` jumps straight to an index (ignoring out-of-range ones); `getSelectedAction` reads the highlighted action. The helpers work on any action list, so other menus (e.g. the title menu) reuse them. The module only tracks selection — carrying out an action belongs to whoever consumes the choice. Tested in `src/game/actionMenu.test.js`.

### `src/game/titleMenu.js`
`TITLE_ACTIONS` — the title screen's menu entries (Play, Settings) as frozen `{ id, label }`. Selection uses the `actionMenu.js` helpers. Tested in `src/game/titleMenu.test.js`.

### `src/game/deployment.js`
Pure rules for the **deployment phase** — the pre-battle step where the player places units from their roster onto a deployment zone (a list of `{ x, y }` tiles). `getDeploymentActions({ canStart })` builds the Place Units / Start menu entries (Start carries `disabled` until a unit is placed). `canPlaceUnit` accepts zone tiles that are empty or already hold that unit; `placeUnit` puts a unit there, lifting it off its previous tile (throws on an invalid tile). `isPlaced`, `canStartBattle(grid, roster)` (at least one roster unit on the map), and `getFirstOpenTile(grid, zone)` round it out. Tested in `src/game/deployment.test.js`.

### `src/game/demoLevel.js`
`createDemoLevel(width, height)` builds the starting state of the demo battle as `{ grid, units, roster, deploymentZone }`: grass with a patch of water, three enemy `Soldier`s on the last three tiles of the bottom-right, the player's roster (one `Soldier`) kept off the map, and the first three tiles of the top-left as the deployment zone. `units` is the `unitId -> Unit` registry for both sides. Stand-in until levels are loaded from data. Tested in `src/game/demoLevel.test.js`.

### `src/game/pauseMenu.js`
`PAUSE_ACTIONS` — the pause menu's entries (Main Menu, Settings) as frozen `{ id, label }`. Selection uses the `actionMenu.js` helpers. Tested in `src/game/pauseMenu.test.js`.

### `src/game/movement.js`
Pure movement rules. `TERRAIN_MOVE_COSTS` maps terrain to the movement points spent entering it (`Infinity` = impassable; unlisted terrain costs 1). `getMovementRange(grid, origin, movement, { terrainCosts, canPassThrough })` runs Dijkstra over orthogonal neighbors and returns every reachable destination as `[{ x, y, cost }]`, including the origin at cost 0. Other units block unless `canPassThrough(unitId)` allows them, and occupied tiles are never destinations. `getMovePath(grid, origin, destination, movement, options)` uses the same search to return the cheapest route as a list of orthogonally adjacent tiles from origin to destination (one entry per step), or `null` if the destination isn't in range — so the range and the path can never disagree. `extendMovePath(grid, path, target, movement, options)` updates a planned route as the cursor moves: it cuts back to a tile already on the path, appends an adjacent step while the traced route stays within movement, and otherwise falls back to `getMovePath` (leaving the path unchanged if the target is unreachable), so the route follows the way the player traced it. `getPathCost` sums the cost of the tiles a path enters. Tested in `src/game/movement.test.js`.

### `src/game/moveArrow.js`
Pure logic for the movement arrow. `getArrowPieces(path)` returns `[{ x, y, piece }]` for every tile of a route after the origin: an arrowhead (`head-up`/`down`/`left`/`right`) on the last tile pointing the way it last stepped, and on the tiles before it a straight segment or corner named for the two tile edges it joins (`up-down`, `left-right`, `up-left`, `down-right`, …). `ARROW_FRAMES` in `tileset.js` maps each piece name to its frame. Tested in `src/game/moveArrow.test.js`.

### `src/game/combat.js`
Pure combat rules. `getAttackRange(grid, origin, maxRange, minRange = 1)` returns every in-bounds tile within that orthogonal distance band as `[{ x, y }]` — never the attacker's own tile, and not blocked by terrain or units. `getAttackTargets(grid, origin, maxRange, isHostile, minRange)` narrows that to occupied tiles whose unit `isHostile(unitId)` accepts, as `[{ x, y, unitId }]`. `calculateDamage(attacker, defender)` is `attack - defense`, floored at 0. Applying damage is left to the caller (`Unit.takeDamage`). Tested in `src/game/combat.test.js`.

### `src/game/Unit.js`
Base `Unit` class that specific unit types extend. Holds stats (`name`, `unitClass`, `level` (default 1), `health`/`maxHealth`, `mana`/`maxMana` (default 0), `attack`, `defense`, `movement`, `range`, `team`) and the state changes every unit shares: `isAlive()`, `takeDamage(amount)`, `heal(amount)` (both clamp health between `0` and `maxHealth`), `spendMana(amount)` (throws if the unit can't afford it), `restoreMana(amount)` (clamped to `maxMana`), and `levelUp()`. No Phaser dependency — subclasses set their class and stat line. Tested in `src/game/Unit.test.js`.

### `src/game/Soldier.js`
`Soldier` — the basic infantry `Unit` subclass: `unitClass: 'soldier'`, starts at level 1 with the `SOLDIER_STATS` line (10 HP, 5 mana, 4 ATK, 2 DEF, 5 MOV). Takes an optional `name` (e.g. "Enemy Soldier") and `level`. Tested in `src/game/Soldier.test.js`.

### `src/game/skills.js`
Pure skill rules. A skill is `{ id, label, manaCost, range, power, animation }` (`animation` names the effect the scene plays). `SKILL_TREES` maps each unit class to `[{ level, skill }]`, so every class has its own skills and a unit knows each one whose level it has reached — skills are gained by leveling up rather than stored on the unit. `getLearnedSkills(unitClass, level, trees)` lists the known skills in tree order, `getSkillsLearnedBetween(unitClass, fromLevel, toLevel, trees)` the ones a level up unlocks, `findLearnedSkill(unitClass, level, skillId, trees)` looks one up by id, `calculateSkillDamage(skill, defender)` is the skill's `power - defense` (floored at 0, independent of the user's attack), `canUseSkill(unit, skill)` checks mana, and `getSkillActions(unit, skills)` builds skill menu entries (`{ id, label, manaCost, disabled }`, disabled when unaffordable). The soldier learns `THROW_GRENADE` (3 mana, range 2, power 6) at level 1. Tested in `src/game/skills.test.js`.

### `src/scenes/GridScene.js`
The Phaser scene that renders a grid. Loads the tileset spritesheet, gets the starting grid, unit registry, roster, and deployment zone from `createDemoLevel`, converts it into a Phaser tilemap for terrain, and places sprites for occupied cells using `gridToWorld` for positioning. Also renders a cursor sprite (same tileset spritesheet, frame from `UI_FRAMES.cursor`) and moves it one tile per keypress by calling `src/game/cursor.js` from `update()` and re-rendering the sprite at the new position — the scene holds no movement rules itself. Runs at 2x zoom with `pixelArt: true` (set in `main.js`) for crisp scaling of 16x16 art.

Occupied cells are backed by `src/game/Unit.js` instances held in a `unitId -> Unit` registry (`this.units`) built alongside the grid; `cell.unitId` stays a plain string so grid data remains Phaser-free, and the registry is where actual stats/behavior live. Each frame, `updateHoveredUnit()` looks up the unit (if any) under the cursor and, only when it changes, publishes `toUnitView(unit)` (or `null`) to `gameStore` as `hoveredUnit`. GridScene has no knowledge of React — it only writes plain state.

On `create()` the scene resets the battle-related store fields and starts in the **deployment phase** (`phase: 'deployment'`). The deployment zone is highlighted and the map cursor is hidden while a deployment menu has input (a hidden cursor hovers nothing, so the unit panel clears too). Input runs through three steps (published as `deploymentStep`): `'menu'` — the Place Units / Start menu (`deploymentMenu`); `'roster'` — the roster menu (`rosterMenu`, entries from `toRosterEntryView`) to pick a unit; `'placing'` — the cursor roams and confirm on a tile `canPlaceUnit` accepts calls `placeUnit` and draws (or moves) the unit's sprite, then returns to the menu with Start highlighted. Cancel steps back (placing → roster → menu). The cursor only shows during `'placing'`. Start is ignored while disabled; once chosen it clears the zone, sets `phase: 'battle'`, and hands input to the battle controls below. All menus are mirrored to the store through `publishMenu(key, menu)`.

In the battle phase, pressing cancel on the bare map (no menu open, no range shown) opens the **pause menu** (`pauseMenu`, from `PAUSE_ACTIONS`), which owns input while open: cancel closes it, Main Menu resets the battle store fields and sets `screen: 'title'` (which makes `main.js` remove the scene), and Settings is a placeholder.

Pressing confirm (Enter/Z) while hovering a player unit opens the action menu: GridScene creates it with `src/game/actionMenu.js` and publishes it to `gameStore` as `actionMenu`. While it's open the menu owns input — up/down call `moveSelection`, cancel (Esc/X) closes it, and confirm reads `getSelectedAction`. The scene remembers the unit and tile the menu was opened for (`activeUnit`). Choosing **Move** closes the menu, puts the cursor back on that unit, and draws the tiles from `getMovementRange` as translucent overlays (allies pass through, anyone else blocks). While the range is shown the cursor moves freely; cancel clears it and reopens the menu, and as the cursor moves the scene keeps a planned route with `extendMovePath` and draws it as an arrow from `getArrowPieces` (sprites above the range overlay, below units); confirm on an in-range tile at the end of that route walks the unit's sprite along it one tile per timer tick (no tweening yet), ignoring input until it arrives, then commits the move to the grid with `moveUnit`. Sprites are kept in a `unitId -> sprite` map (`this.unitSprites`) so moves can find them. Choosing **Attack** works the same way but draws the tiles from `getAttackRange` in red; confirm only accepts a tile holding a hostile unit (any other team) from `getAttackTargets`. The defender takes `calculateDamage` right away (the hovered-unit snapshot is republished so the HUD updates), its sprite plays the hit flash from `src/scenes/effects.js`, and a damage popup is published to `gameStore` (see below) while input is locked, and a unit at 0 health is then removed from the grid, the registry, and the sprite map. Move/attack share one range overlay (`rangeMode` + `rangeTiles`).

Damage numbers are drawn by React, not Phaser: `showDamagePopup` converts the hit sprite's top center to screen pixels with `worldToScreen` (using the camera's `worldView` and zoom), appends a `toDamagePopupView` snapshot to `gameStore.damagePopups`, and removes it after `DAMAGE_POPUP_DURATION_MS`. The same duration travels in the snapshot so React's CSS animation and the entry's lifetime agree. Item and Wait still just close the menu.

The action menu is built per unit with `getUnitActions`, so **Skill** is greyed out (and confirm ignores it) until the unit has learned a skill from its class's tree. Choosing it replaces the action menu with the **skill menu** (`skillMenu`, from `getSkillActions`), which owns input while open: cancel returns to the action menu, and confirm on an affordable skill shows its range (`getAttackRange` with the skill's `range`) in orange as `rangeMode: 'skill'`, remembering the skill as `activeSkill`. Cancel while aiming goes back to the skill menu; confirm on a hostile unit in range spends the mana, applies `calculateSkillDamage`, and plays the grenade animation from `effects.js` (lob, then fire burst) before publishing the new health and damage popup and removing a defeated unit.

### `src/scenes/effects.js`
Presentation-only sprite effects that never touch game state; each calls `onDone` when finished. `playHitFlash(scene, sprite, onDone)` blinks a sprite solid white a few times on the scene clock. `playGrenadeThrow(scene, from, to, onDone)` lobs a drawn circle along an arc between two world points. `playFireBurst(scene, sprite, center, onDone)` explodes a particle burst tinted yellow → orange → red that drifts upward, while the sprite flickers orange. Neither needs sprite art: the fire particle texture is drawn with `Graphics` and generated at runtime the first time it's used.

### `src/bridge/store.js`
`createStore(initialState)` → `{ getState, setState, subscribe }`. A minimal observable store: `setState` takes a partial object or `(state) => partial`, shallow-merges into a **new** state object, and notifies subscribers only if a top-level value actually changed. Its shape matches React's `useSyncExternalStore` contract. Tested in `src/bridge/store.test.js`.

### `src/bridge/gameStore.js`
The single app-wide store instance and its initial state shape. `BATTLE_STATE_DEFAULTS` holds the fields that only matter while the map runs; the map scene resets them on start and on exit so nothing leaks between battles. New UI-facing state gets added here as plain, serializable values. `skillMenu` is the open skill menu. `phase` (`'deployment'` | `'battle'` while the map runs), `deploymentStep`, `deploymentMenu`, and `rosterMenu` describe the deployment phase. `screen` (`'title'` | `'battle'`) is which top-level screen is showing; it's the one field React writes (choosing Play sets it to `'battle'`), and `main.js` reacts to it by starting the map scene.

### `src/bridge/views.js`
Pure snapshot functions that turn live game objects into frozen plain objects for the UI: `toUnitView`, `toDamagePopupView`, `toRosterEntryView` (a roster menu entry: id, name, sprite frame, placed flag), plus `worldToScreen` for placing map-anchored UI (world point + `{ x, y, zoom }` camera view → screen pixels in the canvas/`#ui` box). React never holds live `Unit` instances — a mutation like `takeDamage()` must be followed by publishing a fresh snapshot, which is what triggers the re-render. Tested in `src/bridge/views.test.js`.

### `src/ui/`
React HUD, mounted by `mountUI(container)` into `#ui`, a DOM element absolutely positioned over the Phaser canvas inside `#stage` (see `index.html`). The HUD root has `pointer-events: none` so input falls through to the canvas; interactive panels (`.panel`) opt back in. Components read state through `useGameStore(selector)` — a thin `useSyncExternalStore` wrapper; selectors must return stored references, not freshly built objects. Current components: `App` (UI root — shows `TitleScreen` while `screen` is `'title'`, otherwise the battle HUD), `TitleScreen` (the landing page: title, crest, and the Play/Settings menu; driven by arrows + Enter/Z or the mouse, holds its menu selection in local state via the `actionMenu.js` helpers; Play sets `screen: 'battle'`, Settings is a placeholder), `DeploymentBanner` (names the deployment phase and hints at the current step), `DeploymentMenu` (Place Units / Start, with Start greyed while disabled), `RosterMenu` (units available to deploy, each with its sprite via `UnitSprite`, which crops a tileset frame with CSS), `PauseMenu` (the Main Menu / Settings menu over a dimmed map), `UnitPanel` (level and stats of the unit under the cursor, including HP and MP), `ActionMenu` (the open action menu with its highlighted entry, disabled entries greyed; display only, input is handled by GridScene), `SkillMenu` (the active unit's skills with their mana cost, unaffordable ones greyed), `DamagePopups` (floating damage numbers at the screen positions GridScene publishes, animated with a CSS rise-and-fade). Styles live in `ui.css`.

### `src/main.js`
Composition root. Constructs the single `Phaser.Game` instance with no scenes running, mounts the React UI (which opens on the title screen), and subscribes to `gameStore` so that when `screen` becomes `'battle'` it adds and starts `GridScene`, and when it goes back to `'title'` it removes the scene (so the next Play starts a fresh battle). Phaser and React are started independently here and only communicate through `src/bridge/`. Should stay free of game logic.

### `src/assets/kenney_tiny-battle/`
Source art: a 16x16 tileset (18 cols x 11 rows, CC0 licensed, see `License.txt`) covering terrain, buildings, vehicles, and unit sprites for multiple factions (color-coded). `Tilemap/tilemap_packed.png` is the version loaded at runtime (no spacing between tiles); the other files (`Tiles/`, `Tiled/`, `Tilesheet.txt`) are reference/source material from the asset pack, not loaded directly.

## Conventions to keep in mind

See `AGENTS.md` for the coding philosophy (modular pieces, pure functions, unit tests) that this structure exists to support.
