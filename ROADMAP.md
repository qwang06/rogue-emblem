# ROADMAP.md

The plan for growing Rogue Emblem into a Fire Emblem–style tactics game, one small branch at a time. `ARCHITECTURES.md` describes what the system _is_; this file describes what we intend to build _next_.

## How to use this file

- Each milestone is sized to be **one branch / one PR**. Work them roughly in order — later milestones lean on earlier ones (dependencies are listed).
- Pick the first unchecked milestone, branch off `main` (e.g. `feature/counterattacks`), build it, and tick its box in the same PR.
- Every milestone follows the house rules in `AGENTS.md`: rules go in pure functions under `src/game/` with unit tests, Phaser stays a thin rendering layer, UI goes in React under `src/ui/` via the bridge store.
- Feel free to split, reorder, or rewrite milestones as we learn — this is a plan, not a contract. Note anything deferred under the milestone so it isn't lost.

## Where we are

Already built: grid and terrain move costs, movement range and arrow, player/enemy phases with win/loss, one-way attacks (`attack - defense`; counterattacks and FE-style stats since 1.1/1.2), skills with mana, consumable items, deployment, a rushing enemy AI, dialog, title/pause menus, and training mode. Phase 1 added counterattacks, hit/crit/doubling, the combat forecast, and XP with growth-rate level ups. Phase 2 has begun: units fight with weapons (2.1). 2.3 has begun: Villager and Soldier are joined by the Archer, the Vanguard, the Wizard, the Guard and the Acolyte. Warband Mode (Dungeon Mode until W.0) is a run of generated overworld maps whose warband carries XP, HP, items and deaths from stage to stage (W.1); Phase W turns it into the game's roguelike run.

---

## Phase 1 — Combat core

The single biggest change to how the game feels. After this phase every attack is a two-sided, uncertain exchange the player can preview.

### [x] 1.1 Combat resolution and counterattacks

- New pure `resolveCombat(attacker, defender, context)` in `combat.ts` returning an ordered list of strikes: `[{ by, target, damage, hit, crit, lethal }]`, plus resulting HP for both sides. Combat ends early when a unit dies.
- Defender counterattacks if the attacker's tile is within the defender's range (min/max).
- `GridScene` plays the strike list in sequence (existing damage popups per strike) instead of applying a single hit.
- Enemy attacks during enemy phase go through the same function (player units counter).
- Skills stay one-way for now (no counter) — note if that should change.
- **Tests:** counter in range, no counter out of range (e.g. range-2 attacker vs range-1 defender), attacker kills before counter, counter kills attacker, 0-damage exchanges.
- _Notes:_ units only have a max `range`; `isInStrikeRange` honours an optional `minRange` (default 1) so bows/siege can set one later. Skills remain one-way — revisit once magic/tomes exist (a tome attack should probably be a regular combat with counters, while utility skills like the grenade stay one-way). `hit`/`crit` are fixed to `true`/`false` until 1.3.

### [x] 1.2 Expanded stats

- Add `skill`, `speed`, `luck`, `resistance` to `Unit` (rename `attack` → `strength` if it reads better once weapons exist; decide here).
- Split damage into physical (`strength - defense`) and magical (`magic - resistance`) — add `magic` too, or defer until mages exist (1.2 decides and notes it).
- Update `Soldier` stats, `UnitPanel` display, and existing tests.
- **Tests:** stat defaults, damage type selection.
- _Notes:_ `attack` is renamed to `strength` (weapon might will add to it in 2.x). `magic` is added now (default 0) together with a per-unit `damageType` (`'physical'` | `'magical'`, default physical) so damage type selection works before mages exist; once weapons land the type should come from the equipped weapon instead. Skills still deal `power - defense` regardless of type — give skills a `damageType` when magical skills appear. Soldier: 4 STR, 0 MAG, 3 SKL, 3 SPD, 2 LCK, 2 DEF, 0 RES.

### [x] 1.3 Hit, crit, and doubling

- Pure formulas in a new `src/game/combatStats.ts` (or within `combat.ts` if small):
  - Hit = `skill * 2 + luck / 2` (+ weapon hit later); Avoid = `speed * 2 + luck` (+ terrain later); displayed hit = clamp(Hit − Avoid, 0, 100).
  - Crit = `skill / 2` (+ weapon crit later); Dodge = `luck`; crit deals ×3 damage.
  - Doubling: a unit strikes twice if its speed exceeds the opponent's by `DOUBLE_THRESHOLD` (4).
