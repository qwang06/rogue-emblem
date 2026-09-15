# AGENTS.md

Instructions for AI coding agents working in this repository.

## Project

Rogue Emblem — a browser game built with [Phaser 3](https://phaser.io/) and bundled with [Vite](https://vitejs.dev/).

Turn-based tactical strategy, in the vein of Fire Emblem and Advance Wars: top-down, grid-based maps, units taking turns to move and act. Art is pixel art on a 16x16 tile grid — one tileset for terrain and a spritesheet (or sheets) covering all unit/character sprites. Keep new art assets aligned to the 16x16 grid so they drop into the tileset/spritesheet pipeline without special-casing.

## Coding philosophy

- **Modular, composable pieces.** Build features as independent modules (map/grid, units, turn order, combat, AI, UI) that combine rather than reach into each other's internals. Favor small, focused files over large ones that accumulate unrelated responsibilities.
- **Decouple logic into pure functions.** Game rules and calculations (movement range, attack damage, hit/crit chance, turn order, pathfinding, win/loss conditions, etc.) should be plain functions: given the same inputs, always the same outputs, no hidden state, no reaching into Phaser objects. Phaser scenes/game objects are the thin layer that calls these functions and renders the result — they should not contain the rules themselves.
- **Unit test the pure functions.** Every pure function implementing a game rule gets unit tests covering normal cases and edge cases (e.g. zero movement, blocked tiles, unit death, boundary of the map). Tests should not require Phaser or a running game instance to execute.
- **Don't rely on visual/browser testing to verify game logic.** As game rules grow more complex, eyeballing a rendered scene stops being a tractable way to confirm correctness. Unit tests on the pure functions are the source of truth — run those to verify a change instead of launching the game in a browser.

## Git workflow

- Never commit directly to `main`. Every feature or fix gets its own branch created off `main` (e.g. `feature/grid-cursor`, `fix/combat-crit-calc`).
- When a feature on a branch is complete — code written, tests passing, `ARCHITECTURES.md` updated if the change warrants it — push the branch and open a pull request against `main` on GitHub (`gh pr create`) instead of merging locally.
- Don't merge the PR yourself; merging into `main` happens through the PR on GitHub, not a local `git merge`.

## Architecture docs

`ARCHITECTURES.md` tracks the current shape of the system — modules, their responsibilities, and how they connect. Update it whenever a change is worth reflecting there: a new module, a new layer, a changed responsibility boundary, or a new significant piece (e.g. combat system, AI, save/load). Small internal edits that don't change the shape of the system don't need an update.
