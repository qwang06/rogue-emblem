import { describe, expect, it } from 'vitest';
import {
  COUNTER_WEIGHT,
  createAttackScorer,
  isSoftTarget,
  KILL_BONUS,
  scoreAttack,
  SOFT_TARGET_BONUS,
  SUICIDE_PENALTY,
  type Foe,
  type Forecast,
} from './aiScoring.ts';
import { getCombatForecast, type ForecastSide } from './combat.ts';
import { HEAL_STAFF } from './healing.ts';
import { createInventory, HEALTH_POTION } from './items.ts';
import { FIRE, IRON_BOW, IRON_SPEAR } from './weapons.ts';

function side(fields: Partial<ForecastSide>): ForecastSide {
  return { health: 10, maxHealth: 10, damage: null, hit: null, crit: null, strikes: 0, counters: false, ...fields };
}

// Attacker deals `damage` at 100% hit, no crit; the defender doesn't counter
// unless `counter` is given.
function forecast(attack: Partial<ForecastSide>, defend: Partial<ForecastSide> = {}): Forecast {
  return {
    attacker: side({ hit: 100, crit: 0, strikes: 1, counters: true, ...attack }),
    defender: side(defend),
  };
}

const counter = (damage: number, strikes = 1): Partial<ForecastSide> => ({
  damage,
  hit: 100,
  crit: 0,
  strikes,
  counters: true,
});

describe('scoreAttack', () => {
  it('scores expected damage when nothing else applies', () => {
    expect(scoreAttack(forecast({ damage: 4 }))).toBe(4);
  });

  it('weighs damage by hit chance and strike count', () => {
    expect(scoreAttack(forecast({ damage: 2, hit: 50, strikes: 2 }))).toBe(2);
  });

  it('adds the extra damage crits deal on average', () => {
    // 2 damage, 50% crit at ×3: 2 × (1 + 0.5 × 2) = 4.
    expect(scoreAttack(forecast({ damage: 2, crit: 50 }))).toBe(4);
  });

  it('caps expected damage at the defender’s health', () => {
    expect(scoreAttack(forecast({ damage: 9, hit: 50 }, { health: 3 }))).toBe(3 + (KILL_BONUS * 50) / 100);
  });

  it('prefers a lethal hit over heavier chip damage', () => {
    const kill = forecast({ damage: 3 }, { health: 3 });
    const chip = forecast({ damage: 8 }, { health: 20 });
    expect(scoreAttack(kill)).toBeGreaterThan(scoreAttack(chip));
  });

  it('counts a kill that needs every strike, as when doubling', () => {
    const doubling = forecast({ damage: 3, strikes: 2 }, { health: 6 });
    expect(scoreAttack(doubling)).toBe(6 + KILL_BONUS);
  });

  it('scales the kill bonus by hit chance', () => {
    const sure = scoreAttack(forecast({ damage: 5, hit: 90 }, { health: 5 }));
    const shaky = scoreAttack(forecast({ damage: 5, hit: 30 }, { health: 5 }));
    expect(sure).toBeGreaterThan(shaky);
  });

  it('subtracts expected counter damage', () => {
    expect(scoreAttack(forecast({ damage: 4 }, counter(2)))).toBe(4 - COUNTER_WEIGHT * 2);
  });

  it('prefers a target that can’t counter, all else equal', () => {
    expect(scoreAttack(forecast({ damage: 4 }))).toBeGreaterThan(scoreAttack(forecast({ damage: 4 }, counter(2))));
  });

  it('avoids an attack whose counter could kill the attacker', () => {
    const suicidal = forecast({ damage: 2, health: 3 }, counter(3));
    const safe = forecast({ damage: 1, health: 3 });
    expect(scoreAttack(suicidal)).toBe(2 - COUNTER_WEIGHT * 3 - SUICIDE_PENALTY);
    expect(scoreAttack(suicidal)).toBeLessThan(scoreAttack(safe));
  });

  it('still takes a risky attack when it can kill', () => {
    const risky = forecast({ damage: 5, health: 3 }, { ...counter(3), health: 5 });
    expect(scoreAttack(risky)).toBeGreaterThan(0);
  });

  it('scores an attack that deals no damage as 0, never as a kill', () => {
    expect(scoreAttack(forecast({ damage: 0 }, { health: 0 }))).toBe(0);
  });

  it('adds a bonus for a soft target', () => {
    expect(scoreAttack(forecast({ damage: 4 }), { soft: true })).toBe(4 + SOFT_TARGET_BONUS);
  });
});

describe('isSoftTarget', () => {
  it('counts a unit fighting with magic', () => {
    expect(isSoftTarget({ weapon: FIRE })).toBe(true);
  });

  it('counts a healer carrying a staff', () => {
    expect(isSoftTarget({ weapon: null, items: createInventory([{ item: HEAL_STAFF, quantity: 20 }]) })).toBe(true);
  });

  it('does not count a physical fighter', () => {
    expect(isSoftTarget({ weapon: IRON_SPEAR, items: createInventory([{ item: HEALTH_POTION, quantity: 1 }]) })).toBe(
      false,
    );
  });

  it('does not count an unarmed unit with nothing in its pack', () => {
    expect(isSoftTarget({ weapon: null })).toBe(false);
  });
});

describe('createAttackScorer', () => {
  const stats = { skill: 0, speed: 0, luck: 0, strength: 3, defense: 0, health: 10, maxHealth: 10 };
  const archer = { ...stats, weapon: IRON_BOW };
  const foes: Record<string, Foe> = {
    spear: { ...stats, weapon: IRON_SPEAR },
    mage: { ...stats, weapon: FIRE },
  };
  const score = createAttackScorer(archer, (id) => foes[id]);

  it('scores the forecast at the distance between the tiles', () => {
    // At range 2 the spear can't counter the bow.
    const expected = scoreAttack(getCombatForecast(archer, foes.spear, { distance: 2 }));
    expect(score({ x: 0, y: 0 }, { x: 1, y: 1, unitId: 'spear' })).toBe(expected);
    expect(getCombatForecast(archer, foes.spear, { distance: 2 }).defender.counters).toBe(false);
  });

  it('marks soft targets', () => {
    const expected = scoreAttack(getCombatForecast(archer, foes.mage, { distance: 2 }), { soft: true });
    expect(score({ x: 0, y: 0 }, { x: 2, y: 0, unitId: 'mage' })).toBe(expected);
  });
});
