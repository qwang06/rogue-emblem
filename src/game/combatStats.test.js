import { describe, expect, it } from 'vitest';
import {
  BASE_HIT,
  DOUBLE_THRESHOLD,
  canDouble,
  getAvoid,
  getCrit,
  getCritChance,
  getDodge,
  getHit,
  getHitChance,
  rollChance,
} from './combatStats.js';

describe('getHit', () => {
  it('is base hit + skill × 2 + luck / 2, rounded down', () => {
    expect(getHit({ skill: 3, luck: 3 })).toBe(BASE_HIT + 6 + 1);
  });

  it('is the base hit with no stats', () => {
    expect(getHit({})).toBe(BASE_HIT);
  });
});

describe('getAvoid', () => {
  it('is speed × 2 + luck', () => {
    expect(getAvoid({ speed: 3, luck: 2 })).toBe(8);
  });

  it('is 0 with no stats', () => {
    expect(getAvoid({})).toBe(0);
  });
});

describe('getCrit and getDodge', () => {
  it('crit is skill / 2, rounded down', () => {
    expect(getCrit({ skill: 7 })).toBe(3);
    expect(getCrit({})).toBe(0);
  });

  it('dodge is luck', () => {
    expect(getDodge({ luck: 4 })).toBe(4);
    expect(getDodge({})).toBe(0);
  });
});

describe('getHitChance', () => {
  it('is hit minus avoid', () => {
    // 80 + 6 + 1 = 87 vs 3 × 2 + 2 = 8.
    expect(getHitChance({ skill: 3, luck: 2 }, { speed: 3, luck: 2 })).toBe(79);
  });

  it('clamps at 0', () => {
    expect(getHitChance({}, { speed: 60 })).toBe(0);
  });

  it('clamps at 100', () => {
    expect(getHitChance({ skill: 30 }, {})).toBe(100);
  });
});

describe('getCritChance', () => {
  it('is crit minus dodge', () => {
    expect(getCritChance({ skill: 10 }, { luck: 2 })).toBe(3);
  });

  it('clamps at 0 when luck outweighs skill', () => {
    expect(getCritChance({ skill: 3 }, { luck: 2 })).toBe(0);
  });

  it('clamps at 100', () => {
    expect(getCritChance({ skill: 400 }, {})).toBe(100);
  });
});

describe('canDouble', () => {
  it('needs speed ahead by at least the threshold', () => {
    expect(canDouble({ speed: 3 + DOUBLE_THRESHOLD }, { speed: 3 })).toBe(true);
    expect(canDouble({ speed: 2 + DOUBLE_THRESHOLD }, { speed: 3 })).toBe(false);
  });

  it('is one-sided', () => {
    expect(canDouble({ speed: 3 }, { speed: 10 })).toBe(false);
  });

  it('is false for equal speed', () => {
    expect(canDouble({ speed: 5 }, { speed: 5 })).toBe(false);
  });
});

describe('rollChance', () => {
  it('succeeds when the roll is under the chance', () => {
    expect(rollChance(50, () => 0.49)).toBe(true);
    expect(rollChance(50, () => 0.5)).toBe(false);
  });

  it('never succeeds at 0% and always at 100%', () => {
    expect(rollChance(0, () => 0)).toBe(false);
    expect(rollChance(100, () => 0.9999)).toBe(true);
  });

  it('averages two rolls with trueHit', () => {
    const rolls = [0.9, 0.5];
    let i = 0;
    const rng = () => rolls[i++];
    // (90 + 50) / 2 = 70 < 75.
    expect(rollChance(75, rng, { trueHit: true })).toBe(true);
    expect(i).toBe(2);
  });

  it('uses a single roll without trueHit', () => {
    let calls = 0;
    rollChance(75, () => {
      calls += 1;
      return 0.9;
    });
    expect(calls).toBe(1);
  });
});
