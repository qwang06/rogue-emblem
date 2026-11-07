import { describe, expect, it } from 'vitest';
import { Unit } from '../game/Unit.ts';
import { countForecastStrikes, describeForecastOutcome, toOtherTargetViews } from './forecastView.ts';
import type { ForecastSideView } from './views.ts';

function side(over: Partial<ForecastSideView>): ForecastSideView {
  return {
    name: 'Kestrel',
    team: 'player',
    rank: null,
    weapon: 'Iron Spear',
    weaponId: 'iron-spear',
    sprite: 'soldier',
    health: 21,
    maxHealth: 21,
    damage: 7,
    hit: 86,
    crit: 4,
    strikes: 2,
    counters: true,
    healthAfter: 17,
    ...over,
  };
}

describe('describeForecastOutcome', () => {
  it('says who falls and what the other takes', () => {
    const attacker = side({});
    const defender = side({ name: 'Goblin', team: 'enemy', health: 14, maxHealth: 14, strikes: 1, healthAfter: 0 });
    expect(describeForecastOutcome(attacker, defender)).toBe('Goblin falls · Kestrel takes 4 at most');
  });

  it('says what each side takes when neither falls', () => {
    const attacker = side({ healthAfter: 21 });
    const defender = side({ name: 'Orc', team: 'enemy', health: 22, maxHealth: 22, healthAfter: 8 });
    expect(describeForecastOutcome(attacker, defender)).toBe('Orc takes 14 at most · Kestrel is safe');
  });

  it("says the defender can't counter instead of what the attacker takes", () => {
    const attacker = side({ healthAfter: 21 });
    const defender = side({
      name: 'Archer',
      team: 'enemy',
      health: 12,
      maxHealth: 12,
      damage: null,
      hit: null,
      crit: null,
      strikes: 0,
      counters: false,
      healthAfter: 5,
    });
    expect(describeForecastOutcome(attacker, defender)).toBe("Archer takes 7 at most · Archer can't counter");
  });
});

describe('countForecastStrikes', () => {
  it('adds the counter strikes only when the defender counters', () => {
    expect(countForecastStrikes(side({ strikes: 2 }), side({ strikes: 1, counters: true }))).toBe(3);
    expect(countForecastStrikes(side({ strikes: 2 }), side({ strikes: 0, counters: false }))).toBe(2);
  });
});

describe('toOtherTargetViews', () => {
  it('lists every target but the current one, as party rows', () => {
    const goblin = new Unit({ name: 'Goblin', health: 10, strength: 3, defense: 1, movement: 4, team: 'enemy' });
    const orc = new Unit({ name: 'Orc', health: 22, strength: 6, defense: 3, movement: 4, team: 'enemy' });
    const units = new Map([
      ['g', goblin],
      ['o', orc],
    ]);
    const targets = [
      { x: 1, y: 1, unitId: 'g' },
      { x: 2, y: 1, unitId: 'o' },
      { x: 3, y: 1, unitId: 'missing' },
    ];
    const rows = toOtherTargetViews(units, targets, 'g');
    expect(rows.map((row) => row.name)).toEqual(['Orc']);
    expect(rows[0]).toMatchObject({ id: 'o', health: 22, maxHealth: 22, acted: false, fallen: false });
    expect(Object.isFrozen(rows)).toBe(true);
  });
});
