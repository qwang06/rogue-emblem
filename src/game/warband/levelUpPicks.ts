// The run side of level-up boons (boons.ts): every level a roster unit
// gains, whether in battle, from a stage clear or from a Veteran's Lesson,
// owes a pick of one of three boons. The picks queue on the run
// (`pendingBoons`, oldest first) and are taken one at a time before the
// warband moves on, so a reload reopens them with the same offers. Offers
// are seeded from the run's seed, the unit and the level, so they never
// change between visits; they grow with the stage the level was reached
// at (recorded on the queued pick). Pure: each function returns a new frozen run.

import { GROWTH_STATS, type GrowthStat } from '../experience.ts';
import { createSeededRng } from '../rng.ts';
import type { UnitClass } from '../unitClasses.ts';
import type { Unit } from '../Unit.ts';
import { rollBoons, takeBoon, type Boon } from './boons.ts';
import { restoreUnit, snapshotUnit, type PendingBoon, type RunState, type UnitSnapshot } from './run.ts';

// A boon pick as it's offered: the unit, the level it reached, the boons to
// choose from, and any stat gains the level-up roll gave.
export interface BoonOffer {
  unit: UnitSnapshot;
  level: number;
  boons: readonly Boon[];
  gains?: Partial<Record<GrowthStat, number>>;
}

const SNAPSHOT_STAT_KEYS: Readonly<Record<GrowthStat, keyof UnitSnapshot>> = Object.freeze({
  health: 'maxHealth',
  mana: 'maxMana',
  strength: 'strength',
  intelligence: 'intelligence',
  skill: 'skill',
  speed: 'speed',
  luck: 'luck',
  defense: 'defense',
  resistance: 'resistance',
});

function diffStats(before: UnitSnapshot, after: UnitSnapshot): Partial<Record<GrowthStat, number>> | undefined {
  const gains: Partial<Record<GrowthStat, number>> = {};
  for (const stat of GROWTH_STATS) {
    const key = SNAPSHOT_STAT_KEYS[stat];
    const diff = (after[key] as number) - (before[key] as number);
    if (diff > 0) gains[stat] = diff;
  }
  return Object.keys(gains).length > 0 ? Object.freeze(gains) : undefined;
}

// The seed the boon offer for `unitId` reaching `level` rolls from, in a
// run started with `runSeed`, after `roll` rerolls.
export function getBoonSeed(runSeed: number, unitId: string, level: number, roll = 0): number {
  let hash = (runSeed ^ Math.imul(level + 0x3c6e, 0x27d4eb2d)) >>> 0;
  for (const char of unitId) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
  if (roll > 0) hash = Math.imul(hash ^ (roll + 0x51ed), 0x85ebca6b) >>> 0;
  return Math.floor(createSeededRng(hash)() * 2 ** 32);
}

// A level-up pick can be rerolled for free once per battle (the picks in
// a stage's battle and those owed after it, until the next battle), and
// BOON_BANISHES boons can be banished from the run's offers, each banish
// drawing the offer anew.
export const FREE_BOON_REROLLS = 1;
export const BOON_BANISHES = 2;

// How a pick may still be redrawn: whether its stage's free reroll is
// unspent, and how many banishes the run has left.
export interface BoonRedraws {
  reroll: boolean;
  banishes: number;
}

// What a run may still redraw a pick with, the pick belonging to the
// battle of `stage`: by default the last one fought (the stage before the
// run's), for picks owed between battles; a battle's own picks pass its
// stage.
export function getBoonRedraws(
  run: Pick<RunState, 'stage' | 'banishedBoons' | 'boonRerollStage'>,
  stage = run.stage - 1,
): BoonRedraws {
  return Object.freeze({
    reroll: run.boonRerollStage !== stage,
    banishes: Math.max(0, BOON_BANISHES - (run.banishedBoons?.length ?? 0)),
  });
}

// A level a unit reached whose boon pick was already taken (in battle, as
// the level up happened).
export interface TakenBoon {
  unitId: string;
  level: number;
}

// `after` (a run that `before` became) owing a boon pick for each level
// any unit on both rosters gained between them, except the `taken` ones,
// at `before`'s stage,
// queued after the ones it already owes, unit by unit in roster order and
// level by level, with any stat gains from `before` to `after` recorded on
// the last pick.
export function queueLevelUpBoons(before: RunState, after: RunState, taken: readonly TakenBoon[] = []): RunState {
  const queued: PendingBoon[] = [];
  for (const unit of after.roster) {
    const was = before.roster.find((snapshot) => snapshot.id === unit.id);
    if (!was || unit.level <= was.level) continue;
    const gains = diffStats(was, unit);
    for (let level = was.level + 1; level <= unit.level; level++) {
      if (taken.some((pick) => pick.unitId === unit.id && pick.level === level)) continue;
      queued.push({
        unitId: unit.id,
        level,
        stage: before.stage,
        ...(level === unit.level && gains ? { gains } : {}),
      });
    }
  }
  if (queued.length === 0) return after;
  return setPending(after, [...(after.pendingBoons ?? []), ...queued]);
}

