// A Warband Mode run: the state carried from stage to stage. The roster is
// stored as plain UnitSnapshots (class, level, XP, stats, current HP,
// inventory) rather than Units, so a run can be saved as JSON and rebuilt
// later; restoreUnit turns a snapshot back into a Unit for a battle, and
// applyBattleResult writes what the battle did to the units back into the
// run. Units that die join `fallen` and never come back. Everything here is
// pure: each function returns a new frozen run and leaves its input alone.

import { GROWTH_STATS, type GrowthStat } from '../experience.ts';
import { HEAL_STAFF } from '../healing.ts';
import { applyModifiers } from '../modifiers.ts';
import { getBoonModifiers } from './boons.ts';
import { getEvolutions } from './evolutions.ts';
import { getQuirkModifiers } from './quirks.ts';
import { growUpWhelp } from './whelp.ts';
import { getRelicModifiers, hasRelic, PHOENIX_FEATHER } from './relics.ts';
import { findKeystone } from './keystones.ts';
import { MAX_HEAT } from './heat.ts';
import { EMPTY_CHRONICLE, parseChronicle, recordBattle, type RunChronicle } from './chronicle.ts';
import {
  ARMORS,
  HEALTH_POTION,
  MANA_POTION,
  MASTER_SEAL,
  type Inventory,
  type InventoryEntry,
  type Item,
} from '../items.ts';
import { createLoadout, getGearLayout, type Equipment, type Gear, type GearSlot } from '../equipment.ts';
import { createSeededRng } from '../rng.ts';
import type { TomeProgress } from '../tomes.ts';
import type { RunRoute, RunSite } from './travel.ts';
import { createUnitOfClass, UNIT_CLASSES, type UnitClass } from '../unitClasses.ts';
import type { BattleOutcome } from '../turns.ts';
import type { Unit } from '../Unit.ts';
import { WEAPONS, type Weapon } from '../weapons.ts';
import { SIGNATURE_GEAR } from '../gearKits.ts';

// How many units deploy to a stage at the start of a run.
export const STARTING_DEPLOY_CAP = 5;

// Every item a saved inventory can name, by id.
export const RUN_ITEMS: readonly Item[] = Object.freeze([
  ...WEAPONS,
  ...ARMORS,
  ...SIGNATURE_GEAR,
  HEAL_STAFF,
  HEALTH_POTION,
  MANA_POTION,
  MASTER_SEAL,
]);

// An inventory entry by item id: how many of it (always 1 for gear).
export interface ItemSnapshot {
  itemId: string;
  quantity: number;
}

// A player unit between battles. `id` is its unitId in every battle of the
// run; `classId` is one of UNIT_CLASSES' ids, which supplies what isn't
// stored (movement, weapon types, growths). `tomeProgress` is how far
// it is into learning each tome it has struck with (see tomes.ts), absent
// when it's learning none; `boons` the level-up boons it has taken (see
// boons.ts), absent when it has none; `quirk` the quirk it joined with (see
// quirks.ts), absent when it has none; `secondaryClass` the class whose
// skill set it has learned at camp (see mentors.ts), absent when none.
// `items` is its bag (consumables), `equipment` the gear it wears by slot
// and `innate` its innate attacks (fists, natural weapons, spells it
// knows), by item id. A snapshot without `equipment` is from before
// equipment slots: its `items` lists everything it carried, sorted into
// slots by getSnapshotLoadout (normalizeSnapshot moves what doesn't fit to
// the convoy when such a run loads).
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
  intelligence: number;
  dexterity: number;
  speed: number;
  luck: number;
  defense: number;
  resistance: number;
  items: readonly ItemSnapshot[];
  equipment?: EquipmentSnapshot;
  innate?: readonly string[];
  tomeProgress?: TomeProgress;
  boons?: readonly string[];
  quirk?: string;
  secondaryClass?: string;
}

// The gear a unit wears, by slot, as item ids.
export type EquipmentSnapshot = Readonly<Partial<Record<GearSlot, string>>>;

