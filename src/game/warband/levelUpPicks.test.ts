import { describe, expect, it } from 'vitest';
import { Archer } from '../Archer.ts';
import { Soldier } from '../Soldier.ts';
import type { Unit } from '../Unit.ts';
import { findBoon } from './boons.ts';
import {
  getBoonOffer,
  getBoonSeed,
  getTakenBoons,
  owesBoons,
  pickBoon,
  queueLevelUpBoons,
  settleBoons,
} from './levelUpPicks.ts';
import { createRun, parseRun, restoreUnit, serializeRun, type RunState } from './run.ts';

function newRun(): RunState {
  return createRun(
    7,
    new Map<string, Unit>([
      ['alden', new Soldier({ name: 'Alden', team: 'player' })],
      ['bryn', new Archer({ name: 'Bryn', team: 'player' })],
    ]),
  );
}

// `run` with each named unit `levels` levels higher.
function leveled(run: RunState, levels: Record<string, number>): RunState {
  return {
    ...run,
    roster: run.roster.map((unit) => ({ ...unit, level: unit.level + (levels[unit.id] ?? 0) })),
  };
}

describe('queueLevelUpBoons', () => {
  it('owes a pick per level gained, unit by unit and level by level', () => {
    const run = newRun();
    const after = queueLevelUpBoons(run, leveled(run, { alden: 2, bryn: 1 }));
    expect(after.pendingBoons).toEqual([
      { unitId: 'alden', level: 2 },
      { unitId: 'alden', level: 3 },
      { unitId: 'bryn', level: 2 },
    ]);
    expect(owesBoons(after)).toBe(true);
  });

  it('queues after picks already owed, and owes nothing without level ups', () => {
    const run = newRun();
    const once = queueLevelUpBoons(run, leveled(run, { bryn: 1 }));
    const twice = queueLevelUpBoons(once, leveled(once, { alden: 1 }));
    expect(twice.pendingBoons).toEqual([
      { unitId: 'bryn', level: 2 },
      { unitId: 'alden', level: 2 },
    ]);
    const none = queueLevelUpBoons(run, run);
    expect(none.pendingBoons).toBeUndefined();
    expect(owesBoons(none)).toBe(false);
  });

  it('skips units that only joined between the two runs', () => {
    const run = newRun();
    const recruit = { ...run.roster[0], id: 'recruit-2', level: 3 };
    const after = queueLevelUpBoons(run, { ...run, roster: [...run.roster, recruit] });
    expect(after.pendingBoons).toBeUndefined();
  });

  it('records the stat gains from the level up on the pending pick and offer', () => {
    const run = newRun();
    const before = run.roster[0];
    const after = {
      ...run,
      roster: [{ ...before, level: 2, maxHealth: before.maxHealth + 1, strength: before.strength + 1 }, run.roster[1]],
    };
    const queued = queueLevelUpBoons(run, after);
    expect(queued.pendingBoons).toEqual([{ unitId: 'alden', level: 2, gains: { health: 1, strength: 1 } }]);
    const offer = getBoonOffer(queued)!;
    expect(offer.gains).toEqual({ health: 1, strength: 1 });
    expect(getBoonOffer(parseRun(serializeRun(queued))!)).toEqual(offer);
  });
});

describe('getBoonOffer', () => {
  it('offers three boons for the first pick owed, the same every time', () => {
    const run = queueLevelUpBoons(newRun(), leveled(newRun(), { alden: 1 }));
    const offer = getBoonOffer(run)!;
    expect(offer.unit.id).toBe('alden');
    expect(offer.level).toBe(2);
    expect(offer.boons).toHaveLength(3);
    expect(getBoonOffer(parseRun(serializeRun(run))!)).toEqual(offer);
  });

  it('is null when nothing is owed', () => {
    expect(getBoonOffer(newRun())).toBeNull();
  });

  it("passes over a pick for a unit that's left the roster", () => {
    const run = queueLevelUpBoons(newRun(), leveled(newRun(), { alden: 1, bryn: 1 }));
    const without = { ...run, roster: run.roster.filter((unit) => unit.id !== 'alden') };
    expect(getBoonOffer(without)!.unit.id).toBe('bryn');
    expect(settleBoons(without).pendingBoons).toEqual([{ unitId: 'bryn', level: 2 }]);
  });
});

describe('getBoonSeed', () => {
  it('differs by unit and level, and is fixed per triple', () => {
    expect(getBoonSeed(1, 'alden', 2)).toBe(getBoonSeed(1, 'alden', 2));
    expect(getBoonSeed(1, 'alden', 2)).not.toBe(getBoonSeed(1, 'alden', 3));
    expect(getBoonSeed(1, 'alden', 2)).not.toBe(getBoonSeed(1, 'bryn', 2));
    expect(Number.isInteger(getBoonSeed(1, 'alden', 2))).toBe(true);
  });
});

describe('pickBoon', () => {
  it('gives the unit the boon and moves on to the next pick', () => {
    const run = queueLevelUpBoons(newRun(), leveled(newRun(), { alden: 1, bryn: 1 }));
    const offer = getBoonOffer(run)!;
    const boon = offer.boons[2];
    const after = pickBoon(run, 2);
    const alden = after.roster.find((unit) => unit.id === 'alden')!;
    expect(alden.boons).toEqual([boon.id]);
    expect(getTakenBoons(alden)).toEqual([boon]);
    expect(after.pendingBoons).toEqual([{ unitId: 'bryn', level: 2 }]);
    expect(run.roster[0].boons).toBeUndefined();
  });

  it('applies a stat boon to the snapshot and clears the queue after the last pick', () => {
    const run = queueLevelUpBoons(newRun(), leveled(newRun(), { bryn: 1 }));
    const offer = getBoonOffer(run)!;
    expect(offer.boons[0].kind).toBe('stat');
    const after = pickBoon(run, 0);
    const stat = offer.boons[0].stat!.stat;
    const field = stat === 'health' ? 'maxHealth' : stat;
    const bryn = (r: RunState) => r.roster.find((unit) => unit.id === 'bryn')!;
    expect(bryn(after)[field as 'speed']).toBeGreaterThan(bryn(run)[field as 'speed']);
    expect(after.pendingBoons).toBeUndefined();
  });

  it("gives the unit its passive's modifiers when it's next restored", () => {
    const run = queueLevelUpBoons(newRun(), leveled(newRun(), { alden: 1 }));
    const index = getBoonOffer(run)!.boons.findIndex((boon) => boon.kind === 'passive');
    const boon = getBoonOffer(run)!.boons[index];
    const unit = restoreUnit(pickBoon(run, index).roster[0]);
    expect(unit.modifiers).toEqual(findBoon(boon.id)!.modifiers);
  });

  it('throws when nothing is owed or the index is off', () => {
    expect(() => pickBoon(newRun(), 0)).toThrow(/owed/);
    const run = queueLevelUpBoons(newRun(), leveled(newRun(), { alden: 1 }));
    expect(() => pickBoon(run, 5)).toThrow(/5/);
  });
});
