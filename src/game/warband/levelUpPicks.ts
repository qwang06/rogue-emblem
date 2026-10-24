// The run side of level-up boons (boons.ts): every level a roster unit
// gains, whether in battle, from a stage clear or from a Veteran's Lesson,
// owes a pick of one of three boons. The picks queue on the run
// (`pendingBoons`, oldest first) and are taken one at a time before the
// warband moves on, so a reload reopens them with the same offers. Offers
// are seeded from the run's seed, the unit and the level, so they never
// change between visits. Pure: each function returns a new frozen run.

import { createSeededRng } from '../rng.ts';
import type { UnitClass } from '../unitClasses.ts';
import { findBoon, rollBoons, takeBoon, type Boon } from './boons.ts';
import { restoreUnit, snapshotUnit, type PendingBoon, type RunState, type UnitSnapshot } from './run.ts';

// A boon pick as it's offered: the unit, the level it reached, and the
// boons to choose from.
export interface BoonOffer {
  unit: UnitSnapshot;
  level: number;
  boons: readonly Boon[];
}

// The seed the boon offer for `unitId` reaching `level` rolls from, in a
// run started with `runSeed`.
export function getBoonSeed(runSeed: number, unitId: string, level: number): number {
  let hash = (runSeed ^ Math.imul(level + 0x3c6e, 0x27d4eb2d)) >>> 0;
  for (const char of unitId) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
  return Math.floor(createSeededRng(hash)() * 2 ** 32);
}

// `after` (a run that `before` became) owing a boon pick for each level
// any unit on both rosters gained between them, queued after the ones it
// already owes, unit by unit in roster order and level by level.
export function queueLevelUpBoons(before: RunState, after: RunState): RunState {
  const queued: PendingBoon[] = [];
  for (const unit of after.roster) {
    const was = before.roster.find((snapshot) => snapshot.id === unit.id);
    if (!was) continue;
    for (let level = was.level + 1; level <= unit.level; level++) queued.push({ unitId: unit.id, level });
  }
  if (queued.length === 0) return after;
  return setPending(after, [...(after.pendingBoons ?? []), ...queued]);
}

// Whether the run owes any boon pick.
export function owesBoons(run: RunState): boolean {
  return (run.pendingBoons?.length ?? 0) > 0;
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

// The boons `unit` has taken, looked up, in the order taken.
export function getTakenBoons(unit: Pick<UnitSnapshot, 'boons'>): Boon[] {
  return (unit.boons ?? []).map(findBoon).filter((boon): boon is Boon => boon !== null);
}

function rollOffer(run: RunState, pending: PendingBoon, classes?: readonly UnitClass[]): BoonOffer | null {
  const unit = run.roster.find((snapshot) => snapshot.id === pending.unitId);
  if (!unit) return null;
  const boons = rollBoons(
    restoreUnit(unit, classes),
    createSeededRng(getBoonSeed(run.seed, pending.unitId, pending.level)),
  );
  return boons.length > 0 ? Object.freeze({ unit, level: pending.level, boons: Object.freeze(boons) }) : null;
}

function setPending(run: RunState, pending: readonly PendingBoon[]): RunState {
  const { pendingBoons: _owed, ...rest } = run;
  if (pending.length === 0) return Object.freeze(rest);
  return Object.freeze({
    ...rest,
    pendingBoons: Object.freeze(pending.map((entry) => Object.freeze({ ...entry }))),
  });
}