// A level-up boon pick still owed: the unit, the level it reached, and any
// stat gains that level up rolled (see levelUpPicks.ts).
export interface PendingBoon {
  unitId: string;
  level: number;
  // The stage the level was reached at, which the offer grows with (the
  // run's current stage when absent).
  stage?: number;
  gains?: Partial<Record<GrowthStat, number>>;
  // How many times its offer has been rerolled (0 when absent), which it
  // rolls from.
  roll?: number;
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
  // The keystone the warband holds, by id (see keystones.ts), if any.
  keystone?: string;
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
  // Set while a Recruit reward's draft (recruitment.ts) is still to be
  // picked: the stage whose reward it was, which its candidates roll from.
  pendingDraft?: number;
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
  // Mentor's Scrolls held, each a free lesson at camp in any class's skill
  // set (see mentors.ts); absent when none are.
  scrolls?: number;
  // The origin the run started as (see origins.ts); absent in runs saved
  // before origins, which started as a lone unit of their class.
  origin?: string;
  // The Heat level it's played at (see heat.ts); absent at no Heat.
  heat?: number;
  // Boons banished from the run's level-up offers, by boon id (see
  // levelUpPicks.ts); absent when none are.
  banishedBoons?: readonly string[];
  // The last stage whose battle's free level-up reroll was spent (see
  // getBoonRedraws); absent when none has been.
  boonRerollStage?: number;
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
  // The level-up boon picks units already took during the battle (see
  // levelUpPicks.ts), so the run doesn't owe them again.
  boonsTaken?: readonly { unitId: string; level: number }[];
  // Whether a level-up pick in the battle spent the stage's free reroll,
  // and the boons banished in it (see levelUpPicks.ts).
  boonRerolled?: boolean;
  banishedBoons?: readonly string[];
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
  'intelligence',
  'dexterity',
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
// since a snapshot is rebuilt from its class. A whelp that has come of age
// is saved grown into a Beast (see whelp.ts).
export function snapshotUnit(id: string, unit: Unit): UnitSnapshot {
  if (!unit.unitClass) throw new Error(`${unit.name} has no class to snapshot`);
  const stats = Object.fromEntries(STAT_FIELDS.map((field) => [field, unit[field]])) as Record<StatField, number>;
  return growUpWhelp(
    freezeSnapshot({
      id,
      name: unit.name,
      classId: unit.unitClass,
      ...stats,
      items: unit.items.map(({ item, quantity }) => ({ itemId: item.id, quantity })),
      equipment: snapshotEquipment(unit.equipment),
      innate: unit.innate.map((weapon) => weapon.id),
      ...(Object.keys(unit.tomeProgress).length > 0 && { tomeProgress: unit.tomeProgress }),
      ...(unit.boons.length > 0 && { boons: unit.boons }),
      ...(unit.quirk && { quirk: unit.quirk }),
      ...(unit.secondaryClass !== null && { secondaryClass: unit.secondaryClass }),
    }),
  );
}

// A player Unit rebuilt from `snapshot`: its class's unit with the
// snapshot's name, level, XP, stats, inventory, tome progress, boons,
// quirk and secondary class, carrying the boons' and quirk's modifiers
// (see applyModifiers). Throws on an unknown class or item.
export function restoreUnit(
  snapshot: UnitSnapshot,
  classes: readonly UnitClass[] = UNIT_CLASSES,
  items: readonly Item[] = RUN_ITEMS,
): Unit {
  const unit = createUnitOfClass(
    snapshot.classId,
    { name: snapshot.name, team: 'player', level: snapshot.level },
    classes,
  );
  const loadout = getSnapshotLoadout(snapshot, items);
  unit.items = loadout.bag;
  unit.equipment = loadout.equipment;
  if (loadout.innate) unit.innate = loadout.innate;
  for (const field of STAT_FIELDS) unit[field] = snapshot[field];
  unit.tomeProgress = Object.freeze({ ...snapshot.tomeProgress });
  unit.boons = Object.freeze([...(snapshot.boons ?? [])]);
  unit.quirk = snapshot.quirk ?? null;
  unit.secondaryClass = snapshot.secondaryClass ?? null;
  return applyModifiers(unit, [...getBoonModifiers(unit.boons), ...getQuirkModifiers(unit.quirk)]);
}

// The run's roster as Units by unitId, ready to put in a battle, each
// carrying the run's relics' modifiers and its evolutions' (evolutions.ts)
// on top of its boons', and the keystone's modifiers and curses
// (keystones.ts; its curses are shared, so they fall once a battle).
export function restoreRoster(
  run: RunState,
  classes?: readonly UnitClass[],
  items?: readonly Item[],
): Map<string, Unit> {
  const relics = getRelicModifiers(run.relics, run.stage);
  const keystone = findKeystone(run.keystone);
  return new Map(
    run.roster.map((snapshot) => {
      const evolutions = getEvolutions(snapshot, run.relics);
      const unit = restoreUnit(snapshot, classes, items);
      unit.evolutions = Object.freeze(evolutions.map(({ id }) => id));
      if (keystone) unit.curses = Object.freeze([...unit.curses, ...keystone.curses]);
      return [
        snapshot.id,
        applyModifiers(unit, [
          ...relics,
          ...evolutions.flatMap(({ modifiers }) => modifiers),
          ...(keystone?.modifiers ?? []),
        ]),
      ];
    }),
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

// A snapshot's gear sorted out: its equipment, bag and innate attacks
// (null when the snapshot doesn't say, leaving its class's), and `spare`,
// what an old snapshot carried that has no place now (see createLoadout).
// Throws on an unknown item.
export function getSnapshotLoadout(
  snapshot: Pick<UnitSnapshot, 'classId' | 'items' | 'equipment' | 'innate'>,
  items: readonly Item[] = RUN_ITEMS,
): { equipment: Equipment; bag: Inventory; innate: readonly Weapon[] | null; spare: readonly InventoryEntry[] } {
  const carried = restoreInventory(snapshot.items, items);
  if (!snapshot.equipment) {
    const loadout = createLoadout(carried, getGearLayout(snapshot.classId), snapshot.classId);
    return { ...loadout, innate: loadout.innate.length > 0 ? loadout.innate : null };
  }
  const equipment = Object.freeze(
    Object.fromEntries(
      Object.entries(snapshot.equipment).map(([slot, itemId]) => [slot, lookUp(itemId as string, items) as Gear]),
    ),
  );
  const innate = snapshot.innate
    ? Object.freeze(snapshot.innate.map((itemId) => lookUp(itemId, items) as Weapon))
    : null;
  return { equipment, bag: carried, innate, spare: [] };
}

// A snapshot in the equipment-slot shape: an old one's carried items
// sorted into equipment, innate attacks and bag, with `spare` the entries
// that had no place (for the convoy). A current one comes back as it is.
export function normalizeSnapshot(
  snapshot: UnitSnapshot,
  items: readonly Item[] = RUN_ITEMS,
): { snapshot: UnitSnapshot; spare: readonly ItemSnapshot[] } {
  if (snapshot.equipment) return { snapshot, spare: [] };
  const loadout = getSnapshotLoadout(snapshot, items);
  return {
    snapshot: freezeSnapshot({
      ...snapshot,
      items: loadout.bag.map(({ item, quantity }) => ({ itemId: item.id, quantity })),
      equipment: snapshotEquipment(loadout.equipment),
      ...(loadout.innate && { innate: loadout.innate.map((weapon) => weapon.id) }),
    }),
    spare: loadout.spare.map(({ item, quantity }) => ({ itemId: item.id, quantity })),
  };
}

// Equipment as item ids by slot.
export function snapshotEquipment(equipment: Equipment): EquipmentSnapshot {
  return Object.freeze(Object.fromEntries(Object.entries(equipment).map(([slot, gear]) => [slot, gear!.id])));
}

function lookUp(itemId: string, items: readonly Item[]): Item {
  const item = items.find((candidate) => candidate.id === itemId);
  if (!item) throw new Error(`Unknown item: ${itemId}`);
  return item;
}

// The run after a battle: each roster unit in result.units has its XP,
// levels, stats, HP, bag (used items) and spells learned written back, and those that died move from the roster to
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
  const banishedBoons = [...(run.banishedBoons ?? []), ...(result.banishedBoons ?? [])];
  return freezeRun({
    ...run,
    roster,
    fallen,
    relics,
    convoy: [...run.convoy, ...(result.convoy ?? [])],
    chronicle,
    ...(banishedBoons.length > 0 && { banishedBoons: [...new Set(banishedBoons)] }),
    ...(result.boonRerolled && { boonRerollStage: run.stage }),
  });
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

// Saves from before the magic stat was renamed intelligence store a
// unit's `magic` and the `stat-magic` boon, and saves from before skill
// was renamed dexterity its `skill` (a number, unlike a skill) and the
// `stat-skill` boon; a JSON.parse reviver that reads them under their new
// names, so those runs still load.
function renameOldStats(_key: string, value: unknown): unknown {
  if (value === 'stat-magic') return 'stat-intelligence';
  if (value === 'stat-skill') return 'stat-dexterity';
  if (isRecord(value) && 'magic' in value && !('intelligence' in value)) {
    const { magic, ...rest } = value;
    return renameOldStats(_key, { ...rest, intelligence: magic });
  }
  if (isRecord(value) && typeof value.skill === 'number' && !('dexterity' in value)) {
    const { skill, ...rest } = value;
    return { ...rest, dexterity: skill };
  }
  return value;
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
    data = JSON.parse(text, renameOldStats);
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
    keystone,
    deployCap,
    fallen,
    pendingReward,
    pendingRecruitment,
    pendingGuest,
    pendingDraft,
    route,
    pendingEvent,
    seenEvents,
    pendingBoons,
    chronicle,
    scrolls,
    origin,
    heat,
    banishedBoons,
    boonRerollStage,
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
    (keystone !== undefined && typeof keystone !== 'string') ||
    !isWholeNumber(deployCap) ||
    deployCap < 1 ||
    !isUnits(fallen) ||
    (pendingReward !== undefined && !isPendingReward(pendingReward)) ||
    (pendingRecruitment !== undefined && (!isWholeNumber(pendingRecruitment) || pendingRecruitment < 1)) ||
    (pendingGuest !== undefined && !isUnitSnapshot(pendingGuest, classIds, isItems)) ||
    (pendingGuest === undefined) !== (pendingRecruitment === undefined) ||
    (pendingDraft !== undefined && (!isWholeNumber(pendingDraft) || pendingDraft < 1)) ||
    (route !== undefined && !isRunRoute(route)) ||
    (pendingEvent !== undefined && !isPendingEvent(pendingEvent)) ||
    (seenEvents !== undefined && !(Array.isArray(seenEvents) && seenEvents.every((id) => typeof id === 'string'))) ||
    (pendingBoons !== undefined && !isPendingBoons(pendingBoons)) ||
    (chronicle !== undefined && parseChronicle(chronicle) === null) ||
    (scrolls !== undefined && !isWholeNumber(scrolls)) ||
    (origin !== undefined && typeof origin !== 'string') ||
    (heat !== undefined && (!isWholeNumber(heat) || heat < 1 || heat > MAX_HEAT)) ||
    (banishedBoons !== undefined &&
      !(Array.isArray(banishedBoons) && banishedBoons.every((id) => typeof id === 'string'))) ||
    (boonRerollStage !== undefined && !isWholeNumber(boonRerollStage))
  ) {
    return null;
  }
  if (new Set(roster.map((unit) => unit.id)).size !== roster.length) return null;
  // Saves from before equipment slots: sort each unit's items into its
  // slots, sending what has no place to the convoy, and count gear (which
  // no longer wears out) as one each.
  const normalized = roster.map((unit) => normalizeSnapshot(unit, items));
  const oneEach = (entry: ItemSnapshot) =>
    lookUp(entry.itemId, items).kind === 'consumable' ? entry : { ...entry, quantity: 1 };
  return freezeRun({
    seed,
    stage,
    roster: normalized.map(({ snapshot }) => snapshot),
    convoy: [...convoy, ...normalized.flatMap(({ spare }) => spare)].map(oneEach),
    gold,
    relics,
    ...(keystone !== undefined && { keystone }),
    deployCap,
    fallen: fallen.map((unit) => normalizeSnapshot(unit, items).snapshot),
    ...(pendingReward !== undefined && { pendingReward }),
    ...(pendingRecruitment !== undefined && { pendingRecruitment }),
    ...(pendingGuest !== undefined && { pendingGuest: normalizeSnapshot(pendingGuest, items).snapshot }),
    ...(pendingDraft !== undefined && { pendingDraft }),
    ...(pendingBoons !== undefined && { pendingBoons }),
    chronicle: chronicle === undefined ? EMPTY_CHRONICLE : parseChronicle(chronicle)!,
    ...(route !== undefined && { route }),
    ...(pendingEvent !== undefined && { pendingEvent }),
    ...(seenEvents !== undefined && { seenEvents }),
    ...(scrolls !== undefined && scrolls > 0 && { scrolls }),
    ...(origin !== undefined && { origin }),
    ...(heat !== undefined && { heat }),
    ...(banishedBoons !== undefined && banishedBoons.length > 0 && { banishedBoons }),
    ...(boonRerollStage !== undefined && { boonRerollStage }),
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

const GROWTH_STAT_SET: ReadonlySet<string> = new Set(GROWTH_STATS);

function isStatGains(value: unknown): value is Partial<Record<GrowthStat, number>> {
  return (
    isRecord(value) && Object.entries(value).every(([key, gain]) => GROWTH_STAT_SET.has(key) && isWholeNumber(gain))
  );
}

function isPendingBoons(value: unknown): value is PendingBoon[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        isRecord(entry) &&
        typeof entry.unitId === 'string' &&
        isWholeNumber(entry.level) &&
        entry.level >= 1 &&
        (entry.stage === undefined || (isWholeNumber(entry.stage) && entry.stage >= 1)) &&
        (entry.gains === undefined || isStatGains(entry.gains)) &&
        (entry.roll === undefined || isWholeNumber(entry.roll)),
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
    (value.equipment === undefined || isEquipmentSnapshot(value.equipment, isItems)) &&
    (value.innate === undefined ||
      (Array.isArray(value.innate) && isItems(value.innate.map((itemId) => ({ itemId, quantity: 1 }))))) &&
    (value.tomeProgress === undefined || isTomeProgress(value.tomeProgress)) &&
    (value.boons === undefined ||
      (Array.isArray(value.boons) && value.boons.every((boon) => typeof boon === 'string'))) &&
    (value.quirk === undefined || typeof value.quirk === 'string') &&
    (value.secondaryClass === undefined ||
      (typeof value.secondaryClass === 'string' && classIds.has(value.secondaryClass)))
  );
}

const GEAR_SLOT_IDS: ReadonlySet<string> = new Set(['main', 'off', 'head', 'body', 'accessory', 'special']);

function isEquipmentSnapshot(
  value: unknown,
  isItems: (value: unknown) => value is ItemSnapshot[],
): value is EquipmentSnapshot {
  return (
    isRecord(value) &&
    Object.entries(value).every(([slot, itemId]) => GEAR_SLOT_IDS.has(slot) && isItems([{ itemId, quantity: 1 }]))
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
  const { tomeProgress, boons, equipment, innate } = snapshot;
  return Object.freeze({
    ...snapshot,
    items: freezeItems(snapshot.items),
    ...(equipment && { equipment: Object.freeze({ ...equipment }) }),
    ...(innate && { innate: Object.freeze([...innate]) }),
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
    ...(run.banishedBoons && { banishedBoons: Object.freeze([...run.banishedBoons]) }),
    ...(run.pendingBoons && {
      pendingBoons: Object.freeze(
        run.pendingBoons.map((pending) =>
          Object.freeze({
            ...pending,
            ...(pending.gains && { gains: Object.freeze({ ...pending.gains }) }),
          }),
        ),
      ),
    }),
  });
}
