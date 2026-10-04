import { describe, expect, it } from 'vitest';
import {
  SKILL_TREES,
  THROW_STONES,
  POWER_STRIKE,
  calculateSkillDamage,
  canUseSkill,
  findLearnedSkill,
  getLearnedSkills,
  getSkillActions,
  getSkillsLearnedBetween,
  type Skill,
  type SkillTrees,
} from './skills.ts';
import { Soldier } from './Soldier.ts';

// A skill with the fields a test doesn't care about filled in.
const makeSkill = (fields: Pick<Skill, 'id' | 'label' | 'manaCost'> & Partial<Skill>): Skill => ({
  range: 1,
  animation: 'strike',
  ...fields,
});

const bash = makeSkill({ id: 'bash', label: 'Bash', manaCost: 2 });
const rally = makeSkill({ id: 'rally', label: 'Rally', manaCost: 4 });
const cleave = makeSkill({ id: 'cleave', label: 'Cleave', manaCost: 6 });

const trees: SkillTrees = {
  fighter: [
    { level: 1, skill: bash },
    { level: 3, skill: rally },
    { level: 5, skill: cleave },
  ],
  mage: [],
};

describe('SKILL_TREES', () => {
  it('teaches the soldier Power Strike at level 1', () => {
    expect(getLearnedSkills('soldier', 1)).toEqual([POWER_STRIKE]);
  });

  it('teaches the villager Throw Stones at level 1', () => {
    expect(getLearnedSkills('villager', 1)).toEqual([THROW_STONES]);
  });

  it('keeps each skill to its own class', () => {
    expect(getLearnedSkills('villager', 20)).not.toContain(POWER_STRIKE);
    expect(getLearnedSkills('soldier', 20)).not.toContain(THROW_STONES);
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
    expect(getLearnedSkills('soldier', 20)).toEqual(SKILL_TREES.soldier.map((e) => e.skill));
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
    expect(canUseSkill({ mana: 0 }, makeSkill({ id: 'free', label: 'Free', manaCost: 0 }))).toBe(true);
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

describe('THROW_STONES', () => {
  it('reaches 4 tiles and costs mana', () => {
    expect(THROW_STONES.range).toBe(4);
    expect(THROW_STONES.manaCost).toBeGreaterThan(0);
    expect(THROW_STONES.label).toBe('Throw Stones');
  });

  it('deals half the damage of a regular attack, rounded up', () => {
    const villager = { strength: 4, defense: 2 };
    expect(calculateSkillDamage(THROW_STONES, villager, { defense: 2 })).toBe(1); // regular: 2
    expect(calculateSkillDamage(THROW_STONES, villager, { defense: 1 })).toBe(2); // regular: 3
    expect(calculateSkillDamage(THROW_STONES, villager, { defense: 0 })).toBe(2); // regular: 4
  });

  it('deals nothing where a regular attack would', () => {
    expect(calculateSkillDamage(THROW_STONES, { strength: 2 }, { defense: 5 })).toBe(0);
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

describe('POWER_STRIKE', () => {
  it('reaches adjacent tiles and costs mana', () => {
    expect(POWER_STRIKE.range).toBe(1);
    expect(POWER_STRIKE.manaCost).toBeGreaterThan(0);
    expect(POWER_STRIKE.label).toBe('Power Strike');
  });

  it('hits harder than a regular attack', () => {
    const soldier = { strength: 4, defense: 2 };
    expect(calculateSkillDamage(POWER_STRIKE, soldier, soldier)).toBe(5); // regular: 2
  });

  it('is affordable for a fresh soldier (5 mana) twice', () => {
    expect(canUseSkill({ mana: 5 - POWER_STRIKE.manaCost }, POWER_STRIKE)).toBe(true);
    expect(canUseSkill({ mana: 5 - 2 * POWER_STRIKE.manaCost }, POWER_STRIKE)).toBe(false);
  });
});

describe('calculateSkillDamage', () => {
  it('is the regular hit for a plain skill', () => {
    const skill = makeSkill({ id: 'jab', label: 'Jab', manaCost: 1, range: 1 });
    expect(calculateSkillDamage(skill, { strength: 6 }, { defense: 2 })).toBe(4);
  });

  it('scales the damage, rounding up', () => {
    const skill = makeSkill({ id: 'tap', label: 'Tap', manaCost: 1, range: 1, damageScale: 0.5 });
    expect(calculateSkillDamage(skill, { strength: 7 }, { defense: 2 })).toBe(3);
    expect(calculateSkillDamage(skill, { strength: 2 }, { defense: 2 })).toBe(0);
  });

  it('applies might before scaling', () => {
    const skill = makeSkill({ id: 'combo', label: 'Combo', manaCost: 1, range: 1, might: 2, damageScale: 0.5 });
    expect(calculateSkillDamage(skill, { strength: 4 }, { defense: 2 })).toBe(2);
  });

  describe('with might', () => {
    const strike = makeSkill({ id: 'smash', label: 'Smash', manaCost: 1, range: 1, might: 3 });

    it("adds might to the user's strength for a physical hit", () => {
      expect(calculateSkillDamage(strike, { strength: 4 }, { defense: 2 })).toBe(5);
    });

    it("adds might to the user's magic for a magical hit", () => {
      const mage = { strength: 0, magic: 5, weapon: { type: 'magical' as const, might: 0 } };
      expect(calculateSkillDamage(strike, mage, { defense: 20, resistance: 1 })).toBe(7);
    });

    it("builds on the weapon's might, as the regular hit does", () => {
      const soldier = new Soldier({ team: 'enemy' });
      // 4 STR + 1 Iron Spear might + 3 skill might − 2 DEF.
      expect(calculateSkillDamage(strike, soldier, { defense: 2 })).toBe(6);
    });

    it('never goes below zero', () => {
      expect(calculateSkillDamage(strike, { strength: 1 }, { defense: 10 })).toBe(0);
    });

    it('does not mutate the user', () => {
      const user = { strength: 4 };
      calculateSkillDamage(strike, user, { defense: 0 });
      expect(user.strength).toBe(4);
    });
  });
});
