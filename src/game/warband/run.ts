// A Warband Mode run: the state carried from stage to stage. The roster is
// stored as plain UnitSnapshots (class, level, XP, stats, current HP,
// inventory) rather than Units, so a run can be saved as JSON and rebuilt
// later; restoreUnit turns a snapshot back into a Unit for a battle, and
// applyBattleResult writes what the battle did to the units back into the
// run. Units that die join `fallen` and never come back. Everything here is
// pure: each function returns a new frozen run and leaves its input alone.

import { HEAL_STAFF } from '../healing.ts';
import { applyModifiers } from '../modifiers.ts';
import { getBoonModifiers } from './boons.ts';
import { getRelicModifiers, hasRelic, PHOENIX_FEATHER } from './relics.ts';
import { EMPTY_CHRONICLE, parseChronicle, recordBattle, type RunChronicle } from './chronicle.ts';
import { ARMORS, HEALTH_POTION, MANA_POTION, type Inventory, type Item } from '../items.ts';
import { createSeededRng } from '../rng.ts';
import type { TomeProgress } from '../tomes.ts';
import type { RunRoute, RunSite } from './travel.ts';
import { createUnitOfClass, UNIT_CLASSES, type UnitClass } from '../unitClasses.ts';
import type { BattleOutcome } from '../turns.ts';
import type { Unit } from '../Unit.ts';
import { WEAPONS } from '../weapons.ts';

// How many units deploy to a stage at the start of a run.
export const STARTING_DEPLOY_CAP = 5;

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
// stored (movement, weapon types, growths, caps). `tomeProgress` is how far
// it is into learning each tome it has struck with (see tomes.ts), absent
// when it's learning none; `boons` the level-up boons it has taken (see
// boons.ts), absent when it has none.
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
  tomeProgress?: TomeProgress;
  boons?: readonly string[];
}

// A level-up boon pick still owed: the unit and the level it reached (see
// levelUpPicks.ts).
export interface PendingBoon {
  unitId: string;
  level: number;
}

// A wayside event still owed a choice (see events.ts).
export interface PendingEvent {
  id: string;
  depth: number;
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
  // The relics the warband holds, by id (see relics.ts), in the order won.
  relics: readonly string[];
  // How many units deploy to a stage.
  deployCap: number;
  // Units that died, as they were when they died: battle by battle, in
  // roster order within a battle.
  fallen: readonly UnitSnapshot[];
  // Set while a won stage's reward is still to be picked, so a run saved
  // on the reward screen reopens there (see rewards.ts) rather than
  // skipping the pick.
  pendingReward?: PendingReward;
  // Cleared stage awaiting a separate recruitment choice.
  pendingRecruitment?: number;
  pendingGuest?: UnitSnapshot;
  // Where a run that travels a realm has been and is (see travel.ts);
  // absent on a run that fights stage after stage.
  route?: RunRoute;
  // The wayside event the run stands at and still owes a choice (see
  // events.ts): its id and the site's depth, which seeds its dice.
  pendingEvent?: PendingEvent;
  // The wayside events the run has met, by id, so it meets new ones.
  seenEvents?: readonly string[];
  // Level-up boon picks still owed, oldest first (see levelUpPicks.ts), so
  // a run saved before them reopens on them; absent when none are.
  pendingBoons?: readonly PendingBoon[];
  // What has happened over the run, for its recap (chronicle.ts). Absent
  // in runs saved before it was kept, which read as an empty one.
  chronicle?: RunChronicle;
}

// A reward pick still owed after a won stage: the stage cleared, how many
// times its offers have been rerolled (the offers are rolled again from
// these), and the clear's gold and whether it was flawless, for showing.
export interface PendingReward {
  stage: number;
  rerolls: number;
  clearGold: number;
  flawless: boolean;
}

// What a battle hands back: every unit that fought, by unitId, as it ended
// the battle (dead ones with 0 health). Units that aren't on the roster
// (enemies) are ignored, and roster units that didn't deploy are absent.
// `convoy` is what the battle sent to the convoy (loot a full-handed unit
// couldn't carry), if anything. `kills` (enemies felled by unitId),
// `bossDefeated` and `elapsedMs` (how long the battle took) go into the
// run's chronicle.
export interface BattleResult {
  units: ReadonlyMap<string, Unit>;
  convoy?: readonly ItemSnapshot[];
  kills?: ReadonlyMap<string, number>;
  bossDefeated?: boolean;
  elapsedMs?: number;
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
    chronicle: EMPTY_CHRONICLE,
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
    ...(Object.keys(unit.tomeProgress).length > 0 && { tomeProgress: unit.tomeProgress }),
    ...(unit.boons.length > 0 && { boons: unit.boons }),
  });
}