// The boon pick a roster unit is offered as it reaches `level` in battle,
// `unit` being the unit as it stands there: the same boons the run would
// offer it for that level after the battle (they're seeded alike), with the
// level up's stat `gains`, after `roll` rerolls and without the `banished`
// boons. Null when it has none left to take.
export function getBattleBoonOffer(
  run: Pick<RunState, 'seed' | 'stage'>,
  unitId: string,
  unit: Unit,
  level: number,
  gains?: Partial<Record<GrowthStat, number>>,
  { roll = 0, banished = [] }: { roll?: number; banished?: readonly string[] } = {},
): BoonOffer | null {
  const boons = rollBoons(unit, createSeededRng(getBoonSeed(run.seed, unitId, level, roll)), run.stage, banished);
  if (boons.length === 0) return null;
  const grew = gains && Object.fromEntries(Object.entries(gains).filter(([, gain]) => gain > 0));
  return Object.freeze({
    unit: snapshotUnit(unitId, unit),
    level,
    boons: Object.freeze(boons),
    ...(grew && Object.keys(grew).length > 0 && { gains: Object.freeze(grew) }),
  });
}

// The first boon pick the run owes, or null when it owes none. Picks it
// can't offer (the unit has left the roster, or has nothing left to take)
// are passed over; settleBoons drops them.
export function getBoonOffer(run: RunState, classes?: readonly UnitClass[]): BoonOffer | null {
  for (const pending of run.pendingBoons ?? []) {
    const offer = rollOffer(run, pending, classes);
    if (offer) return offer;
  }
  return null;
}

// The run with the picks it can't offer dropped from the front of its
// queue (see getBoonOffer), and no queue at all once it's empty.
export function settleBoons(run: RunState, classes?: readonly UnitClass[]): RunState {
  const pending = [...(run.pendingBoons ?? [])];
  while (pending.length > 0 && !rollOffer(run, pending[0], classes)) pending.shift();
  return setPending(run, pending);
}

// The run after taking boon `index` of the first pick it owes: the boon
// given to the unit (takeBoon), and the pick dropped from the queue, with
// any following ones it can't offer. Throws when it owes no pick or there's
// no such boon.
export function pickBoon(run: RunState, index: number, classes?: readonly UnitClass[]): RunState {
  const settled = settleBoons(run, classes);
  const offer = getBoonOffer(settled, classes);
  const boon = offer?.boons[index];
  if (!offer || !boon) throw new Error(offer ? `No boon offer ${index}` : 'No boon pick is owed');
  const unit = takeBoon(restoreUnit(offer.unit, classes), boon);
  const roster = settled.roster.map((snapshot) =>
    snapshot.id === offer.unit.id ? snapshotUnit(snapshot.id, unit) : snapshot,
  );
  const next = Object.freeze({ ...settled, roster: Object.freeze(roster) });
  return settleBoons(setPending(next, settled.pendingBoons!.slice(1)), classes);
}

// The run after rerolling the first pick it owes (spending its stage's
// free reroll: see getBoonRedraws). Throws when it owes none or the reroll
// is spent.
export function rerollBoonPick(run: RunState, classes?: readonly UnitClass[]): RunState {
  const settled = settleBoons(run, classes);
  const [first, ...rest] = settled.pendingBoons ?? [];
  if (!first) throw new Error('No boon pick is owed');
  if (!getBoonRedraws(settled).reroll) throw new Error('The free reroll is spent');
  const next = setPending(settled, [{ ...first, roll: (first.roll ?? 0) + 1 }, ...rest]);
  return Object.freeze({ ...next, boonRerollStage: settled.stage - 1 });
}

// The run after banishing boon `index` of the first pick it owes: that
// boon never offered again in the run, and the pick drawn anew without it.
// Throws when it owes none, there's no such boon, or no banish is left.
export function banishBoonPick(run: RunState, index: number, classes?: readonly UnitClass[]): RunState {
  const settled = settleBoons(run, classes);
  const boon = getBoonOffer(settled, classes)?.boons[index];
  if (!boon) throw new Error(`No boon offer ${index}`);
  if (getBoonRedraws(settled).banishes <= 0) throw new Error('No banish is left');
  const banished = Object.freeze({
    ...settled,
    banishedBoons: Object.freeze([...(settled.banishedBoons ?? []), boon.id]),
  });
  return settleBoons(banished, classes);
}

function rollOffer(run: RunState, pending: PendingBoon, classes?: readonly UnitClass[]): BoonOffer | null {
  const unit = run.roster.find((snapshot) => snapshot.id === pending.unitId);
  if (!unit) return null;
  const boons = rollBoons(
    restoreUnit(unit, classes),
    createSeededRng(getBoonSeed(run.seed, pending.unitId, pending.level, pending.roll ?? 0)),
    pending.stage ?? run.stage,
    run.banishedBoons,
  );
  return boons.length > 0
    ? Object.freeze({
        unit,
        level: pending.level,
        boons: Object.freeze(boons),
        ...(pending.gains && { gains: pending.gains }),
      })
    : null;
}

function setPending(run: RunState, pending: readonly PendingBoon[]): RunState {
  const { pendingBoons: _owed, ...rest } = run;
  if (pending.length === 0) return Object.freeze(rest);
  return Object.freeze({
    ...rest,
    pendingBoons: Object.freeze(
      pending.map((entry) =>
        Object.freeze({
          ...entry,
          ...(entry.gains && { gains: Object.freeze({ ...entry.gains }) }),
        }),
      ),
    ),
  });
}
