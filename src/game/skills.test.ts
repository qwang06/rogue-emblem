import { describe, expect, it } from 'vitest';
import {
  SKILL_TREES,
  SKILL_UNLOCK_LEVEL,
  THROW_STONES,
  POWER_STRIKE,
  CLEAVE,
  SHIELD_BASH,
  CLASS_SKILL_PICKS,
  RECKLESS_SWING,
  SAVAGE_BITE,
  BULWARK,
  PHALANX,
  TAILWIND,
  WARD,
  MARK,
  PINNING_SHOT,
  ROAR,
  SUNDER,
  BARRAGE,
  getFollowUpDamage,
  getSkillAreaTiles,
  PIERCING_SHOT,
  PRAYER,
  SHRAPNEL,
  SKEWER,
  TANDEM_STRIKE,
  DEADEYE,
  getClassSkillPicks,
  LUNGE,
  SMITE,
  WING_BUFFET,
  SHOVE,
  calculateSkillDamage,
  canUseSkill,
  findUnitSkill,
  getUnitSkills,
  getLearnedSkills,
  getSkillActions,
  getSkillsLearnedBetween,
  BLAST,
  describeSkill,
  getSecondarySkills,
  getSkillForecast,
  getSkillHealAmount,
  hasSkillTree,
  isHealingSkill,
  MEND,
  type Skill,
  type SkillTrees,
} from './skills.ts';
import { isPromotedClass, PROMOTIONS } from './promotions.ts';
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
  it('teaches the soldier Shove from the start and Shield Bash at level 2, its first level up', () => {
    expect(getLearnedSkills('soldier', 1)).toEqual([SHOVE]);
    expect(getSkillsLearnedBetween('soldier', 1, 2)).toEqual([THROW_STONES, SHIELD_BASH]);
  });

  it('teaches the villager Throw Stones at level 2, its first level up', () => {
    expect(getLearnedSkills('villager', 1)).toEqual([]);
    expect(getSkillsLearnedBetween('villager', 1, 2)).toEqual([THROW_STONES]);
  });

  it('teaches every base class nothing at level 1 but a Shove, and its skill at SKILL_UNLOCK_LEVEL', () => {
    for (const [unitClass, tree] of Object.entries(SKILL_TREES)) {
      if (isPromotedClass(unitClass)) continue;
      const shoves = ['soldier', 'guard'].includes(unitClass);
      expect(getLearnedSkills(unitClass, 1), unitClass).toEqual(shoves ? [SHOVE] : []);
      expect(
        tree.map((entry) => entry.level),
        unitClass,
      ).toEqual(shoves ? [1, SKILL_UNLOCK_LEVEL] : [SKILL_UNLOCK_LEVEL]);
    }
    expect(SKILL_UNLOCK_LEVEL).toBe(2);
  });

  it('gives every promoted class a tree of its own, learned from level 1 or 2', () => {
    for (const promotion of PROMOTIONS) {
      const tree = SKILL_TREES[promotion.id];
      expect(tree.length, promotion.id).toBeGreaterThan(0);
      for (const { level } of tree) expect(level, promotion.id).toBeLessThanOrEqual(SKILL_UNLOCK_LEVEL);
    }
    expect(getLearnedSkills('sapper', SKILL_UNLOCK_LEVEL)).toEqual([THROW_STONES, BLAST]);
  });

  it("keeps the villager's skills in every promoted class's tree, and each class's own skills to it", () => {
    for (const promotion of PROMOTIONS) {
      expect(getLearnedSkills(promotion.id, 20), promotion.id).toContain(THROW_STONES);
    }
    expect(getLearnedSkills('villager', 20)).not.toContain(SHIELD_BASH);
    expect(getLearnedSkills('archer', 20)).not.toContain(SHIELD_BASH);
    expect(getLearnedSkills('acolyte', 20)).not.toContain(THROW_STONES);
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

    it("adds might to the user's intelligence for a magical hit", () => {
      const mage = { strength: 0, intelligence: 5, weapon: { type: 'magical' as const, might: 0 } };
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

describe('getUnitSkills', () => {
  it("is the class's skills, then those modifiers teach that it lacks", () => {
    const soldier = { unitClass: 'soldier', level: 2 };
    expect(getUnitSkills(soldier)).toEqual([THROW_STONES, SHOVE, SHIELD_BASH]);
    const taught = { ...soldier, modifiers: [{ kind: 'skill', skill: CLEAVE } as const] };
    expect(getUnitSkills(taught)).toEqual([THROW_STONES, SHOVE, SHIELD_BASH, CLEAVE]);
    const repeat = { ...soldier, modifiers: [{ kind: 'skill', skill: SHIELD_BASH } as const] };
    expect(getUnitSkills(repeat)).toEqual([THROW_STONES, SHOVE, SHIELD_BASH]);
    expect(findUnitSkill(taught, 'cleave')).toBe(CLEAVE);
    expect(findUnitSkill(soldier, 'cleave')).toBeNull();
  });

  it('teaches a skill even before the class unlocks its own', () => {
    expect(getUnitSkills({ unitClass: 'villager', level: 1, modifiers: [{ kind: 'skill', skill: CLEAVE }] })).toEqual([
      CLEAVE,
    ]);
  });
});

describe('getSecondarySkills', () => {
  it("is the secondary class's skills at the unit's own level", () => {
    expect(getSecondarySkills({ unitClass: 'archer', level: 2, secondaryClass: 'acolyte' })).toEqual([MEND]);
    expect(getSecondarySkills({ unitClass: 'fighter', level: 3, secondaryClass: 'fighter' }, trees)).toEqual([]);
    expect(getSecondarySkills({ unitClass: 'mage', level: 3, secondaryClass: 'fighter' }, trees)).toEqual([
      bash,
      rally,
    ]);
  });

  it("is nothing below the set's first level, without a secondary, or for a class with no tree", () => {
    expect(getSecondarySkills({ unitClass: 'archer', level: 1, secondaryClass: 'acolyte' })).toEqual([]);
    expect(getSecondarySkills({ unitClass: 'archer', level: 5 })).toEqual([]);
    expect(getSecondarySkills({ unitClass: 'archer', level: 5, secondaryClass: null })).toEqual([]);
    expect(getSecondarySkills({ unitClass: 'fighter', level: 5, secondaryClass: 'mage' }, trees)).toEqual([]);
  });

  it("joins getUnitSkills after the class's own and before taught ones, without repeats", () => {
    const soldier = { unitClass: 'soldier', level: 2, secondaryClass: 'vanguard' };
    expect(getUnitSkills(soldier)).toEqual([THROW_STONES, SHOVE, SHIELD_BASH, CLEAVE]);
    const taught = { ...soldier, modifiers: [{ kind: 'skill', skill: CLEAVE } as const] };
    expect(getUnitSkills(taught)).toEqual([THROW_STONES, SHOVE, SHIELD_BASH, CLEAVE]);
    expect(findUnitSkill(soldier, 'cleave')).toBe(CLEAVE);
  });
});

describe('hasSkillTree', () => {
  it('is true for a class with skills to teach', () => {
    expect(hasSkillTree('acolyte')).toBe(true);
    expect(hasSkillTree('fighter', trees)).toBe(true);
  });

  it('is false for an empty, unknown or monster tree', () => {
    expect(hasSkillTree('mage', trees)).toBe(false);
    expect(hasSkillTree('dragon', trees)).toBe(false);
    expect(hasSkillTree('slime')).toBe(false);
  });
});

describe('getSkillAreaTiles', () => {
  const from = { x: 2, y: 2 };
  it('is nothing for a skill without an area', () => {
    expect(getSkillAreaTiles(TANDEM_STRIKE, from, { x: 3, y: 2 })).toEqual([]);
  });

  it('reaches either side of the target, across the line from the user', () => {
    expect(getSkillAreaTiles(CLEAVE, from, { x: 3, y: 2 })).toEqual([
      { x: 3, y: 3 },
      { x: 3, y: 1 },
    ]);
    expect(getSkillAreaTiles(CLEAVE, from, { x: 2, y: 1 })).toEqual([
      { x: 1, y: 1 },
      { x: 3, y: 1 },
    ]);
  });

  it('reaches the tile behind the target, along the longer axis', () => {
    expect(getSkillAreaTiles(PIERCING_SHOT, from, { x: 2, y: 5 })).toEqual([{ x: 2, y: 6 }]);
    expect(getSkillAreaTiles(PIERCING_SHOT, from, { x: 4, y: 3 })).toEqual([{ x: 5, y: 3 }]);
    expect(getSkillAreaTiles(SKEWER, from, { x: 1, y: 2 })).toEqual([{ x: 0, y: 2 }]);
  });

  it('bursts to the four tiles around the target, never the user', () => {
    expect(getSkillAreaTiles(BARRAGE, from, { x: 2, y: 4 })).toEqual([
      { x: 2, y: 3 },
      { x: 3, y: 4 },
      { x: 2, y: 5 },
      { x: 1, y: 4 },
    ]);
    expect(getSkillAreaTiles(SHRAPNEL, from, { x: 3, y: 2 })).toHaveLength(3);
    expect(getSkillAreaTiles(PRAYER, from, from)).toHaveLength(4);
  });
});

describe('getFollowUpDamage', () => {
  it('is the followUp share of the first blow, rounded up, and nothing without one', () => {
    expect(getFollowUpDamage(TANDEM_STRIKE, 5)).toBe(3);
    expect(getFollowUpDamage(TANDEM_STRIKE, 0)).toBe(0);
    expect(getFollowUpDamage(CLEAVE, 5)).toBe(0);
  });

  it('adds the second blow to the forecast while the first leaves the foe standing', () => {
    const user = { strength: 5, health: 10, maxHealth: 10 };
    expect(getSkillForecast(TANDEM_STRIKE, user, { defense: 0, health: 20, maxHealth: 20 }).attacker.damage).toBe(8);
    expect(getSkillForecast(TANDEM_STRIKE, user, { defense: 0, health: 4, maxHealth: 20 }).attacker.damage).toBe(5);
  });
});

describe('PRAYER', () => {
  it("heals 1 plus half the user's INT, rounded down", () => {
    expect(getSkillHealAmount(PRAYER, { intelligence: 5 }, { health: 1, maxHealth: 20 })).toBe(3);
  });
});

describe('getClassSkillPicks', () => {
  it("is the class's own level-up skill picks, and none for a class without any", () => {
    expect(getClassSkillPicks('soldier')).toEqual([LUNGE, PHALANX]);
    expect(getClassSkillPicks('acolyte')).toEqual([SMITE, PRAYER, WARD]);
    expect(getClassSkillPicks('beast-rider')).toEqual([SKEWER, TANDEM_STRIKE]);
    expect(getClassSkillPicks('beast')).toEqual([WING_BUFFET, ROAR]);
    expect(getClassSkillPicks('archer')).toEqual([PIERCING_SHOT, PINNING_SHOT]);
    expect(getClassSkillPicks('vanguard')).toEqual([SUNDER, RECKLESS_SWING]);
    expect(getClassSkillPicks('siege')).toEqual([DEADEYE]);
    expect(getClassSkillPicks('scout')).toEqual([MARK, TAILWIND]);
    expect(getClassSkillPicks('ram')).toEqual([BULWARK]);
    expect(getClassSkillPicks('villager')).toEqual([]);
    expect(getClassSkillPicks(null)).toEqual([]);
  });

  it('never repeats a skill the class learns by level', () => {
    for (const [unitClass, picks] of Object.entries(CLASS_SKILL_PICKS)) {
      const tree = getLearnedSkills(unitClass, 99).map(({ id }) => id);
      for (const skill of picks) expect(tree, unitClass).not.toContain(skill.id);
    }
  });
});

describe('SHIELD_BASH and WING_BUFFET', () => {
  it('strike and then push', () => {
    expect(SHIELD_BASH).toMatchObject({ might: 1, push: true, range: 1 });
    expect(WING_BUFFET).toMatchObject({ damageScale: 0.5, push: true, range: 1 });
  });
});

describe('describeSkill', () => {
  it('says what each kind of skill does and how far it reaches', () => {
    expect(describeSkill(MEND)).toBe('Heals an ally next to it for 2 + INT.');
    expect(describeSkill(POWER_STRIKE)).toBe('Its regular hit with +3 power on a foe next to it.');
    expect(describeSkill(SHIELD_BASH)).toBe(
      'Its regular hit with +1 power on a foe next to it, then pushes it a tile away.',
    );
    expect(describeSkill(SHOVE)).toBe('Pushes a foe next to it a tile away.');
    expect(describeSkill(CLEAVE)).toBe('Its regular hit on a foe next to it and those on either side of it.');
    expect(describeSkill(SHRAPNEL)).toBe(
      'Half its regular hit on a foe up to 2 tiles away and the four tiles around it, allies included.',
    );
    expect(describeSkill(TANDEM_STRIKE)).toBe('Its regular hit on a foe next to it, then a second hit for half that.');
    expect(describeSkill(PRAYER)).toBe('Heals every wounded ally next to it for 1 + half INT.');
    expect(describeSkill(SUNDER)).toBe(
      'Its regular hit with +2 power on a foe next to it, leaving it Sundered (takes 3 more damage from every hit).',
    );
    expect(describeSkill(PHALANX)).toBe(
      'Leaves every ally next to it Guarded (takes 2 less damage from every hit) until your next phase.',
    );
    expect(describeSkill(TAILWIND)).toBe('Leaves an ally next to it Hastened (+2 MOV) until your next phase.');
    expect(describeSkill(SAVAGE_BITE)).toBe('Its regular hit on a foe next to it, healing it for half the damage.');
    expect(describeSkill(RECKLESS_SWING)).toBe('Its regular hit with +6 power on a foe next to it, costing it 3 HP.');
    expect(describeSkill(SMITE)).toBe(
      'Its regular hit with +3 power (+3 more against monsters) on a foe up to 2 tiles away.',
    );
    expect(describeSkill(MARK)).toBe('Leaves a foe up to 3 tiles away Marked (15 less avoid).');
    expect(describeSkill(ROAR)).toBe("Leaves every foe next to it Rooted (can't move).");
    expect(describeSkill(THROW_STONES)).toBe('Half its regular hit on a foe up to 4 tiles away.');
    expect(describeSkill({ ...THROW_STONES, damageScale: 1.5 })).toBe(
      '1.5× its regular hit on a foe up to 4 tiles away.',
    );
  });
});

describe('MEND', () => {
  it('heals rather than strikes', () => {
    expect(isHealingSkill(MEND)).toBe(true);
    expect(isHealingSkill(POWER_STRIKE)).toBe(false);
  });

  it("restores its power plus the user's intelligence, capped at what's missing", () => {
    expect(getSkillHealAmount(MEND, { intelligence: 3 }, { health: 1, maxHealth: 20 })).toBe(5);
    expect(getSkillHealAmount(MEND, { intelligence: 0 }, { health: 1, maxHealth: 20 })).toBe(2);
    expect(getSkillHealAmount(MEND, { intelligence: 3 }, { health: 18, maxHealth: 20 })).toBe(2);
    expect(getSkillHealAmount(MEND, { intelligence: 3 }, { health: 20, maxHealth: 20 })).toBe(0);
  });

  it('heals nothing with no power and no intelligence', () => {
    expect(getSkillHealAmount({ ...MEND, power: undefined }, { intelligence: 0 }, { health: 1, maxHealth: 20 })).toBe(
      0,
    );
  });
});

describe('calculateSkillDamage with modifiers', () => {
  const user = { strength: 5, weapon: { type: 'physical' as const, might: 0 } };
  const defender = { defense: 1 };

  it("adds the user's attacking damage bonus and the target's guard", () => {
    const base = calculateSkillDamage(POWER_STRIKE, user, defender);
    const brawler = { ...user, modifiers: [{ kind: 'combat', term: 'damage', amount: 3, when: 'attacking' } as const] };
    expect(calculateSkillDamage(POWER_STRIKE, brawler, defender)).toBe(base + 3);
    const stalwart = {
      ...defender,
      modifiers: [{ kind: 'combat', term: 'guard', amount: 2, when: 'defending' } as const],
    };
    expect(calculateSkillDamage(POWER_STRIKE, user, stalwart)).toBe(base - 2);
  });

  it('counts vs-monster bonuses against a monster', () => {
    const hunter = { ...user, modifiers: [{ kind: 'combat', term: 'damage', amount: 3, when: 'vs-monster' } as const] };
    const base = calculateSkillDamage(POWER_STRIKE, user, defender);
    expect(calculateSkillDamage(POWER_STRIKE, hunter, defender)).toBe(base);
    expect(calculateSkillDamage(POWER_STRIKE, hunter, { ...defender, monster: true })).toBe(base + 3);
  });
});

describe('getSkillForecast', () => {
  const user = { health: 10, maxHealth: 10, strength: 4, defense: 2 };
  const defender = { health: 9, maxHealth: 10, strength: 4, defense: 2 };

  it('forecasts a guaranteed single hit with no counterattack', () => {
    expect(getSkillForecast(POWER_STRIKE, user, defender)).toEqual({
      attacker: {
        health: 10,
        maxHealth: 10,
        damage: 5,
        hit: 100,
        crit: 0,
        strikes: 1,
        counters: true,
      },
      defender: {
        health: 9,
        maxHealth: 10,
        damage: null,
        hit: null,
        crit: null,
        strikes: 0,
        counters: false,
      },
    });
  });

  it('includes push hazard or bump damage on a Shove, and full HP when drowning', () => {
    expect(getSkillForecast(SHOVE, user, defender, { damage: 0, drowned: false }).attacker.damage).toBe(0);
    expect(getSkillForecast(SHOVE, user, defender, { damage: 5, drowned: false }).attacker.damage).toBe(5);
    expect(getSkillForecast(SHOVE, user, defender, { damage: 0, drowned: true }).attacker.damage).toBe(9);
  });
});