// A player Unit rebuilt from `snapshot`: its class's unit with the
// snapshot's name, level, XP, stats, inventory, tome progress and boons,
// carrying its boons' modifiers (see applyModifiers). Throws on an unknown
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
  unit.tomeProgress = Object.freeze({ ...snapshot.tomeProgress });
  unit.boons = Object.freeze([...(snapshot.boons ?? [])]);
  return applyModifiers(unit, getBoonModifiers(unit.boons));
}

// The run's roster as Units by unitId, ready to put in a battle, each
// carrying the run's relics' modifiers on top of its boons'.
export function restoreRoster(
  run: RunState,
  classes?: readonly UnitClass[],
  items?: readonly Item[],
): Map<string, Unit> {
  const relics = getRelicModifiers(run.relics);
  return new Map(
    run.roster.map((snapshot) => [snapshot.id, applyModifiers(restoreUnit(snapshot, classes, items), relics)]),
  );
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
// `fallen` (except that with the Phoenix Feather the first of them, in
// roster order, stays on at 1 HP instead, and the feather is spent).
// Undeployed units are unchanged. Items the battle sent to the convoy join
// the end of it, and the battle goes into the chronicle. The stage doesn't
// advance (see advanceStage).
export function applyBattleResult(run: RunState, result: BattleResult): RunState {
  const roster: UnitSnapshot[] = [];
  const fallen = [...run.fallen];
  const fought: string[] = [];
  const fell: string[] = [];
  let relics = run.relics;
  for (const snapshot of run.roster) {
    const unit = result.units.get(snapshot.id);
    if (!unit) {
      roster.push(snapshot);
      continue;
    }
    const after = snapshotUnit(snapshot.id, unit);
    fought.push(snapshot.id);
    if (unit.isAlive()) roster.push(after);
    else if (hasRelic({ relics }, PHOENIX_FEATHER)) {
      relics = relics.filter((id) => id !== PHOENIX_FEATHER.id);
      roster.push({ ...after, health: 1 });
    } else {
      fallen.push(after);
      fell.push(snapshot.id);
    }
  }
  const chronicle = recordBattle(run.chronicle ?? EMPTY_CHRONICLE, {
    stage: run.stage,
    kills: result.kills ?? new Map(),
    unitIds: fought,
    fallenIds: fell,
    bossDefeated: result.bossDefeated ?? false,
    elapsedMs: result.elapsedMs ?? 0,
  });
  return freezeRun({ ...run, roster, fallen, relics, convoy: [...run.convoy, ...(result.convoy ?? [])], chronicle });
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
// roster; `over` says so. A victory on `finalStage` (or later) wins the
// run: it's over too, staying on that stage, and `won` says so.
export function finishStage(
  run: RunState,
  result: BattleResult,
  outcome: BattleOutcome,
  finalStage?: number,
): { run: RunState; over: boolean; won: boolean } {
  const after = applyBattleResult(run, result);
  if (outcome === 'defeat' || isRunOver(after)) return { run: after, over: true, won: false };
  if (finalStage !== undefined && run.stage >= finalStage) return { run: after, over: true, won: true };
  return { run: advanceStage(after), over: false, won: false };
}

// The map seed for `stage` of a run started with `runSeed`: always the same
// for the same pair, and different from stage to stage.
export function getStageSeed(runSeed: number, stage: number): number {
  const rng = createSeededRng((runSeed ^ Math.imul(stage, 0x9e3779b9)) >>> 0);
  return Math.floor(rng() * 2 ** 32);
}

// The seed the dice of `stage`'s battle roll from, for a run started with
// `runSeed`: fixed per pair (and apart from the map's, getStageSeed), so a
// whole run replays from its seed, and a stage fought again rolls the same.
export function getBattleSeed(runSeed: number, stage: number): number {
  const rng = createSeededRng((runSeed ^ Math.imul(stage + 0x2545, 0xc2b2ae35)) >>> 0);
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
  const {
    seed,
    stage,
    roster,
    convoy,
    gold,
    relics,
    deployCap,
    fallen,
    pendingReward,
    pendingRecruitment,
    pendingGuest,
    route,
    pendingEvent,
    seenEvents,
    pendingBoons,
    chronicle,
  } = data;
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
    !isUnits(fallen) ||
    (pendingReward !== undefined && !isPendingReward(pendingReward)) ||
    (pendingRecruitment !== undefined && (!isWholeNumber(pendingRecruitment) || pendingRecruitment < 1)) ||
    (pendingGuest !== undefined && !isUnitSnapshot(pendingGuest, classIds, isItems)) ||
    (pendingGuest === undefined) !== (pendingRecruitment === undefined) ||
    (route !== undefined && !isRunRoute(route)) ||
    (pendingEvent !== undefined && !isPendingEvent(pendingEvent)) ||
    (seenEvents !== undefined && !(Array.isArray(seenEvents) && seenEvents.every((id) => typeof id === 'string'))) ||
    (pendingBoons !== undefined && !isPendingBoons(pendingBoons)) ||
    (chronicle !== undefined && parseChronicle(chronicle) === null)
  ) {
    return null;
  }
  if (new Set(roster.map((unit) => unit.id)).size !== roster.length) return null;
  return freezeRun({
    seed,
    stage,
    roster,
    convoy,
    gold,
    relics,
    deployCap,
    fallen,
    ...(pendingReward !== undefined && { pendingReward }),
    ...(pendingRecruitment !== undefined && { pendingRecruitment }),
    ...(pendingGuest !== undefined && { pendingGuest }),
    ...(pendingBoons !== undefined && { pendingBoons }),
    chronicle: chronicle === undefined ? EMPTY_CHRONICLE : parseChronicle(chronicle)!,
    ...(route !== undefined && { route }),
    ...(pendingEvent !== undefined && { pendingEvent }),
    ...(seenEvents !== undefined && { seenEvents }),
  });
}

const SITE_KINDS = new Set(['home', 'battle', 'village', 'fort', 'elite', 'town', 'shrine', 'event', 'hold']);

function isRunRoute(value: unknown): value is RunRoute {
  return (
    isRecord(value) &&
    Array.isArray(value.visited) &&
    value.visited.length > 0 &&
    value.visited.every((id) => typeof id === 'string') &&
    (value.at === undefined || isRunSite(value.at))
  );
}

function isRunSite(value: unknown): value is RunSite {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.kind === 'string' &&
    SITE_KINDS.has(value.kind) &&
    isWholeNumber(value.depth) &&
    isWholeNumber(value.region) &&
    Number.isInteger(value.levelOffset)
  );
}

