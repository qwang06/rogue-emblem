import { describe, expect, it } from 'vitest';
import {
  SKILL_TREES,
  THROW_GRENADE,
  calculateSkillDamage,
  canUseSkill,
  findLearnedSkill,
  getLearnedSkills,
  getSkillActions,
  getSkillsLearnedBetween,
} from './skills.js';

const bash = { id: 'bash', label: 'Bash', manaCost: 2 };
const rally = { id: 'rally', label: 'Rally', manaCost: 4 };
const cleave = { id: 'cleave', label: 'Cleave', manaCost: 6 };

const trees = {
  fighter: [
    { level: 1, skill: bash },
    { level: 3, skill: rally },
    { level: 5, skill: cleave },
  ],
  mage: [],
};

describe('SKILL_TREES', () => {
  it('teaches the soldier Throw Grenade at level 1', () => {
    expect(getLearnedSkills('soldier', 1)).toContain(THROW_GRENADE);
  });

  it('gives every entry a level of at least 1 and a skill with a mana cost', () => {
    for (const tree of Object.values(SKILL_TREES)) {
      for (const { level, skill } of tree) {
        expect(level).toBeGreaterThanOrEqual(1);
        expect(typeof skill.id).toBe('string');
        expect(skill.manaCost).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('getLearnedSkills', () => {
  it('returns the skills up to and including the given level, in tree order', () => {
    expect(getLearnedSkills('fighter', 1, trees)).toEqual([bash]);
    expect(getLearnedSkills('fighter', 3, trees)).toEqual([bash, rally]);
    expect(getLearnedSkills('fighter', 4, trees)).toEqual([bash, rally]);
    expect(getLearnedSkills('fighter', 99, trees)).toEqual([bash, rally, cleave]);
  });

  it('returns nothing below the first skill level', () => {
    expect(getLearnedSkills('fighter', 0, trees)).toEqual([]);
  });

  it('returns nothing for a class with an empty tree', () => {
    expect(getLearnedSkills('mage', 10, trees)).toEqual([]);
  });

  it('returns nothing for an unknown or missing class', () => {
    expect(getLearnedSkills('dragon', 10, trees)).toEqual([]);
    expect(getLearnedSkills(null, 10, trees)).toEqual([]);
  });

  it('uses SKILL_TREES by default', () => {
    expect(getLearnedSkills('soldier', 1)).toEqual(
      SKILL_TREES.soldier.filter((e) => e.level <= 1).map((e) => e.skill),
    );
  });
});

describe('getSkillsLearnedBetween', () => {
  it('returns skills gained by leveling from one level to another', () => {
    expect(getSkillsLearnedBetween('fighter', 2, 3, trees)).toEqual([rally]);
    expect(getSkillsLearnedBetween('fighter', 1, 5, trees)).toEqual([rally, cleave]);
  });

  it('returns nothing for a level up that crosses no skill', () => {
    expect(getSkillsLearnedBetween('fighter', 3, 4, trees)).toEqual([]);
  });

  it('returns nothing when the level does not rise', () => {
    expect(getSkillsLearnedBetween('fighter', 3, 3, trees)).toEqual([]);
  });

  it('returns nothing for an unknown class', () => {
    expect(getSkillsLearnedBetween('dragon', 0, 10, trees)).toEqual([]);
  });
});

describe('canUseSkill', () => {
  it('allows a skill the unit has enough mana for', () => {
    expect(canUseSkill({ mana: 5 }, rally)).toBe(true);
  });

  it('allows a skill that costs exactly the remaining mana', () => {
    expect(canUseSkill({ mana: 4 }, rally)).toBe(true);
  });

  it('refuses a skill the unit cannot afford', () => {
    expect(canUseSkill({ mana: 3 }, rally)).toBe(false);
    expect(canUseSkill({ mana: 0 }, bash)).toBe(false);
  });

  it('allows a free skill with no mana', () => {
    expect(canUseSkill({ mana: 0 }, { id: 'free', label: 'Free', manaCost: 0 })).toBe(true);
  });
});

describe('getSkillActions', () => {
  it('lists each skill with its cost, disabling the ones the unit cannot afford', () => {
    const actions = getSkillActions({ mana: 5 }, [bash, rally, cleave]);
    expect(actions).toEqual([
      { id: 'bash', label: 'Bash', manaCost: 2, disabled: false },
      { id: 'rally', label: 'Rally', manaCost: 4, disabled: false },
      { id: 'cleave', label: 'Cleave', manaCost: 6, disabled: true },
    ]);
  });

  it('returns frozen entries', () => {
    const actions = getSkillActions({ mana: 5 }, [bash]);
    expect(Object.isFrozen(actions)).toBe(true);
    expect(Object.isFrozen(actions[0])).toBe(true);
  });

  it('returns an empty list for no skills', () => {
    expect(getSkillActions({ mana: 5 }, [])).toEqual([]);
  });
});

describe('THROW_GRENADE', () => {
  it('reaches 2 tiles and costs mana', () => {
    expect(THROW_GRENADE.range).toBe(2);
    expect(THROW_GRENADE.manaCost).toBeGreaterThan(0);
    expect(THROW_GRENADE.label).toBe('Throw Grenade');
  });

  it('is affordable for a fresh soldier (5 mana) exactly once', () => {
    const soldier = { mana: 5 };
    expect(canUseSkill(soldier, THROW_GRENADE)).toBe(true);
    expect(canUseSkill({ mana: soldier.mana - THROW_GRENADE.manaCost }, THROW_GRENADE)).toBe(false);
  });
});

describe('findLearnedSkill', () => {
  it('finds a known skill by id', () => {
    expect(findLearnedSkill('fighter', 3, 'rally', trees)).toBe(rally);
  });

  it('returns null for a skill not learned yet', () => {
    expect(findLearnedSkill('fighter', 2, 'rally', trees)).toBeNull();
  });

  it('returns null for an unknown id or class', () => {
    expect(findLearnedSkill('fighter', 99, 'fireball', trees)).toBeNull();
    expect(findLearnedSkill('dragon', 99, 'bash', trees)).toBeNull();
  });
});

describe('calculateSkillDamage', () => {
  const skill = { id: 'boom', label: 'Boom', manaCost: 1, range: 2, power: 6 };

  it('is power minus the target defense', () => {
    expect(calculateSkillDamage(skill, { defense: 2 })).toBe(4);
  });

  it('never goes below zero', () => {
    expect(calculateSkillDamage(skill, { defense: 10 })).toBe(0);
  });

  it('deals full power to a target with no defense', () => {
    expect(calculateSkillDamage(skill, { defense: 0 })).toBe(6);
  });
});
