import { describe, expect, it } from 'vitest';
import { findPromotion } from '../promotions.ts';
import { Archer } from '../Archer.ts';
import { Soldier } from '../Soldier.ts';
import type { Unit } from '../Unit.ts';
import { findBoon } from './boons.ts';
import {
  banishBoonPick,
  BOON_BANISHES,
  getBattleBoonOffer,
  getBoonOffer,
  getBoonRedraws,
  getBoonSeed,
  pickBoon,
  queueLevelUpBoons,
  rerollBoonPick,
  settleBoons,
} from './levelUpPicks.ts';
import { applyBattleResult, createRun, parseRun, restoreUnit, serializeRun, type RunState } from './run.ts';

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
      { unitId: 'alden', level: 2, stage: 1 },
      { unitId: 'alden', level: 3, stage: 1 },
      { unitId: 'bryn', level: 2, stage: 1 },
    ]);
  });

  it('queues after picks already owed, and owes nothing without level ups', () => {
    const run = newRun();
    const once = queueLevelUpBoons(run, leveled(run, { bryn: 1 }));
    const twice = queueLevelUpBoons(once, leveled(once, { alden: 1 }));
    expect(twice.pendingBoons).toEqual([
      { unitId: 'bryn', level: 2, stage: 1 },
      { unitId: 'alden', level: 2, stage: 1 },
    ]);
    const none = queueLevelUpBoons(run, run);
    expect(none.pendingBoons).toBeUndefined();
  });

  it('skips the picks already taken in battle', () => {
    const run = newRun();
    const after = queueLevelUpBoons(run, leveled(run, { alden: 2, bryn: 1 }), [
      { unitId: 'alden', level: 2 },
      { unitId: 'bryn', level: 2 },
    ]);
    expect(after.pendingBoons).toEqual([{ unitId: 'alden', level: 3, stage: 1 }]);
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
    expect(queued.pendingBoons).toEqual([{ unitId: 'alden', level: 2, stage: 1, gains: { health: 1, strength: 1 } }]);
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
    expect(settleBoons(without).pendingBoons).toEqual([{ unitId: 'bryn', level: 2, stage: 1 }]);
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
    expect(alden.boons).toEqual([boon.entry]);
    expect(after.pendingBoons).toEqual([{ unitId: 'bryn', level: 2, stage: 1 }]);
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
    // On top of the soldier's own passive.
    expect(unit.modifiers).toEqual([...findPromotion('soldier')!.passive.modifiers, ...boon.modifiers]);
  });

  it('throws when nothing is owed or the index is off', () => {
    expect(() => pickBoon(newRun(), 0)).toThrow(/owed/);
    const run = queueLevelUpBoons(newRun(), leveled(newRun(), { alden: 1 }));
    expect(() => pickBoon(run, 5)).toThrow(/5/);
  });
});

describe('getBattleBoonOffer', () => {
  it('offers in battle the boons the run would offer for that level after it', () => {
    const run = newRun();
    const later = queueLevelUpBoons(run, leveled(run, { alden: 1 }));
    const unit = restoreUnit(later.roster[0]);
    const offer = getBattleBoonOffer(run, 'alden', unit, 2, { strength: 1, speed: 0 })!;
    expect(offer.boons).toEqual(getBoonOffer(later)!.boons);
    expect(offer).toMatchObject({ level: 2, unit: { id: 'alden', level: 2 }, gains: { strength: 1 } });
  });
});

describe('rerollBoonPick and banishBoonPick', () => {
  const owing = () => {
    const run = newRun();
    return queueLevelUpBoons(run, leveled(run, { alden: 2 }));
  };
  const ids = (run: RunState) => getBoonOffer(run)!.boons.map((boon) => boon.id);

  it('rerolls the first pick once per stage, for every pick reached at it', () => {
    const run = owing();
    expect(getBoonRedraws(run)).toEqual({ reroll: true, banishes: BOON_BANISHES });
    const rerolled = rerollBoonPick(run);
    expect(rerolled.pendingBoons![0].roll).toBe(1);
    expect(ids(rerolled)).not.toEqual(ids(run));
    expect(getBoonRedraws(rerolled).reroll).toBe(false);
    // The next pick, reached at the same stage, has no free reroll left.
    expect(() => rerollBoonPick(pickBoon(rerolled, 0))).toThrow(/spent/);
    // It survives a save.
    expect(ids(parseRun(serializeRun(rerolled))!)).toEqual(ids(rerolled));
  });

  it('gives each battle its own reroll, shared by the picks owed after it', () => {
    // Back at camp after stage 1's battle, whose reroll is spent.
    const spent = { ...owing(), stage: 2, boonRerollStage: 1 };
    expect(getBoonRedraws(spent).reroll).toBe(false);
    // Stage 2's battle has its own.
    expect(getBoonRedraws(spent, 2).reroll).toBe(true);
    expect(getBoonRedraws({ ...spent, stage: 3 }).reroll).toBe(true);
  });

  it('banishes a boon from the rest of the run and draws the offer anew', () => {
    const run = owing();
    const banishedId = getBoonOffer(run)!.boons[0].id;
    const banished = banishBoonPick(run, 0);
    expect(banished.banishedBoons).toEqual([banishedId]);
    expect(ids(banished)).not.toContain(banishedId);
    expect(ids(pickBoon(banished, 0))).not.toContain(banishedId);
    expect(getBoonRedraws(banished).banishes).toBe(BOON_BANISHES - 1);
    expect(parseRun(serializeRun(banished))!.banishedBoons).toEqual([banishedId]);
  });

  it('allows only BOON_BANISHES banishes a run', () => {
    let run = owing();
    for (let i = 0; i < BOON_BANISHES; i++) run = banishBoonPick(run, 0);
    expect(() => banishBoonPick(run, 0)).toThrow(/banish/);
  });

  it('keeps banished boons out of battle picks', () => {
    const run = newRun();
    const unit = restoreUnit(run.roster[0]);
    const offer = getBattleBoonOffer(run, 'alden', unit, 2)!;
    const banished = offer.boons[0].id;
    const after = getBattleBoonOffer(run, 'alden', unit, 2, undefined, { banished: [banished] })!;
    expect(after.boons.map((boon) => boon.id)).not.toContain(banished);
    const rerolled = getBattleBoonOffer(run, 'alden', unit, 2, undefined, { roll: 1 })!;
    expect(rerolled.boons.map((boon) => boon.id)).not.toEqual(offer.boons.map((boon) => boon.id));
  });

  it("writes a battle's reroll and banishes back to the run", () => {
    const run = newRun();
    const after = applyBattleResult(run, { units: new Map(), boonRerolled: true, banishedBoons: ['fleet'] });
    expect(after.boonRerollStage).toBe(run.stage);
    expect(after.banishedBoons).toEqual(['fleet']);
  });
});
