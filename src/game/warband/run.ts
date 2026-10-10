// A Warband Mode run: the state carried from stage to stage. The roster is
// stored as plain UnitSnapshots (class, level, XP, stats, current HP,
// inventory) rather than Units, so a run can be saved as JSON and rebuilt
// later; restoreUnit turns a snapshot back into a Unit for a battle, and
// applyBattleResult writes what the battle did to the units back into the
// run. Units that die join `fallen` and never come back. Everything here is
// pure: each function returns a new frozen run and leaves its input alone.

import { HEAL_STAFF } from '../healing.ts';
import { ARMORS, HEALTH_POTION, MANA_POTION, type Inventory, type Item } from '../items.ts';
import { createSeededRng } from '../rng.ts';
import { createUnitOfClass, UNIT_CLASSES, type UnitClass } from '../unitClasses.ts';
import type { BattleOutcome } from '../turns.ts';
import type { Unit } from '../Unit.ts';
import { WEAPONS } from '../weapons.ts';

// How many units deploy to a stage at the start of a run.
export const STARTING_DEPLOY_CAP = 3;

// Every item a saved inventory can name, by id.
export const RUN_ITEMS: readonly Item[] = Object.freeze([
  ...WEAPONS,
  ...ARMORS,
  HEAL_STAFF,
  HEALTH_POTION,
  MANA_POTION,
]);

// An inventory entry by item id: a weapon's quantity is its uses left.
export interface ItemSnapshot {
  itemId: string;
  quantity: number;
}

// A player unit between battles. `id` is its unitId in every battle of the
// run; `classId` is one of UNIT_CLASSES' ids, which supplies what isn't
// stored (movement, weapon types, growths, caps).
export interface UnitSnapshot {
  id: string;
  name: string;
  classId: string;
  level: number;
  experience: number;
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  strength: number;
  magic: number;
  skill: number;
  speed: number;
  luck: number;
  defense: number;
  resistance: number;
  items: readonly ItemSnapshot[];
}

export interface RunState {
  // The run's seed: each stage's map seed comes from it (getStageSeed).
  seed: number;
  // The stage being fought next, from 1.
  stage: number;
  // The living units, in roster order.
  roster: readonly UnitSnapshot[];
  // Items held for the warband rather than by a unit.
  convoy: readonly ItemSnapshot[];
  gold: number;
  // Relic ids (relics arrive with W.5).
  relics: readonly string[];
  // How many units deploy to a stage.
  deployCap: number;
  // Units that died, as they were when they died: battle by battle, in
  // roster order within a battle.
  fallen: readonly UnitSnapshot[];
}

// What a battle hands back: every unit that fought, by unitId, as it ended
// the battle (dead ones with 0 health). Units that aren't on the roster
// (enemies) are ignored, and roster units that didn't deploy are absent.
// `convoy` is what the battle sent to the convoy (loot a full-handed unit
// couldn't carry), if anything.
export interface BattleResult {
  units: ReadonlyMap<string, Unit>;
  convoy?: readonly ItemSnapshot[];
}

// The stats a snapshot stores besides its identity and inventory.
const STAT_FIELDS = Object.freeze([
  'level',
  'experience',
  'health',
  'maxHealth',
  'mana',
  'maxMana',
  'strength',
  'magic',
  'skill',
  'speed',
  'luck',
  'defense',
  'resistance',
] as const);

type StatField = (typeof STAT_FIELDS)[number];

// A new run on stage 1 with `roster` (fresh or restored units by unitId),
// no gold, convoy or relics, and the starting deploy cap.
export function createRun(seed: number, roster: ReadonlyMap<string, Unit>): RunState {
  return freezeRun({
    seed,
    stage: 1,
    roster: [...roster].map(([id, unit]) => snapshotUnit(id, unit)),
    convoy: [],
    gold: 0,
    relics: [],
    deployCap: STARTING_DEPLOY_CAP,
    fallen: [],
  });
}

// The snapshot of `unit` under unitId `id`. Throws if it has no class,
// since a snapshot is rebuilt from its class.
export function snapshotUnit(id: string, unit: Unit): UnitSnapshot {
  if (!unit.unitClass) throw new Error(`${unit.name} has no class to snapshot`);
  const stats = Object.fromEntries(STAT_FIELDS.map((field) => [field, unit[field]])) as Record<StatField, number>;
  return freezeSnapshot({
    id,
    name: unit.name,
    classId: unit.unitClass,
    ...stats,
    items: unit.items.map(({ item, quantity }) => ({ itemId: item.id, quantity })),
  });
}

// A player Unit rebuilt from `snapshot`: its class's unit with the
// snapshot's name, level, XP, stats and inventory. Throws on an unknown
// class or item.
export function restoreUnit(
  snapshot: UnitSnapshot,
  classes: readonly UnitClass[] = UNIT_CLASSES,
  items: readonly Item[] = RUN_ITEMS,
): Unit {
  const unit = createUnitOfClass(
    snapshot.classId,
    { name: snapshot.name, team: 'player', level: snapshot.level, items: restoreInventory(snapshot.items, items) },
    classes,
  );
  for (const field of STAT_FIELDS) unit[field] = snapshot[field];
  return unit;
}

// The run's roster as Units by unitId, ready to put in a battle.
export function restoreRoster(
  run: RunState,
  classes?: readonly UnitClass[],
  items?: readonly Item[],
): Map<string, Unit> {
  return new Map(run.roster.map((snapshot) => [snapshot.id, restoreUnit(snapshot, classes, items)]));
}