- RNG is **injected** (`rng: () => number`) into `resolveCombat` so tests are deterministic. Consider FE's "2RN" true-hit (average of two rolls) as an option flag.
- Strike order: attacker, defender, then whoever doubles.
- Damage popups show "Miss" and "Crit!".
- **Tests:** formula edge cases, clamping, doubling on both sides, exact threshold, crit lethal, all-miss sequences with a stubbed RNG.
- _Notes:_ formulas live in `src/game/combatStats.ts`; `getStrikeOrder` in `combat.ts` is shared so the 1.4 forecast can reuse it. Hit adds a flat `BASE_HIT` (80) standing in for weapon hit — with stats alone two soldiers have 7 hit vs 8 avoid (0%); weapons should replace it. Soldier vs soldier is 79% hit, 0% crit, no doubling. Doubling uses `>=` the threshold. 2RN is available as `trueHit` but off by default; the scene uses `Math.random`. Crits also shake the camera. Crit rolls are 1RN. Skills (the grenade) still always hit and never crit.

### [x] 1.4 Combat forecast panel

- Pure `getCombatForecast(attacker, defender, context)` → `{ attacker: { hp, damage, hit, crit, strikes }, defender: {...} }` — shares formulas with `resolveCombat` so preview and outcome can't disagree.
- When choosing an attack target, the scene publishes the forecast for the hovered target; a React `CombatForecast.tsx` renders it (HP, Dmg, Hit, Crit, ×2) beside the units.
- Confirm/cancel flow: cursor over target shows the forecast, confirm attacks, cancel backs out.
- **Tests:** forecast equals the expected values of `resolveCombat`; no-counter shows "–" for defender.
- _Notes:_ each side is `{ health, maxHealth, damage, hit, crit, strikes, counters }`; a non-countering defender has `null` damage/hit/crit (rendered "–") and 0 strikes. `damage` is per landed non-crit strike — the panel doesn't show a predicted post-combat HP (could add "HP → after" later). Entering attack aim snaps the cursor to the first target in range; no cycling between targets with a dedicated key yet. The panel opens beside both units (right of the pair if it fits, else left). Enemy-phase attacks show no forecast. Skills get no forecast yet — add one when magic/tome skills join regular combat.

### [x] 1.5 Experience and growth rates

- Pure `src/game/experience.ts`: XP for a hit / a kill / a miss, scaled by level difference (FE-style); 100 XP = level up, carry overflow.
- Growth rates per class (`{ health: 80, strength: 50, ... }` percentages); `rollLevelUp(unit, growths, rng)` returns the stat gains. `Unit.levelUp()` applies gains instead of only incrementing level.
- Existing skill unlocks (`getSkillsLearnedBetween`) hook into the same level-up.
- React `LevelUpPanel.tsx` showing each stat with "+1" highlights; XP bar after combat.
- Only player units gain XP.
- **Tests:** XP amounts across level gaps, overflow, multi-level gain, growth rolls with stubbed RNG, 0% / 100% growths, stat caps (if any).
- _Notes:_ FE7-style numbers: hit = `max(1, floor((31 + enemyLv − Lv) / 3))` (10 at even levels), kill = hit + `max(0, 20 + 3 × (enemyLv − Lv))` (30 at even levels), 1 XP for a miss / 0-damage / no-strike combat, 0 if the unit dies; one combat gives at most 100 XP. Max level 20 (XP stays 0 there). Growths and caps live on the unit (set by its class, e.g. `SOLDIER_GROWTHS` / `SOLDIER_CAPS`; caps are 40 HP, 30 MP, 20 otherwise); growths over 100% give guaranteed points. Health/mana gains raise current values too. A damaging skill earns XP as one landed strike; items earn none. No class-based XP modifiers (promoted classes etc.) yet. The level-up panel is timed rather than dismissed with confirm, and the XP bar shows in the bottom center of the map rather than by the unit. Skill unlocks are listed on the panel, but the Soldier's only skill is learned at level 1, so none show yet.

---

## Phase 2 — Units with identity

### [x] 2.1 Weapons