function isPendingEvent(value: unknown): value is PendingEvent {
  return isRecord(value) && typeof value.id === 'string' && isWholeNumber(value.depth);
}

function isPendingBoons(value: unknown): value is PendingBoon[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) => isRecord(entry) && typeof entry.unitId === 'string' && isWholeNumber(entry.level) && entry.level >= 1,
    )
  );
}

function isPendingReward(value: unknown): value is PendingReward {
  return (
    isRecord(value) &&
    isWholeNumber(value.stage) &&
    (value.stage as number) >= 1 &&
    isWholeNumber(value.rerolls) &&
    isWholeNumber(value.clearGold) &&
    typeof value.flawless === 'boolean'
  );
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
    isItems(value.items) &&
    (value.tomeProgress === undefined || isTomeProgress(value.tomeProgress)) &&
    (value.boons === undefined || (Array.isArray(value.boons) && value.boons.every((boon) => typeof boon === 'string')))
  );
}

function isTomeProgress(value: unknown): value is TomeProgress {
  return isRecord(value) && Object.values(value).every(isWholeNumber);
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
  const { tomeProgress, boons } = snapshot;
  return Object.freeze({
    ...snapshot,
    items: freezeItems(snapshot.items),
    ...(tomeProgress && { tomeProgress: Object.freeze({ ...tomeProgress }) }),
    ...(boons && { boons: Object.freeze([...boons]) }),
  });
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
    ...(run.pendingReward && { pendingReward: Object.freeze({ ...run.pendingReward }) }),
    ...(run.pendingGuest && { pendingGuest: freezeSnapshot(run.pendingGuest) }),
    ...(run.route && {
      route: Object.freeze({
        visited: Object.freeze([...run.route.visited]),
        ...(run.route.at && { at: Object.freeze({ ...run.route.at }) }),
      }),
    }),
    ...(run.pendingEvent && { pendingEvent: Object.freeze({ ...run.pendingEvent }) }),
    ...(run.seenEvents && { seenEvents: Object.freeze([...run.seenEvents]) }),
    ...(run.pendingBoons && {
      pendingBoons: Object.freeze(run.pendingBoons.map((pending) => Object.freeze({ ...pending }))),
    }),
  });
}