// Inventory entries for item snapshots, looking each id up in `items`.
// Throws on an unknown id.
export function restoreInventory(snapshots: readonly ItemSnapshot[], items: readonly Item[] = RUN_ITEMS): Inventory {
  return snapshots.map(({ itemId, quantity }) => {
    const item = items.find((candidate) => candidate.id === itemId);
    if (!item) throw new Error(`Unknown item: ${itemId}`);
    return { item, quantity };
  });
}

// The run after a battle: each roster unit in result.units has its XP,
// levels, stats, HP and inventory (spent weapon uses, broken weapons,
// used items) written back, and those that died move from the roster to
// `fallen`. Undeployed units are unchanged. Items the battle sent to the
// convoy join the end of it. The stage doesn't advance (see advanceStage).
export function applyBattleResult(run: RunState, result: BattleResult): RunState {
  const roster: UnitSnapshot[] = [];
  const fallen = [...run.fallen];
  for (const snapshot of run.roster) {
    const unit = result.units.get(snapshot.id);
    if (!unit) {
      roster.push(snapshot);
      continue;
    }
    const after = snapshotUnit(snapshot.id, unit);
    if (unit.isAlive()) roster.push(after);
    else fallen.push(after);
  }
  return freezeRun({ ...run, roster, fallen, convoy: [...run.convoy, ...(result.convoy ?? [])] });
}

// The run moved on to its next stage.
export function advanceStage(run: RunState): RunState {
  return freezeRun({ ...run, stage: run.stage + 1 });
}

// Whether the warband has fallen: nobody is left on the roster.
export function isRunOver(run: RunState): boolean {
  return run.roster.length === 0;
}

// The run after a stage's battle ends with `outcome`: the battle's result
// written back (applyBattleResult), then on a victory the next stage. A
// defeat ends the run, as does a victory that somehow leaves nobody on the
// roster; `over` says so.
export function finishStage(
  run: RunState,
  result: BattleResult,
  outcome: BattleOutcome,
): { run: RunState; over: boolean } {
  const after = applyBattleResult(run, result);
  if (outcome === 'defeat' || isRunOver(after)) return { run: after, over: true };
  return { run: advanceStage(after), over: false };
}

// The map seed for `stage` of a run started with `runSeed`: always the same
// for the same pair, and different from stage to stage.
export function getStageSeed(runSeed: number, stage: number): number {
  const rng = createSeededRng((runSeed ^ Math.imul(stage, 0x9e3779b9)) >>> 0);
  return Math.floor(rng() * 2 ** 32);
}

// The run as JSON, for saving.
export function serializeRun(run: RunState): string {
  return JSON.stringify(run);
}

// The run in `text` (from serializeRun), or null if it isn't valid JSON of
// a run, or names a class or item that doesn't exist (e.g. a save from an
// older version).
export function parseRun(
  text: string,
  classes: readonly UnitClass[] = UNIT_CLASSES,
  items: readonly Item[] = RUN_ITEMS,
): RunState | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(data)) return null;
  const { seed, stage, roster, convoy, gold, relics, deployCap, fallen } = data;
  const itemIds = new Set(items.map((item) => item.id));
  const classIds = new Set(classes.map((unitClass) => unitClass.id));
  const isItems = (value: unknown): value is ItemSnapshot[] =>
    Array.isArray(value) && value.every((entry) => isItemSnapshot(entry, itemIds));
  const isUnits = (value: unknown): value is UnitSnapshot[] =>
    Array.isArray(value) && value.every((entry) => isUnitSnapshot(entry, classIds, isItems));
  if (
    !isWholeNumber(seed) ||
    !isWholeNumber(stage) ||
    stage < 1 ||
    !isUnits(roster) ||
    !isItems(convoy) ||
    !isWholeNumber(gold) ||
    !Array.isArray(relics) ||
    !relics.every((relic) => typeof relic === 'string') ||
    !isWholeNumber(deployCap) ||
    deployCap < 1 ||
    !isUnits(fallen)
  ) {
    return null;
  }
  if (new Set(roster.map((unit) => unit.id)).size !== roster.length) return null;
  return freezeRun({ seed, stage, roster, convoy, gold, relics, deployCap, fallen });
}

function isUnitSnapshot(
  value: unknown,
  classIds: ReadonlySet<string>,
  isItems: (value: unknown) => value is ItemSnapshot[],
): value is UnitSnapshot {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.classId === 'string' &&
    classIds.has(value.classId) &&
    STAT_FIELDS.every((field) => isWholeNumber(value[field])) &&
    (value.level as number) >= 1 &&
    (value.health as number) <= (value.maxHealth as number) &&
    (value.mana as number) <= (value.maxMana as number) &&
    isItems(value.items)
  );
}

function isItemSnapshot(value: unknown, itemIds: ReadonlySet<string>): value is ItemSnapshot {
  return (
    isRecord(value) &&
    typeof value.itemId === 'string' &&
    itemIds.has(value.itemId) &&
    isWholeNumber(value.quantity) &&
    value.quantity > 0
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isWholeNumber(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function freezeSnapshot(snapshot: UnitSnapshot): UnitSnapshot {
  return Object.freeze({ ...snapshot, items: freezeItems(snapshot.items) });
}

function freezeItems(items: readonly ItemSnapshot[]): readonly ItemSnapshot[] {
  return Object.freeze(items.map(({ itemId, quantity }) => Object.freeze({ itemId, quantity })));
}

function freezeRun(run: RunState): RunState {
  return Object.freeze({
    ...run,
    roster: Object.freeze(run.roster.map(freezeSnapshot)),
    convoy: freezeItems(run.convoy),
    relics: Object.freeze([...run.relics]),
    fallen: Object.freeze(run.fallen.map(freezeSnapshot)),
  });
}
