# ROADMAP.md

The plan for growing Rogue Emblem into a Fire Emblem–style tactics game, one small branch at a time. `ARCHITECTURES.md` describes what the system _is_; this file describes what we intend to build _next_.

## How to use this file

- Each milestone is sized to be **one branch / one PR**. Work them roughly in order — later milestones lean on earlier ones (dependencies are listed).
- Pick the first unchecked milestone, branch off `main` (e.g. `feature/counterattacks`), build it, and tick its box in the same PR.
- Every milestone follows the house rules in `AGENTS.md`: rules go in pure functions under `src/game/` with unit tests, Phaser stays a thin rendering layer, UI goes in React under `src/ui/` via the bridge store.
- Feel free to split, reorder, or rewrite milestones as we learn — this is a plan, not a contract. Note anything deferred under the milestone so it isn't lost.

## Where we are

Already built: grid and terrain move costs, movement range and arrow, player/enemy phases with win/loss, one-way attacks (`attack - defense`; counterattacks and FE-style stats since 1.1/1.2), skills with mana, consumable items, deployment, a rushing enemy AI, dialog, title/pause menus, and training mode. Phase 1 added counterattacks, hit/crit/doubling, the combat forecast, and XP with growth-rate level ups. There is still one class (Soldier) and no weapons.

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

### [ ] 2.1 Weapons

- Weapons as a new item kind: `{ id, label, type: 'sword'|'lance'|'axe'|'bow'|'tome'|'staff', might, hit, crit, weight, minRange, maxRange, uses, damageType }`.
- Unit inventory holds weapons and consumables; one weapon is **equipped** (first usable weapon by default). Attack range comes from the equipped weapon, replacing the fixed `range` stat.
- Formulas from 1.3 gain the weapon terms; attack speed = `speed - max(0, weight - strength)` (or constitution later).
- Weapon uses tick down per strike; a broken weapon is removed.
- "Attack" flow lets the player pick a weapon (weapon select menu) before targeting; the forecast updates per weapon.
- Starter weapons: Iron Sword/Lance/Axe, Iron Bow, Fire tome, Heal staff (staff usage comes in 2.3).
- **Tests:** equip rules, range from weapon, uses/breakage, weight penalty, forecast per weapon.

### [ ] 2.2 Weapon triangle

- Sword > Axe > Lance > Sword: advantage gives +15 hit and +1 damage, disadvantage the reverse. Magic/bows neutral (or a magic triangle later).
- Forecast shows advantage arrows.
- Pure `getTriangleModifier(attackerWeapon, defenderWeapon)`.
- **Tests:** every pairing, neutral cases, unarmed defender.

### [ ] 2.3 New classes

One class per sub-PR is fine. Each class: stat line, growth rates, weapon types it can use, movement type, sprite (load the `tileset` skill for art), skill tree entries.

- [ ] **Lord** — sword, the unit whose death loses the battle (used in 3.4).
- [ ] **Fighter** — axe, high HP/strength, low skill.
- [ ] **Archer** — bow, range 2 only (can't counter adjacent).
- [ ] **Mage** — tomes, magic damage vs resistance.
- [ ] **Cleric** — staff only: new **Heal** action targeting adjacent allies; earns XP from healing.
- [ ] **Knight** — lance, high defense, low movement and speed.
- [ ] **Pegasus Knight** — lance, flier, high resistance (needs 2.4).
- [ ] **Cavalier** — sword/lance, mounted (needs 2.4).

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

### [ ] 3.1 Enemy danger zone

- Toggle key (and button) to show the combined threat range of all enemies, using `getThreatRange` over each enemy's movement range and weapon range.
- Optionally per-enemy: selecting an enemy shows its move + attack range.
- **Tests:** combined threat merges ranges without duplicates; respects movement types and min range.

### [ ] 3.2 Smarter enemy AI

- AI behaviors per enemy: `rush` (current), `guard` (never moves, attacks in range — bosses), `wake` (stays put until a player enters its threat range, then rushes), `holdPosition` (moves only to attack).
- Target scoring instead of "first reachable": prefer kills, high expected damage, low counter damage, healers/mages; avoid suicidal attacks unless lethal. Pure `scoreAttack(forecast)`.
- Clerics heal wounded allies; enemies use potions when low.
- **Tests:** each behavior, scoring prefers lethal hits, no-target cases, guard never moves.

### [ ] 3.3 Objectives

- Level data declares an objective: `rout`, `seize` (Lord on a throne/gate tile), `boss` (defeat a named unit), `survive` (N turns), `defend` (no enemy on a tile for N turns).
- Pure `getBattleOutcome(state, objective)` generalizes the existing rout check. Loss conditions: Lord dies, or all units die.
- Objective shown in the HUD; Seize as a new action on the target tile.
- **Tests:** each objective's win/loss, Lord death overrides everything, turn-limit boundaries.

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

### [ ] 4.4 Shops and gold

- Gold from battles; shop node/screen to buy weapons and items; sell.

### [ ] 4.5 Class promotion

- Promotion item at level 10+: advance to a stronger class (Soldier → General, Archer → Sniper, ...), stat bonuses, new weapon types, level resets to 1.

### [ ] 4.6 Supports (stretch)

- Units fighting adjacent build support points; conversations unlock; adjacent supported allies grant hit/avoid bonuses.

---

## Polish backlog (pick up any time)

- Battle animation scene (cut-in when attacking), toggleable.
- Map-scroll and unit-move speed settings; skip enemy phase animations.
- Unit info screen (full stats, inventory, growths hidden).
- Turn-start "Player Phase"-style banners per objective.
- Sound effects and music.
- Undo last move (before acting) — partially exists via `unmarkMoved`.