- Weapons as a new item kind: `{ id, label, type: 'sword'|'lance'|'axe'|'bow'|'tome'|'staff', might, hit, crit, weight, minRange, maxRange, uses, damageType }`.
- Unit inventory holds weapons and consumables; one weapon is **equipped** (first usable weapon by default). Attack range comes from the equipped weapon, replacing the fixed `range` stat.
- Formulas from 1.3 gain the weapon terms; attack speed = `speed - max(0, weight - strength)` (or constitution later).
- Weapon uses tick down per strike; a broken weapon is removed.
- "Attack" flow lets the player pick a weapon (weapon select menu) before targeting; the forecast updates per weapon.
- Starter weapons: Iron Sword/Lance/Axe, Iron Bow, Fire tome, Heal staff (staff usage comes in 2.3).
- **Tests:** equip rules, range from weapon, uses/breakage, weight penalty, forecast per weapon.
- _Notes:_ built around the unit catalog rather than FE's weapon list: a weapon's `type` is `physical`, `magical` or `siege` (no sword/lance/axe), and it's a mastery gate — each class lists the types it can wield (`weaponTypes`; Soldier and Villager: physical). Damage type comes from the weapon (siege hits physically), replacing `Unit.damageType`, and `Unit.range` is gone. Weapons live in `src/game/weapons.ts`; an inventory entry's `quantity` is a weapon's uses left, and weapons never stack. Starters, one per armed catalog unit: Fists (∞ uses, the villager's), Iron Spear (soldier), Iron Axe (vanguard), Iron Bow (archer, range 2 only), Fire (elemental/wizard, 1–2), Powder Keg (sapper, siege 1–2), Ballista (siege engine, 2–3) — only Fists and the Iron Spear are carried until 2.3 adds the classes. Weapon hit replaces `BASE_HIT`; the iron weapons keep 80 so level-1 hit rates didn't move (79%), and the spear's 1 might makes soldiers hit for 3. Every strike spends a use, hit or miss, so breakage is deterministic and the forecast caps strikes at the uses left; a weapon that breaks mid-exchange stops its wielder striking ("Broke!" popup) and the next wieldable weapon is equipped. Attack → weapon menu (wieldable weapons, greyed when nothing is in range, highlighted weapon's numbers shown) → aim; picking equips (moves it to the front), and cancelling the aim returns to the weapon menu. The forecast names each side's weapon. The move-range threat fringe spans all wieldable weapons. Deferred: the Heal staff (with the Acolyte/Cleric in 2.3), constitution, the AI choosing between weapons (it fights with whatever is equipped), unequip/discard/trade, and weapon ranks.

### [ ] 2.2 Weapon triangle

- Physical > Magical > Siege > Physical, on the weapon `type` from 2.1: infantry rushes casters, magic burns engines, siege breaks infantry at range. The cycle pushes against the edges combat already has (magic hits low-RES physical units, siege can't defend itself up close) rather than stacking on them.
- Compares the attacker's equipped weapon with the defender's: advantage gives +15 hit and +1 damage, disadvantage the reverse. Same type, or either side unarmed, is neutral. Tune the damage half once classes exist: +1 is about a third of a level-1 hit.
- Forecast shows advantage arrows.
- Pure `getTriangleModifier(attackerWeapon, defenderWeapon)` in `weapons.ts`, applied in `combatStats.ts` (hit) and `combat.ts` (damage).
- **Tests:** every pairing, neutral cases, unarmed attacker and defender, hit and damage clamps.
- _Decided:_ chose this over a spear/axe/sword triangle on a new weapon field and over effectiveness tags (bonus might against flying or armored units, which could still come after 2.4).

### [ ] 2.3 New classes

One class per sub-PR is fine. Each class: stat line, growth rates, weapon types it can use, movement type, sprite (load the `tileset` skill for art), skill tree entries.

_Decided:_ classes are named after the unit art in `src/assets/units/` (see the tileset skill's `units-catalog.md`), not Fire Emblem's classes, since 2.1's weapons and W.6's traits already use those names and the pack has no sword, lance, knight or lord art. Each entry notes the Fire Emblem role it stands in for.

- [ ] **Lord** — the unit whose death loses the battle. No art of its own; build it with 3.3/3.4, where its rule lives.
- [x] **Vanguard** (Fighter) — Iron Axe, `Vanguard_04` art, high HP/strength, low skill.
  - _Notes:_ `src/game/Vanguard.ts`. 12 HP, 5 STR (the Iron Axe's weight, so it isn't slowed), 2 SKL, 2 SPD, 1 LCK, 2 DEF. Learns **Cleave** (2 MP, range 1, +2 STR, no counter). Against a soldier it hits for 6 at 61%. Its axe hangs left of the body (feet x 4–21), so the shared `UNIT_SHADOW` sits a little right of its feet; retune per art if that shows.
- [x] **Archer** — bow, range 2 only (can't counter adjacent).
  - _Notes:_ `src/game/Archer.ts`, Iron Bow, `Archer_02` art. Frail and accurate (9 HP, 3 STR, 5 SKL, 4 SPD, 1 DEF, 1 RES). Learns **Long Shot** (2 MP, range 1–3, its regular hit, no counter), which reuses the thrown-stone animation until there's an arrow one. Selectable in Training, where two archers spar.
- [x] **Wizard** (Mage) — Fire, the staff `Vanguard_01` art, magic damage vs resistance.
  - _Notes:_ `src/game/Wizard.ts`, magical weapons only. 8 HP, 8 MP, 1 STR, 4 MAG, 0 DEF, 3 RES. Learns **Fireball** (3 MP, range 1–3, +1 MAG, no counter), which reuses the thrown-stone animation. Against a soldier it hits for 6 at 84% and can cast from 2 tiles without a counter. The `Elemental` art (also a Fire user in the weapons table) is still unused; it could become an enemy-only caster or a W.6 Arcane recruit.
- [x] **Acolyte** (Cleric) — `Acolyte` art, staff only: new **Heal** action targeting adjacent allies; earns XP from healing.
  - _Notes:_ `src/game/Acolyte.ts` and `src/game/healing.ts`, `Acolyte_02` art. Staves are a third item kind (`kind: 'staff'`), not a weapon type, so a healer never attacks or counters; the Acolyte masters no weapon types. **Heal** (in the action menu after Attack for anyone carrying a staff) restores the staff's 2 power + MAG (5 at level 1) to a wounded adjacent ally, spends one of the staff's 20 uses, and earns a flat 10 XP. Deferred: the Acolyte has no skills yet, enemy AI doesn't heal (3.2), and the heal plays the potion glow rather than an animation of its own.
- [x] **Guard** (Knight) — Iron Spear, the tower-shield `Soldier_04` art, high defense, low movement and speed.
  - _Notes:_ `src/game/Guard.ts`. 12 HP, 4 STR, 1 SPD, 5 DEF, 0 RES, 4 MOV, so a level-1 soldier's spear deals it 0 while magic hits it in full. Learns **Shield Bash** (2 MP, range 1, +1 STR, no counter). Its slowness is only the MOV stat for now; the `armored` movement type comes with 2.4.
- [ ] **Beast Rider** (Pegasus Knight) — `BeastRider` art, flier, high resistance (needs 2.4).
- [ ] **Cavalier** — mounted (needs 2.4). The pack has no horse art, so this waits on art or is dropped.

### [ ] 2.4 Movement types

- `MOVEMENT_TYPES` table: `infantry`, `armored`, `mounted`, `flying` — each a terrain cost table passed to `getMovementRange`'s existing `terrainCosts`.
- Fliers cross water/mountains; mounted units pay more in forest; armored move slowly everywhere.
- Bows deal effective (×3 might) damage vs fliers — `effectiveAgainst` field on weapons.
- **Tests:** range per movement type over mixed terrain, effective damage.

### [ ] 2.5 Terrain bonuses

- `TERRAIN_BONUSES`: e.g. forest +20 avoid / +1 def, fort +20 avoid / +2 def / heals 20% at start of phase, throne similar. Fliers ignore terrain avoid.
- Combat formulas take the defender's (and attacker's) terrain.
- React `TerrainPanel.jsx` showing the terrain under the cursor and its bonuses.
- Start-of-phase healing for units on healing terrain.
- **Tests:** bonuses applied in hit/damage, flier exemption, phase-start healing clamps to max HP.

---

## Phase 3 — Strategy layer

### [x] 3.1 Enemy danger zone

- Toggle key (and button) to show the combined threat range of all enemies, using `getThreatRange` over each enemy's movement range and weapon range.
- Optionally per-enemy: selecting an enemy shows its move + attack range.
- **Tests:** combined threat merges ranges without duplicates; respects movement types and min range.
- _Deferred:_ movement types (2.4) aren't in yet; they'll flow in through each enemy's `MovementOptions` with no change to `dangerZone.ts`. The zone uses enemies' weapons only, not skills.

### [ ] 3.2 Smarter enemy AI

- AI behaviors per enemy: `rush` (current), `guard` (never moves, attacks in range — bosses), `wake` (stays put until a player enters its threat range, then rushes), `holdPosition` (moves only to attack).
- Target scoring instead of "first reachable": prefer kills, high expected damage, low counter damage, healers/mages; avoid suicidal attacks unless lethal. Pure `scoreAttack(forecast)`.
- Clerics heal wounded allies; enemies use potions when low.
- **Tests:** each behavior, scoring prefers lethal hits, no-target cases, guard never moves.
- _Progress:_ target scoring is in: `src/game/aiScoring.ts` has `scoreAttack(forecast)` (kills, expected damage, counter damage, soft targets, suicidal attacks), and `planRushAction` picks the best-scoring (tile, target) pair, falling back to the cheapest tile on ties. Still to do: the `guard`/`wake`/`holdPosition` behaviors (they need a field on `EnemyGroup`, which W.2 also edits), healing and potion use.

### [ ] 3.3 Objectives

- Level data declares an objective: `rout`, `seize` (Lord on a throne/gate tile), `boss` (defeat a named unit), `survive` (N turns), `defend` (no enemy on a tile for N turns).
- Pure `getBattleOutcome(state, objective)` generalizes the existing rout check. Loss conditions: Lord dies, or all units die.
- Objective shown in the HUD; Seize as a new action on the target tile.
- **Tests:** each objective's win/loss, Lord death overrides everything, turn-limit boundaries.
- _Progress:_ `src/game/objectives.ts` has the `Objective` type with `rout` only (the default for every level; a Warband region can set its own), and the Objective screen shows it after the opening dialog. The other objective kinds, `getBattleOutcome(state, objective)`, Lord death and the in-battle HUD readout are still to do.

### [ ] 3.4 Permadeath and difficulty modes

- Classic: dead units are removed from the roster. Casual: they return after battle.
- Lord death = game over in both.
- Mode chosen at new game.
- **Tests:** roster after battle in each mode.

### [ ] 3.5 More commands

- **Trade** (swap items with an adjacent ally, doesn't end turn), **Rescue/Drop** (carry an ally, halves stats), **Talk** (recruit an enemy via dialog), **Visit/Chest/Door** tiles.
- One command per sub-PR.

---

## Phase 4 — Campaign

### [ ] 4.1 Persistent roster and save/load

- A `campaign` state outside battles: roster (units with stats/XP/inventory), gold, progress. Pure (de)serialization; save to `localStorage` (wrapped in try/catch).
- Battles take units from the roster and write results back (XP, deaths, items used).
- Title screen: New Game / Continue.
- **Tests:** round-trip serialization, battle results merged into roster, corrupt save handling.

### [ ] 4.2 Battle preparation screen

- Before a battle: choose which roster units deploy (cap per map), manage inventories (convoy), view the map. Builds on the existing deployment phase.

### [ ] 4.3 Run structure (the "Rogue" part)

Decide between (or blend):

- **Roguelike run:** branching node map of battles, shops, recruit events, rest sites; random rewards; permadeath for the run; meta-unlocks between runs. Pure map generation with a seeded RNG.
- **Classic chapters:** linear list of hand-built maps with dialog between them (reuses `dialog.ts`).

Write a short design note in this file before building.

- _Decided:_ the roguelike run is **Warband Mode** (Phase W below): a linear run of generated stages with a reward pick and a camp between battles, permadeath for the run, and meta-unlocks between runs. No branching node map for now. Hand-built chapters stay as Story Mode.

### [ ] 4.4 Shops and gold

- Gold from battles; shop node/screen to buy weapons and items; sell.
- _Covered for Warband Mode by W.3 (gold) and W.4 (the camp's merchant)._ Story Mode can reuse the same shop rules.

### [ ] 4.5 Class promotion

- Promotion item at level 10+: advance to a stronger class (Soldier → General, Archer → Sniper, ...), stat bonuses, new weapon types, level resets to 1.
- _Warband Mode's version is W.7_ (promotion at camp, gaining or upgrading a trait). Build the promotion rules once and share them.

### [ ] 4.6 Supports (stretch)

- Units fighting adjacent build support points; conversations unlock; adjacent supported allies grant hit/avoid bonuses.

---

## Phase W — Warband Mode

Dungeon Mode becomes **Warband Mode**: the roguelike run. The name fits the art better (the tileset is fields, lakes, forests, villages, castles and ruins, so a band roaming the land, not a dungeon) and puts the mode's identity where roguelike tactics games keep it, in the band you recruit, grow and lose.

### Design note

- **Terms:** a run is made of **stages** ("Stage 3: Highlands"); the per-stage configs (today's floor configs) are **regions**; between battles the warband makes **camp**; a lost run is "the warband fell".
- **Run shape: linear.** Stage after stage, no branching node map. Every few stages a **region boss** closes the region and the run moves to the next region; beating the final region's boss **wins the run**, so runs can end in victory, not only in defeat.
- **The loop:**

  ```
  New run → pick a starting warband (meta-unlocks widen the choice)
    ┌─> Stage N battle (region map + objective)
    │     win → gold + reward pick (1 of 3)
    │     → Camp: merchant · hire · rest · promote · arrange deployment
    └──── next stage (every few stages: a region boss, then the next region)
  Final boss beaten → victory · roster empty → the warband fell
  Either way → renown for meta-progression
  ```

- **Pillars:** permadeath and carry-over; gold, merchants and recruitment; reward picks and relics; TFT-style set bonuses (**traits**); class upgrades; varied objectives and map events; meta-progression.
- **One modifier pipeline.** Traits, relics, elite enemies and (later) terrain bonuses are all _modifiers_ on the existing formulas, fed in as data through one pure module, so combat rules stay pure and testable and each new source of bonuses doesn't need its own plumbing.
- **Outside dependencies:** 2.3's classes are the big one. Recruits, traits and enemy variety are thin with only Villagers and Soldiers, so land classes before or alongside W.6. W.8 completes 3.3 and W.9 uses 3.5's commands. W.4 and W.7 cover 4.4 and 4.5 for this mode.

### [x] W.0 Rename Dungeon Mode to Warband Mode

- Title menu (`titleMenu.ts`) and every user-facing label; `BattleSetup`'s `'dungeon'` mode becomes `'warband'` with `stage` instead of `floor`; `describeBattle` reads "Stage 3: Highlands".
- The config editor's Dungeon Floors page becomes Regions (`DungeonConfigPage.tsx`, `configCatalog.ts`, `route.ts`); `src/data/dungeon.json` becomes `regions.json`, and `dungeonConfigFile.ts` keeps reading files in the old shape.
- Optionally move the mode's modules under `src/game/warband/`. Update `ARCHITECTURES.md` and `src/data/README.md`.
- **Tests:** existing dungeon tests renamed and passing; an old-shape settings file still parses.
- _Done:_ the modules live in `src/game/warband/` (`regions.ts`, `regionsFile.ts`, `stageLevel.ts`). An enemy group's spawn box is now `area` (it was `region`, which clashed with the new term); old files' `region` still reads. Uploads keep their old storage key so they still play.

### [x] W.1 Run state, carry-over and permadeath

- Pure `src/game/warband/run.ts`: `RunState = { seed, stage, roster, convoy, gold, relics, deployCap, fallen }`, with a `UnitSnapshot` (class, level, XP, stats, current HP, inventory) that round-trips to a `Unit`.
- `applyBattleResult(run, result)` writes XP and levels, HP, weapon uses, items used and deaths back to the roster; the fallen leave it for good.
- HP carries over between stages (resting at camp comes in W.4), so attrition is the tension.
- Each stage's seed is derived from the run seed (`createSeededRng`), so a run is reproducible.
- `createStageLevel(seed, region)` (`src/game/warband/stageLevel.ts`) takes the run's roster instead of `PLAYER_ROSTER`.
- The run is saved to `localStorage` (try/catch) so it survives a reload; a run-scoped slice of 4.1.
- Run-over and victory screens in React.
- **Tests:** snapshot round-trip, battle results merged (XP, level ups, HP, broken weapons, used items), deaths removed, an empty roster ends the run, the same seed gives the same stages, corrupt saves rejected.
- _Done:_ `src/game/warband/run.ts` holds the run (`RunState`, `UnitSnapshot`, `applyBattleResult`, `finishStage`, `getStageSeed`, `serializeRun` / `parseRun`), and `src/data/runSave.ts` keeps it in `localStorage`. Choosing Warband Mode starts a run with the three villagers, or, with one saved, offers Continue Run (Stage N) or New Run (W.1b reworks this menu). A stage fields the run's roster as it stands; winning writes the battle back and saves the next stage, and losing ends the run (even with units left on the bench) on a "The Warband Fell" result naming the stage and everyone lost. The run is saved as each stage starts, so leaving or reloading mid-battle replays that stage from its start. Mana carries over like HP. _Deferred:_ the victory screen, until W.2's region bosses give a run an end to win, and picking a starting warband (W.1b adds a class pick; W.10 widens the choice).

### [x] W.1b Warband menu and starting class

- Choosing Warband Mode always opens a menu: Continue Run (Stage N), disabled when nothing is saved, and New Run. There's still a single save slot.
- New Run picks the base class the warband starts as: Villager, Soldier or Archer (`src/game/warband/startingClasses.ts`), each with a one-line pitch. The starting warband is a single unit of that class, under a generated name (`src/game/warband/names.ts`) the player can reroll or type over; recruits come with W.3's rewards.
- Stage 1 (Meadowlands) is a quick first win for that lone unit: one soldier, wounded to 4 HP (an enemy group's `health`), exactly three steps from the deployment zone, so every starting class can reach and strike it on turn 1.
- The Villager is the late bloomer: a soldier's stat line but only fists, so it's the weakest start, with the highest growth total and caps of any class and a 150% XP rate (`scaleExperience` in `experience.ts`, a `Unit.experienceRate`), so it outgrows the others later in a run.
- **Tests:** the menu entries with and without a save, starting classes, a warband per class, XP scaling, the villager's growths and caps against the soldier's and archer's.
- _Deferred:_ mixed starting warbands (one pick plus fixed companions) and meta-unlocked starting classes (W.10). Promotion (W.7) could give the villager a further payoff.

### [ ] W.2 Enemy scaling and region bosses

- `EnemyGroup` (`enemySpawns.ts`) gains `class`, `level` (or a level offset from the stage), an optional `weapon`, and `boss`.
- Regions gain a stage-based enemy level curve and a boss stage that closes the region.
- **Elite** enemies: a few random modifiers (e.g. Armored +3 DEF, Swift +4 SPD, Vampiric), named on the unit panel. Ship as plain stat bumps here; move them onto the W.5 modifiers once those exist.
- **Tests:** levels per stage, boss placement, config validation of the new fields.

### [ ] W.3 Gold and reward picks

- Gold for kills and clearing a stage, with bonuses (no losses, a fast clear).
- After a win, pick **1 of 3** rewards: a recruit, a weapon or item, a relic (once W.5 lands) or gold. Pure `rollRewards(stage, rng, pools)`.
- A React reward screen between the battle result and the next stage.
- **Tests:** gold amounts, reward rolls with a stubbed RNG, no duplicate offers, pools that run dry.
- _Progress:_ `src/game/warband/rewards.ts` and the React `RewardScreen`. Every win pays gold (10 + 5 per stage, +10 flawless) and then offers 3 of: Recruit (a random non-villager class at the warband's average level; always offered while the warband is smaller than its deploy cap), Rest (full heal), Supplies (a Health Potion each), Training (+2 max HP each) and a gold purse. Stage 1's offers are instead a recruit of each starting class, so the lone starting unit picks its first companion. Offers are seeded from the run, so a stage always offers the same picks. _Still to do:_ gold for kills and a fast-clear bonus, weapon rewards, relics (W.5). Skip (+10 gold, +5 per stage) and Reroll (10 gold, +10 per reroll that stage) are in. _Known gap:_ the run is saved before the pick, so reloading on the reward screen skips the reward.

### [ ] W.4 Camp: merchant, hire, rest

- **Merchant:** buy and sell weapons and items, and buy promotion seals (W.7). Pure stock rolls and prices.
- **Bigger deploy cap** for gold (3 → 4 → 5 → 6 units), TFT's "level up". This is what drives the trait game in W.6.
- **Hire:** 2–3 mercenaries for sale, reroll for gold, like TFT's shop. A roster cap (e.g. 8) forces dismissals.
- **Rest:** a free partial heal, or a full heal for gold.
- **Interest:** +1 gold per 10 banked at each camp, capped, so saving is a strategy.
- **Tests:** buy and sell prices, can't overspend, deploy cap steps, rerolls, roster cap, interest math and cap, rest healing clamps to max HP.

### [ ] W.5 Modifier pipeline and relics

- Pure `src/game/modifiers.ts`: a `Modifier` is `{ source, target (a stat or formula term), amount, condition? }`, with conditions like "in forest", "when attacking", "start of phase".
- `combatStats.ts`, `combat.ts` and `turns.ts` take an optional `modifiers` input and apply it; the forecast shows the result.
- **Relics** are data, `{ id, name, description, modifiers }`, offered by W.3's rewards. Examples: +1 MOV for all, heal 2 HP at the start of the phase, the first strike each battle crits, +1 gold per kill, a higher interest cap.
- Move W.2's elite enemies onto modifiers.
- **Tests:** each condition, stacking, forecast matches resolution with modifiers, no modifiers equals today's numbers.

### [ ] W.6 Traits (set bonuses)

- Each class has 1–2 traits. A trait's bonus turns on when enough _deployed_ units share it (thresholds 2 / 3 / 4, small because deploy caps are small) and applies to the units with that trait for the whole battle, through W.5's modifiers.
- Pure `src/game/warband/traits.ts`: `getActiveTraits(deployedClasses)` gives the active tiers, and `getTraitModifiers(unit, active)` the modifiers they grant.
- Active traits show in the deployment banner and the unit panel, so deployment becomes a puzzle.
- A starting point, using the catalog art's classes (tune once they exist):

  | Trait    | Classes                   | (2)                    | (3+)                    |
  | -------- | ------------------------- | ---------------------- | ----------------------- |
  | Militia  | Villager, Soldier, Sapper | +1 DEF                 | +2 DEF, +10 avoid       |
  | Vanguard | Soldier, Vanguard         | +10 hit when attacking | strike first on counter |
  | Marksman | Archer, Siege             | +10 hit, +5 crit       | +1 max range            |
  | Arcane   | Elemental, Wizard         | +2 MAG                 | regain 1 MP per turn    |
  | Engineer | Sapper, Siege             | siege +2 might         | siege ignores half DEF  |

- Record each class's traits in `UNITS.md`.
- **Tests:** thresholds (one short, exact, over), units without the trait unaffected, undeployed units don't count, tier upgrades.

### [ ] W.7 Promotion and rally

- **Promotion** at camp: a level 10+ unit spends a seal to promote (Soldier → General, Archer → Sniper, ...), with stat bonuses and new weapon types, and the promoted class **gains or upgrades a trait**, tying upgrades into sets. Shares rules with 4.5.
- Optional **rally**: dismiss a unit to give another of its class XP or +1 to a stat, so spare recruits are worth something. Decide when building.
- **Tests:** promotion eligibility, stat bonuses and caps, traits after promotion, rally gains.

### [ ] W.8 Objective variety

- Stages pick an objective: rout, **boss** (the region finale), **seize** a castle or fort tile, **survive** N turns, or **escape** (every deployed unit reaches the north edge; the generator already carves a south-to-north path).
- Completes 3.3's `getBattleOutcome(state, objective)` and the HUD readout.
- **Tests:** each objective's win and loss, turn-limit boundaries, escape with units still on the map.

### [ ] W.9 Map events

- **Chests** (gold and items) and **villages** (recruit or heal) on the map, which enemy thieves race to.
- **On-map recruits:** a neutral unit to reach and Talk to before the enemy does (3.5's commands).
- **Reinforcements** from the map edges after turn N.
- **Fog of war** for some regions (e.g. Deep Woods). Last, since it touches rendering and the AI.
- One event per sub-PR is fine.
- **Tests:** chest and village placement on reachable tiles, reinforcement timing, fog visibility from unit vision ranges.

### [ ] W.10 Meta-progression

- **Renown** per run (stages cleared, bosses beaten, victory) unlocks starting warbands, starting relic choices, classes in the hire pool and new regions. Pure `src/game/warband/meta.ts`, saved to `localStorage` (try/catch).
- Keep unlocks horizontal (more options), not permanent stat boosts, so each run stays the challenge.
- **Tests:** renown per run outcome, unlock thresholds, save round-trip and corrupt saves.

---

## Polish backlog (pick up any time)

- Battle animation scene (cut-in when attacking), toggleable.
- Map-scroll and unit-move speed settings; skip enemy phase animations.
- Unit info screen (full stats, inventory, growths hidden) — done: press I on a unit (`UnitInfoScreen.tsx`).
- Turn-start "Player Phase"-style banners per objective.
- Sound effects and music.
- Undo last move (before acting) — partially exists via `unmarkMoved`.
