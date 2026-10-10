import { describe, expect, it } from 'vitest';
import {
  DOUBLE_THRESHOLD,
  canDouble,
  getAttackSpeed,
  getAvoid,
  getCrit,
  getCritChance,
  getDodge,
  getHit,
  getHitChance,
  rollChance,
} from './combatStats.ts';

// A test weapon: 80 hit, no crit, no weight unless overridden.
const weapon = (overrides = {}) => ({ hit: 80, crit: 0, weight: 0, ...overrides });

describe('getHit', () => {
  it('is weapon hit + skill × 2 + luck / 2, rounded down', () => {
    expect(getHit({ skill: 3, luck: 3, weapon: weapon() })).toBe(80 + 6 + 1);
    expect(getHit({ skill: 3, luck: 3, weapon: weapon({ hit: 65 }) })).toBe(65 + 6 + 1);
  });

  it('is the weapon hit with no stats', () => {
    expect(getHit({ weapon: weapon() })).toBe(80);
  });

  it('has no weapon hit without a weapon', () => {
    expect(getHit({ skill: 3, luck: 3 })).toBe(7);
    expect(getHit({ skill: 3, weapon: null })).toBe(6);
  });
});

describe('getAttackSpeed', () => {
  it('is speed when the weapon is no heavier than strength', () => {
    expect(getAttackSpeed({ speed: 5, strength: 4, weapon: weapon({ weight: 4 }) })).toBe(5);
    expect(getAttackSpeed({ speed: 5, strength: 4, weapon: weapon({ weight: 1 }) })).toBe(5);
  });

  it('loses however much the weight exceeds strength', () => {
    expect(getAttackSpeed({ speed: 5, strength: 4, weapon: weapon({ weight: 7 }) })).toBe(2);
  });

  it('can go below zero', () => {
    expect(getAttackSpeed({ speed: 1, strength: 0, weapon: weapon({ weight: 6 }) })).toBe(-5);
  });

  it('adds worn armor weight to the weapon weight', () => {
    expect(getAttackSpeed({ speed: 5, strength: 4, armorWeight: 3, weapon: weapon({ weight: 1 }) })).toBe(5);
    expect(getAttackSpeed({ speed: 5, strength: 4, armorWeight: 3, weapon: weapon({ weight: 3 }) })).toBe(3);
  });

  it('counts armor weight without a weapon', () => {
    expect(getAttackSpeed({ speed: 5, strength: 1, armorWeight: 3 })).toBe(3);
  });

  it('is plain speed without a weapon', () => {
    expect(getAttackSpeed({ speed: 5 })).toBe(5);
    expect(getAttackSpeed({})).toBe(0);
  });
});

describe('getAvoid', () => {
  it('is speed × 2 + luck', () => {
    expect(getAvoid({ speed: 3, luck: 2 })).toBe(8);
  });

  it('uses attack speed, so a heavy weapon costs avoid', () => {
    expect(getAvoid({ speed: 3, luck: 2, strength: 1, weapon: weapon({ weight: 3 }) })).toBe(4);
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

  it("crit adds the weapon's crit", () => {
    expect(getCrit({ skill: 7, weapon: weapon({ crit: 10 }) })).toBe(13);
  });

  it('dodge is luck', () => {
    expect(getDodge({ luck: 4 })).toBe(4);
    expect(getDodge({})).toBe(0);
  });
});

describe('getHitChance', () => {
  it('is hit minus avoid', () => {
    // 80 weapon hit + 6 + 1 = 87 vs 3 × 2 + 2 = 8.
    expect(getHitChance({ skill: 3, luck: 2, weapon: weapon() }, { speed: 3, luck: 2 })).toBe(79);
  });

  it('clamps at 0', () => {
    expect(getHitChance({ weapon: weapon() }, { speed: 60 })).toBe(0);
  });

  it('clamps at 100', () => {
    expect(getHitChance({ skill: 30, weapon: weapon() }, {})).toBe(100);
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

  it('compares attack speed, so a heavy weapon can cost the double', () => {
    const fast = { speed: 3 + DOUBLE_THRESHOLD, strength: 2 };
    expect(canDouble({ ...fast, weapon: weapon({ weight: 2 }) }, { speed: 3 })).toBe(true);
    expect(canDouble({ ...fast, weapon: weapon({ weight: 3 }) }, { speed: 3 })).toBe(false);
    expect(canDouble({ speed: 7 }, { speed: 7, strength: 0, weapon: weapon({ weight: 4 }) })).toBe(true);
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
