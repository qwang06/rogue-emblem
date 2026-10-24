import { describe, expect, it } from 'vitest';
import { Acolyte } from '../Acolyte.ts';
import { createSeededRng } from '../rng.ts';
import { POWER_STRIKE } from '../skills.ts';
import { Soldier } from '../Soldier.ts';
import { applyModifiers } from '../modifiers.ts';
import {
  BOON_CHOICES,
  BOONS,
  findBoon,
  getBoonModifiers,
  getStatBoonGain,
  HEALTH_BOON_AMOUNT,
  isBoonEligible,
  rollBoons,
  STAT_BOON_AMOUNT,
  takeBoon,
} from './boons.ts';

const soldier = (level = 2) => new Soldier({ name: 'Alden', team: 'player', level });
const boon = (id: string) => findBoon(id)!;

describe('BOONS', () => {
  it('has unique ids and every kind', () => {
    expect(new Set(BOONS.map((b) => b.id)).size).toBe(BOONS.length);
    expect(new Set(BOONS.map((b) => b.kind))).toEqual(new Set(['stat', 'skill', 'passive']));
  });
});

describe('getBoonModifiers', () => {
  it("is the boons' modifiers in order, skipping stat boons and unknown ids", () => {
    expect(getBoonModifiers(['stat-strength', 'fleet', 'nope', 'keen-eye'])).toEqual([
      ...boon('fleet').modifiers,
      ...boon('keen-eye').modifiers,
    ]);
  });
});

describe('isBoonEligible', () => {
  it('offers stat boons below the cap only', () => {
    const unit = soldier();
    expect(isBoonEligible(unit, boon('stat-speed'))).toBe(true);
    unit.speed = unit.caps.speed!;
    expect(isBoonEligible(unit, boon('stat-speed'))).toBe(false);
  });

  it('offers STR to physical fighters and MAG to casters', () => {
    expect(isBoonEligible(soldier(), boon('stat-strength'))).toBe(true);
    expect(isBoonEligible(soldier(), boon('stat-magic'))).toBe(false);
    const acolyte = new Acolyte({ team: 'player' });
    expect(isBoonEligible(acolyte, boon('stat-magic'))).toBe(true);
  });

  it("offers skills the unit doesn't know and passives it hasn't taken", () => {
    expect(isBoonEligible(soldier(), boon('skill-power-strike'))).toBe(false);
    expect(isBoonEligible(soldier(1), boon('skill-cleave'))).toBe(true);
    const unit = soldier();
    takeBoon(unit, boon('fleet'));
    expect(isBoonEligible(unit, boon('fleet'))).toBe(false);
    expect(isBoonEligible(unit, boon('nimble'))).toBe(true);
  });

  it("doesn't offer a skill a boon already taught", () => {
    const unit = soldier();
    applyModifiers(unit, boon('skill-cleave').modifiers);
    expect(isBoonEligible(unit, boon('skill-cleave'))).toBe(false);
  });
});

describe('rollBoons', () => {
  it('offers a stat boon, a skill and a passive, all eligible and different', () => {
    for (let seed = 0; seed < 30; seed++) {
      const offers = rollBoons(soldier(), createSeededRng(seed));
      expect(offers).toHaveLength(BOON_CHOICES);
      expect(offers.map((b) => b.kind)).toEqual(['stat', 'skill', 'passive']);
      expect(new Set(offers).size).toBe(BOON_CHOICES);
      for (const offer of offers) expect(isBoonEligible(soldier(), offer)).toBe(true);
    }
  });

  it('offers a second passive when there is no skill left to learn', () => {
    const unit = soldier();
    for (const id of ['skill-cleave', 'skill-shield-bash', 'skill-throw-stones']) {
      applyModifiers(unit, boon(id).modifiers);
    }
    const offers = rollBoons(unit, createSeededRng(3));
    expect(offers.map((b) => b.kind)).toEqual(['stat', 'passive', 'passive']);
  });

  it('is the same for the same rolls', () => {
    expect(rollBoons(soldier(), createSeededRng(9))).toEqual(rollBoons(soldier(), createSeededRng(9)));
  });

  it('offers fewer once nearly everything is taken', () => {
    const unit = soldier();
    unit.boons = BOONS.filter((b) => b.kind === 'passive').map((b) => b.id);
    for (const stat of ['maxHealth', 'strength', 'skill', 'speed', 'luck', 'defense', 'resistance'] as const) {
      unit[stat] = 99;
    }
    for (const id of ['skill-cleave', 'skill-shield-bash', 'skill-throw-stones']) {
      applyModifiers(unit, boon(id).modifiers);
    }
    expect(rollBoons(unit, createSeededRng(1))).toEqual([]);
  });
});

describe('takeBoon', () => {
  it('raises the stat, up to the cap, and records the boon', () => {
    const unit = soldier();
    const strength = unit.strength;
    takeBoon(unit, boon('stat-strength'));
    expect(unit.strength).toBe(strength + STAT_BOON_AMOUNT);
    unit.strength = unit.caps.strength! - 1;
    expect(getStatBoonGain(unit, boon('stat-strength'))).toBe(1);
    takeBoon(unit, boon('stat-strength'));
    expect(unit.strength).toBe(unit.caps.strength);
    expect(unit.boons).toEqual(['stat-strength', 'stat-strength']);
  });

  it('raises max HP and current HP together', () => {
    const unit = soldier();
    unit.health = 3;
    const maxHealth = unit.maxHealth;
    takeBoon(unit, boon('stat-health'));
    expect(unit.maxHealth).toBe(maxHealth + HEALTH_BOON_AMOUNT);
    expect(unit.health).toBe(3 + HEALTH_BOON_AMOUNT);
  });

  it('records a skill or passive without changing stats', () => {
    const unit = soldier();
    const before = { ...unit };
    takeBoon(unit, boon('skill-cleave'));
    expect(unit.boons).toEqual(['skill-cleave']);
    expect(unit.strength).toBe(before.strength);
    expect(boon('skill-power-strike').modifiers).toEqual([{ kind: 'skill', skill: POWER_STRIKE }]);
  });
});
