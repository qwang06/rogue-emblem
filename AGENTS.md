# AGENTS.md

Instructions for AI coding agents working in this repository.

## Project

Rogue Emblem — a browser game built with [Phaser 3](https://phaser.io/) and bundled with [Vite](https://vitejs.dev/).

Turn-based tactical strategy, in the vein of Fire Emblem and Advance Wars: top-down, grid-based maps, units taking turns to move and act. Art is pixel art on a 32x32 tile grid — a blob-autotile overworld sheet for terrain (`src/assets/overworld.png`) which also holds the cursor and movement-arrow pieces, and standalone images for units. Keep new art assets aligned to the 32x32 grid so they drop into the art pipeline without special-casing.

## Tileset

Any work that touches art — picking or changing terrain frame indices or sprite keys, the tables in `src/game/tileset.ts` and `src/assets/sprites.ts`, terrain autotiling, new terrain types, unit or UI sprites, or tilemap rendering — must start by loading the `tileset` skill (`.claude/skills/tileset/SKILL.md`). It describes the terrain sheet's layout and the sprite files, and has a script for inspecting any PNG as ASCII. If you learn something new about an image, add it to the skill.

## Coding philosophy

- **Modular, composable pieces.** Build features as independent modules (map/grid, units, turn order, combat, AI, UI) that combine rather than reach into each other's internals. Favor small, focused files over large ones that accumulate unrelated responsibilities.
- **Decouple logic into pure functions.** Game rules and calculations (movement range, attack damage, hit/crit chance, turn order, pathfinding, win/loss conditions, etc.) should be plain functions: given the same inputs, always the same outputs, no hidden state, no reaching into Phaser objects. Phaser scenes/game objects are the thin layer that calls these functions and renders the result — they should not contain the rules themselves.
- **UI elements belong in React.** Menus, panels, HUD readouts, text popups (e.g. damage numbers), dialogs — build them as React components in `src/ui/` that read state from the bridge store, not as Phaser game objects. Phaser publishes what to show (including screen positions for anything anchored to the map) and React draws it. Only use Phaser for UI when it's unequivocally the better fit — e.g. something that must be drawn in world space as part of the map, like the tile cursor or range highlights.
- **Unit test the pure functions.** Every pure function implementing a game rule gets unit tests covering normal cases and edge cases (e.g. zero movement, blocked tiles, unit death, boundary of the map). Tests should not require Phaser or a running game instance to execute.
- **Don't rely on visual/browser testing to verify game logic.** As game rules grow more complex, eyeballing a rendered scene stops being a tractable way to confirm correctness. Unit tests on the pure functions are the source of truth — run those to verify a change instead of launching the game in a browser.

## Running tests

`npm test` runs only the test files affected by what changed since `main` (committed on the branch or not), using Vitest's `--changed`: a test runs when it imports a changed file, directly or indirectly. Use it to verify a change. Run the full suite with `npm run test:all` only when asked to; CI runs the full suite on every pull request to `main` and every push to it.

## TypeScript

The codebase is TypeScript in `strict` mode (`tsconfig.json`). Write new files as `.ts` / `.tsx`, not JavaScript, and import them with their `.ts` / `.tsx` extension. Run `npm run typecheck` alongside `npm test` to verify a change.

## Formatting

Prettier (`.prettierrc.json`) owns code and Markdown formatting. Don't hand-format: write the change, then run `npx prettier --write <files you touched>` (or `npm run format` for everything) and keep what it produces. `npm run format:check` must pass before a PR.

## Git workflow

- Don't commit, push, or open pull requests on your own initiative; the user will explicitly say when to do those.
- If `main` is checked out when you start new work, assume the previous work is finished and create a new branch off `main` for it before making changes, unless the user says otherwise. Otherwise work on whatever branch is currently checked out, and only create other branches when asked.
- Never commit directly to `main`.
- Create branches off `main` with a descriptive name (e.g. `feature/grid-cursor`, `fix/combat-crit-calc`) unless told otherwise.
- When asked to open a PR, make sure `npm test` passes and `ARCHITECTURES.md` is updated if the change warrants it, then push the branch and open the PR against `main` with `gh pr create`.
- Don't merge the PR yourself; merging into `main` happens through the PR on GitHub, not a local `git merge`.

## Roadmap

`ROADMAP.md` is the milestone plan for growing the game into a Fire Emblem–style tactics game. When asked to work on "the next thing" or a named milestone, start there; each milestone is one branch/PR. Tick a milestone's checkbox in the same PR that completes it, and note anything deferred under it.

## Unit reference

`UNITS.md` is the running reference for every unit class's base stats, growth rates, caps and skills, plus the level-1 matchup numbers. Update it in the same change whenever a class's stats, growths, caps or skills change, a skill's numbers change, or a class is added. `src/game/unitsDoc.test.ts` checks it against the code, so the test suite fails when it drifts.

## Architecture docs

`ARCHITECTURES.md` tracks the current shape of the system — modules, their responsibilities, and how they connect. Update it whenever a change is worth reflecting there: a new module, a new layer, a changed responsibility boundary, or a new significant piece (e.g. combat system, AI, save/load). Small internal edits that don't change the shape of the system don't need an update.
