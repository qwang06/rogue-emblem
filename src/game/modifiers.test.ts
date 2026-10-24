import { describe, expect, it } from 'vitest';
import {
  applyModifiers,
  getCombatBonus,
  getModifierSkills,
  getStandingCombatBonus,
  hasModifier,
  isConditionMet,
  isWounded,
  NO_COMBAT_BONUS,
  sumModifiers,
  type CombatContext,
  type Modifier,
} from './modifiers.ts';
import { CLEAVE, POWER_STRIKE } from './skills.ts';

const neutral: CombatContext = { attacking: false, wounded: false, vsMonster: false };

describe('isConditionMet', () => {
  it('always holds with no condition', () => {
    expect(isConditionMet(undefined, neutral)).toBe(true);
  });

  it('tells attacking from defending', () => {
    expect(isConditionMet('attacking', { ...neutral, attacking: true })).toBe(true);
    expect(isConditionMet('attacking', neutral)).toBe(false);
    expect(isConditionMet('defending', neutral)).toBe(true);
    expect(isConditionMet('defending', { ...neutral, attacking: true })).toBe(false);
  });

  it('checks being wounded and facing a monster', () => {
    expect(isConditionMet('wounded', { ...neutral, wounded: true })).toBe(true);
    expect(isConditionMet('wounded', neutral)).toBe(false);
    expect(isConditionMet('vs-monster', { ...neutral, vsMonster: true })).toBe(true);
    expect(isConditionMet('vs-monster', neutral)).toBe(false);
  });
});

describe('getCombatBonus', () => {
  it('is nothing with no modifiers', () => {
    expect(getCombatBonus([], neutral)).toEqual(NO_COMBAT_BONUS);
  });

  it('stacks modifiers on the same term and keeps terms apart', () => {
    const modifiers: Modifier[] = [
      { kind: 'combat', term: 'hit', amount: 15 },
      { kind: 'combat', term: 'hit', amount: -10 },
      { kind: 'combat', term: 'crit', amount: 15 },
      { kind: 'movement', amount: 1 },
    ];
    expect(getCombatBonus(modifiers, neutral)).toEqual({ ...NO_COMBAT_BONUS, hit: 5, crit: 15 });
  });

  it('only counts conditional modifiers whose condition holds', () => {
    const modifiers: Modifier[] = [
      { kind: 'combat', term: 'damage', amount: 2, when: 'attacking' },
      { kind: 'combat', term: 'guard', amount: 3, when: 'defending' },
      { kind: 'combat', term: 'damage', amount: 4, when: 'wounded' },
    ];
    expect(getCombatBonus(modifiers, { ...neutral, attacking: true })).toMatchObject({ damage: 2, guard: 0 });
    expect(getCombatBonus(modifiers, neutral)).toMatchObject({ damage: 0, guard: 3 });
    expect(getCombatBonus(modifiers, { attacking: true, wounded: true, vsMonster: false })).toMatchObject({
      damage: 6,
      guard: 0,
    });
  });
});

describe('getStandingCombatBonus', () => {
  it('leaves out every conditional modifier', () => {
    const modifiers: Modifier[] = [
      { kind: 'combat', term: 'avoid', amount: 15 },
      { kind: 'combat', term: 'guard', amount: 3, when: 'defending' },
      { kind: 'combat', term: 'damage', amount: 3, when: 'vs-monster' },
    ];
    expect(getStandingCombatBonus(modifiers)).toEqual({ ...NO_COMBAT_BONUS, avoid: 15 });
  });
});

describe('isWounded', () => {
  it('is under half max HP', () => {
    expect(isWounded({ health: 4, maxHealth: 10 })).toBe(true);
    expect(isWounded({ health: 5, maxHealth: 10 })).toBe(false);
    expect(isWounded({ health: 1 })).toBe(false);
  });
});

describe('sumModifiers and hasModifier', () => {
  const modifiers: Modifier[] = [
    { kind: 'kill-heal', amount: 4 },
    { kind: 'kill-heal', amount: 3 },
    { kind: 'experience', percent: 50 },
    { kind: 'spare-weapon-on-kill' },
  ];

  it('totals a kind, 0 when there is none', () => {
    expect(sumModifiers(modifiers, 'kill-heal')).toBe(7);
    expect(sumModifiers(modifiers, 'experience')).toBe(50);
    expect(sumModifiers(modifiers, 'phase-heal')).toBe(0);
    expect(sumModifiers(undefined, 'movement')).toBe(0);
  });

  it('finds a kind', () => {
    expect(hasModifier(modifiers, 'spare-weapon-on-kill')).toBe(true);
    expect(hasModifier(modifiers, 'phase-mana')).toBe(false);
    expect(hasModifier(undefined, 'skill')).toBe(false);
  });
});

describe('getModifierSkills', () => {
  it('lists taught skills once each, in order', () => {
    const modifiers: Modifier[] = [
      { kind: 'skill', skill: CLEAVE },
      { kind: 'movement', amount: 1 },
      { kind: 'skill', skill: POWER_STRIKE },
      { kind: 'skill', skill: CLEAVE },
    ];
    expect(getModifierSkills(modifiers)).toEqual([CLEAVE, POWER_STRIKE]);
    expect(getModifierSkills(undefined)).toEqual([]);
  });
});

describe('applyModifiers', () => {
  it('adds the modifiers and bakes in movement and XP rate', () => {
    const unit = { modifiers: [] as readonly Modifier[], movement: 4, experienceRate: 100 };
    const modifiers: Modifier[] = [
      { kind: 'movement', amount: 1 },
      { kind: 'experience', percent: 50 },
      { kind: 'combat', term: 'hit', amount: 15 },
    ];
    applyModifiers(unit, modifiers);
    expect(unit).toEqual({ modifiers, movement: 5, experienceRate: 150 });
    applyModifiers(unit, [{ kind: 'movement', amount: 1 }]);
    expect(unit.movement).toBe(6);
    expect(unit.modifiers).toHaveLength(4);
  });

  it('leaves a unit alone with no modifiers', () => {
    const unit = { modifiers: [] as readonly Modifier[], movement: 4, experienceRate: 100 };
    expect(applyModifiers(unit, [])).toEqual({ modifiers: [], movement: 4, experienceRate: 100 });
  });
});
