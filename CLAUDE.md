@AGENTS.md

# Orientation (read this before opening files)

This page is a map so you can go straight to the few files a task needs. Don't read whole directories, and don't read the big docs end to end.

## Reading the big files cheaply

These are too large to read whole. Search them instead:

| File                          | Size         | How to read it                                                                                                                                       |
| ----------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ARCHITECTURES.md`            | ~200 KB      | `grep -n '^###' ARCHITECTURES.md` lists one heading per module (`` ### `src/game/combat.ts` ``); read only the sections you need with `sed -n a,bp`. |
| `src/scenes/GridScene.ts`     | ~3,600 lines | One class; find the method by name (see the method groups below) with `grep -nE '^  (private \|async )*methodName\('`.                               |
| `src/ui/ui.css`               | ~4,600 lines | Sections start with `/* ---- Name ---- */`: `grep -n '^/\* ----' src/ui/ui.css`. A few screens have their own `.css` beside their `.tsx`.            |
| `src/bridge/views.ts`         | ~900 lines   | `grep -n '^export function'` to find the `to…View` you need.                                                                                         |
| `src/game/battle/commands.ts` | ~750 lines   | `grep -n "case '"` finds each command's handler in `applyCommand`.                                                                                   |
| `UNITS.md`, `ROADMAP.md`      | ~40 KB each  | Grep for the class or milestone name.                                                                                                                |

## Where things live

| Area                     | Files                                                                                                                                                                                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Composition root         | `src/main.ts` (mounts React, builds `Phaser.Game`, adds/removes `GridScene` as the store's `screen` changes)                                                                                                                                                             |
| Grid, terrain, movement  | `src/game/grid.ts`, `terrainMap.ts`, `movement.ts`, `attackMove.ts`, `moveArrow.ts`, `dangerZone.ts`, `push.ts`, `hazards.ts`, `structures.ts`                                                                                                                           |
| Units and classes        | `src/game/Unit.ts` (base), one file per class (`Warrior.ts`, `Archer.ts`, … and monsters `Goblin.ts`, `Slime.ts`, …), `unitClasses.ts` (registry), `promotions.ts`; numbers documented in `UNITS.md`                                                                     |
| Combat                   | `src/game/combat.ts` (ranges, damage, hit/crit, rounds), `combatStats.ts`, `modifiers.ts`, `skills.ts`, `healing.ts`, `experience.ts`                                                                                                                                    |
| Items                    | `src/game/weapons.ts`, `items.ts`, `tomes.ts`, `loot.ts`                                                                                                                                                                                                                 |
| Turns and AI             | `src/game/turns.ts`, `teams.ts`, `enemyAI.ts`, `aiScoring.ts`                                                                                                                                                                                                            |
| Battle as data           | `src/game/battle/`: `state.ts` (`BattleState`), `commands.ts` (`BattleCommand` + `applyCommand`), `history.ts` (undo), `ai.ts` / `playerAI.ts` / `lookahead.ts` (planners), `intents.ts`, `runner.ts` (headless battles)                                                 |
| Levels and objectives    | `src/game/battleSetup.ts` (story / training / warband setup), `demoLevel.ts`, `trainingLevel.ts`, `deployment.ts`, `objectives.ts`, `bosses.ts`, `enemySpawns.ts`                                                                                                        |
| Procedural maps          | `src/game/mapGen.ts` (terrain layers), `mapPlan.ts`, `mapArchetypes.ts`, `mapZones.ts`, `mapCheck.ts`, `mapScore.ts`, `buildings.ts`, `mapArt.ts`                                                                                                                        |
| Warband (roguelite) run  | `src/game/warband/`: `run.ts` (`RunState`), `runCommands.ts` (between-battle phases as commands), `stageLevel.ts` (a stage's battle), `regions.ts` / `regionsFile.ts`, rewards, boons, relics, convoy, camp, merchant, mentors, promotion, recruitment, meta progression |
| Realm (overworld map)    | `src/game/warband/realm/` (seeded realm, regions, roads, routes, ink rendering), `src/game/warband/travel.ts`                                                                                                                                                            |
| Headless runs / balance  | `src/game/warband/autoRun.ts`, `runPolicy.ts`, `simulate.ts`; `npm run sim -- --runs 50 --stages 25` (`scripts/sim.ts`)                                                                                                                                                  |
| Dialog                   | `src/game/dialog.ts`, `dialogScript.ts`, `dialogUploads.ts`; scripts in `src/data/dialog/*.txt`, speakers in `src/data/characters.json`                                                                                                                                  |
| Authored data and saves  | `src/data/` (see `src/data/README.md`): `regions.json`, characters, dialogs, `localStorage` saves (`runSave.ts`, `metaSave.ts`, `projectSave.ts`)                                                                                                                        |
| Menus (pure state)       | `src/game/actionMenu.ts`, `titleMenu.ts`, `pauseMenu.ts`, `keyRepeat.ts`, `cursor.ts`, `camera.ts`                                                                                                                                                                       |
| Phaser rendering + input | `src/scenes/GridScene.ts` (the only scene), plus `effects.ts`, `hitJuice.ts`, `unitOutline.ts`, `unitShadow.ts`, `rankBadge.ts`                                                                                                                                          |
| Bridge (Phaser ↔ React)  | `src/bridge/gameStore.ts` (store shape), `commands.ts` (React → Phaser commands), `views.ts` and `*View.ts` (pure snapshots for the UI)                                                                                                                                  |
| React UI                 | `src/ui/` one component per window (`UnitPanel.tsx`, `CombatForecast.tsx`, `RosterScreen.tsx`, `OverworldScreen.tsx`, …), `App.tsx` (page + routes), styles in `ui.css`                                                                                                  |
| Config editor            | `src/ui/ConfigsPage.tsx`, `RegionsConfigPage.tsx`, `DialogConfigPage.tsx`, `configCatalog.ts`, `regionsDraft.ts`; saved by the dev server through `vite/saveConfigs.ts`                                                                                                  |
| Audio                    | `src/audio/` (Web Audio; `cues.ts` maps store changes to sounds, `musicTrack.ts` picks music)                                                                                                                                                                            |
| Art tables               | `src/game/tileset.ts` (terrain frames), `src/assets/sprites.ts` (sprite URLs and unit sheets), `src/assets/*Icons.ts`                                                                                                                                                    |

Tests sit beside the code as `*.test.ts`. To find who uses something, grep for its name rather than reading callers.

## How a battle flows

`GridScene.create()` builds a level from `battleSetup.ts`, then runs deployment → player phase → enemy phase. Every change to the battle is a `BattleCommand` passed to `dispatch`, which runs the pure `applyCommand` and returns events that the scene animates (`playEvents`). The scene publishes plain snapshots (`views.ts`) into `gameStore`; React reads them with `useGameStore` and sends input back through `gameCommands`. A rule change therefore usually touches `src/game/` (plus its test) and sometimes a view, rarely the scene.

`GridScene` method groups, to grep by name:

- Setup and render: `create`, `renderTerrain`, `renderUnits`, `addUnitSprite`, `renderStructures`
- Menus: `openActionMenu`, `openWeaponMenu`, `openSkillMenu`, `openItemMenu`, `updatePauseMenu`, `publishMenuAnchor`
- Deployment: `startDeployment`, `updateDeployment`, `tryPlaceUnit`, `startBattle`
- Turns: `startPhase`, `endPlayerPhase`, `runEnemyPhase`, `takeEnemyAction`, `undoLastPlayerAction`, `showOutcome`
- Moving and attacking: `showMoveRange`, `updateMovePath`, `tryMoveActiveUnit`, `showAttackRange`, `updateCombatForecast`, `tryAttackWithActiveUnit`, `tryUseSkill`, `tryHeal`, `useItem`
- Animation: `playEvents`, `playEvent`, `playStrike`, `playSkill`, `playPush`, `showDamagePopup`, `showLevelUps`
- Warband screens between stages: `openRewardMenu`, `openBoonMenu`, `openCamp`, `updateRosterScreen`, `updateMerchantScreen`, `updatePromotionScreen`, `updateMentorScreen`, `marchOn`
- Auto play: `toggleAutoPlay`, `updateAutoPlay`, `autoPlayerAction`
- Dialog and preview: `playDialog`, `updateDialog`, `startPreview`, `updatePreview`

## Commands

- `npm run dev`: dev server with hot reload.
- `npm test`: tests affected by changes since `main`. `npm run test:all`: full suite (CI).
- `npm run typecheck`, `npm run format:check` (fix with `npx prettier --write <files>`), `npm run build`.

## Art

Start with the `tileset` skill (`.claude/skills/tileset/SKILL.md`, with catalogs of the overworld sheet, units and UI art) before touching any art. Specs for making new art (sizes, frames, palettes, PixelLab setup) are in the project's shared files at `/mnt/project-files/art/sprite-spec.md` (not in the repo). Work-in-progress art lives under `/mnt/project-files/art/`; finished assets go in `src/assets/` and are registered in `src/assets/sprites.ts` / `src/game/tileset.ts`.
