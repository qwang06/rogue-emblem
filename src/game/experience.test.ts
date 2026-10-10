import { describe, expect, it } from 'vitest';
import {
  GROWTH_STATS,
  KILL_BONUS,
  EXPERIENCE_PER_LEVEL,
  FIRST_LEVEL_EXPERIENCE,
  getExperienceForLevel,
  MAX_LEVEL,
  MISS_EXPERIENCE,
  addExperience,
  getCombatAward,
  getCombatExperience,
  getExperienceToNextLevel,
  getCombatOutcome,
  getGrowthStatValue,
  getHitExperience,
  getKillExperience,
  resolveExperienceGain,
  rollLevelUp,
  scaleExperience,
  type Experienced,
} from './experience.ts';
import type { CombatSide, Strike } from './combat.ts';
import { POWER_STRIKE } from './skills.ts';

// Plays back the given rolls (as fractions) in order, then repeats the last.
const rolls = (...values: number[]) => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
};
const allGrowths = (rate: number) => Object.fromEntries(GROWTH_STATS.map((stat) => [stat, rate]));
const noGains = Object.fromEntries(GROWTH_STATS.map((stat) => [stat, 0]));

const strike = (by: CombatSide, stats: Partial<Strike> = {}): Strike => ({
  by,
  target: by === 'attacker' ? 'defender' : 'attacker',
  damage: 3,
  hit: true,
  crit: false,
  lethal: false,
  ...stats,
});

describe('getHitExperience', () => {
  it('is 10 against an equal level', () => {
    expect(getHitExperience(1, 1)).toBe(10);
    expect(getHitExperience(10, 10)).toBe(10);
  });

  it('rises against higher levels and falls against lower ones', () => {
    expect(getHitExperience(1, 4)).toBe(11);
    expect(getHitExperience(1, 10)).toBe(13);
    expect(getHitExperience(10, 1)).toBe(7);
  });

  it('never drops below 1', () => {
    expect(getHitExperience(40, 1)).toBe(1);
  });
});

describe('getKillExperience', () => {
  it('adds the kill bonus to the hit XP at an equal level', () => {
    expect(getKillExperience(5, 5)).toBe(10 + KILL_BONUS);
  });

  it('adds 3 per level the opponent is above', () => {
    expect(getKillExperience(1, 3)).toBe(getHitExperience(1, 3) + KILL_BONUS + 6);
  });

  it('shrinks the bonus against lower levels but never below the hit XP', () => {
    expect(getKillExperience(5, 3)).toBe(9 + KILL_BONUS - 6);
    expect(getKillExperience(15, 1)).toBe(getHitExperience(15, 1));
  });
});

describe('getCombatOutcome', () => {
  it('is a kill when the side lands a lethal strike', () => {
    expect(getCombatOutcome([strike('attacker', { lethal: true })], 'attacker')).toBe('kill');
  });

  it('is died when the side is killed, even after hitting', () => {
    const strikes = [strike('attacker'), strike('defender', { lethal: true })];
    expect(getCombatOutcome(strikes, 'attacker')).toBe('died');
    expect(getCombatOutcome(strikes, 'defender')).toBe('kill');
  });

  it('is a hit when the side lands damage', () => {
    const strikes = [strike('attacker', { hit: false, damage: 0 }), strike('defender')];
    expect(getCombatOutcome(strikes, 'defender')).toBe('hit');
    expect(getCombatOutcome(strikes, 'attacker')).toBe('miss');
  });

  it('counts a 0-damage hit as a miss', () => {
    expect(getCombatOutcome([strike('attacker', { damage: 0 })], 'attacker')).toBe('miss');
  });

  it('is a miss for a defender that never struck', () => {
    expect(getCombatOutcome([strike('attacker')], 'defender')).toBe('miss');
  });
});

describe('getCombatExperience', () => {
  it('gives each outcome its XP', () => {
    expect(getCombatExperience(1, 1, 'miss')).toBe(MISS_EXPERIENCE);
    expect(getCombatExperience(1, 1, 'hit')).toBe(10);
    expect(getCombatExperience(1, 1, 'kill')).toBe(30);
    expect(getCombatExperience(1, 1, 'died')).toBe(0);
  });

  it('scales with the level gap', () => {
    expect(getCombatExperience(1, 5, 'kill')).toBe(getKillExperience(1, 5));
    expect(getCombatExperience(8, 2, 'hit')).toBe(getHitExperience(8, 2));
  });

  it('caps a single combat at one level', () => {
    expect(getCombatExperience(2, 30, 'kill')).toBe(EXPERIENCE_PER_LEVEL);
    expect(getCombatExperience(1, 30, 'kill')).toBe(FIRST_LEVEL_EXPERIENCE);
  });

  it('gives nothing at the max level', () => {
    expect(getCombatExperience(MAX_LEVEL, 30, 'kill')).toBe(0);
  });
});

describe('getExperienceForLevel', () => {
  it('is FIRST_LEVEL_EXPERIENCE from level 1 to 2, then EXPERIENCE_PER_LEVEL', () => {
    expect(getExperienceForLevel(1)).toBe(FIRST_LEVEL_EXPERIENCE);
    expect(FIRST_LEVEL_EXPERIENCE).toBeLessThan(EXPERIENCE_PER_LEVEL);
    expect(getExperienceForLevel(2)).toBe(EXPERIENCE_PER_LEVEL);
    expect(getExperienceForLevel(MAX_LEVEL - 1)).toBe(EXPERIENCE_PER_LEVEL);
  });
});

describe('addExperience', () => {
  it('adds XP within a level', () => {
    expect(addExperience(2, 20, 30)).toEqual({ level: 2, experience: 50, levelsGained: 0 });
    expect(addExperience(1, 20, 20)).toEqual({ level: 1, experience: 40, levelsGained: 0 });
  });

  it('levels up at exactly 100', () => {
    expect(addExperience(2, 70, 30)).toEqual({ level: 3, experience: 0, levelsGained: 1 });
  });

  it('levels up from 1 to 2 at only 50', () => {
    expect(addExperience(1, 20, 30)).toEqual({ level: 2, experience: 0, levelsGained: 1 });
    expect(addExperience(1, 40, 25)).toEqual({ level: 2, experience: 15, levelsGained: 1 });
  });

  it('carries the overflow', () => {
    expect(addExperience(3, 90, 25)).toEqual({ level: 4, experience: 15, levelsGained: 1 });
  });

  it('gains several levels at once', () => {
    expect(addExperience(2, 50, 260)).toEqual({ level: 5, experience: 10, levelsGained: 3 });
    expect(addExperience(1, 20, 260)).toEqual({ level: 4, experience: 30, levelsGained: 3 });
  });

  it('stops at the max level with no XP left over', () => {
    expect(addExperience(MAX_LEVEL - 1, 90, 50)).toEqual({ level: MAX_LEVEL, experience: 0, levelsGained: 1 });
    expect(addExperience(MAX_LEVEL, 0, 50)).toEqual({ level: MAX_LEVEL, experience: 0, levelsGained: 0 });
  });

  it('honors a custom max level', () => {
    expect(addExperience(4, 0, 300, 5)).toEqual({ level: 5, experience: 0, levelsGained: 1 });
  });

  it('changes nothing for 0 XP', () => {
    expect(addExperience(2, 40, 0)).toEqual({ level: 2, experience: 40, levelsGained: 0 });
  });
});

describe('getGrowthStatValue', () => {
  it('reads maximums for health and mana', () => {
    const unit = { health: 3, maxHealth: 10, mana: 1, maxMana: 5, strength: 4 };
    expect(getGrowthStatValue(unit, 'health')).toBe(10);
    expect(getGrowthStatValue(unit, 'mana')).toBe(5);
    expect(getGrowthStatValue(unit, 'strength')).toBe(4);
    expect(getGrowthStatValue(unit, 'luck')).toBe(0);
  });
});

describe('rollLevelUp', () => {
  const stats = {
    maxHealth: 10,
    maxMana: 5,
    strength: 4,
    magic: 0,
    skill: 3,
    speed: 3,
    luck: 2,
    defense: 2,
    resistance: 0,
  };

  it('raises nothing at 0% growths', () => {
    expect(rollLevelUp(stats, allGrowths(0), () => 0)).toEqual(noGains);
  });

  it('raises everything at 100% growths', () => {
    const gains = rollLevelUp(stats, allGrowths(100), () => 0.999);
    for (const stat of GROWTH_STATS) expect(gains[stat]).toBe(1);
  });

  it('rolls each stat in order against its growth', () => {
    // health 50% rolls 49 (up), mana 50% rolls 50 (no), strength 50% rolls 0 (up), rest roll 99.
    const gains = rollLevelUp(stats, allGrowths(50), rolls(0.49, 0.5, 0, 0.99));
    expect(gains).toEqual({ ...noGains, health: 1, strength: 1 });
  });

  it('treats missing growths as 0%', () => {
    expect(rollLevelUp(stats, { strength: 100 }, () => 0)).toEqual({ ...noGains, strength: 1 });
  });

  it('gives a guaranteed point per 100% and rolls the rest', () => {
    expect(rollLevelUp(stats, { health: 150 }, () => 0.4).health).toBe(2);
    expect(rollLevelUp(stats, { health: 150 }, () => 0.6).health).toBe(1);
  });

  it('never raises a stat past its cap', () => {
    // @ts-expect-error maxHealth isn't a growth stat, so it can't be capped
    const gains = rollLevelUp(stats, allGrowths(200), () => 0, { strength: 5, skill: 3, maxHealth: 0 });
    expect(gains.strength).toBe(1);
    expect(gains.skill).toBe(0);
    expect(gains.health).toBe(2); // caps are keyed by growth stat, not maxHealth
  });

  it('caps health and mana by their maximums', () => {
    expect(rollLevelUp(stats, { health: 100, mana: 100 }, () => 0, { health: 10, mana: 6 })).toMatchObject({
      health: 0,
      mana: 1,
    });
  });

  it('does not mutate the stats', () => {
    const copy = { ...stats };
    rollLevelUp(copy, allGrowths(100), () => 0);
    expect(copy).toEqual(stats);
  });
});

describe('scaleExperience', () => {
  it('leaves XP alone at the default rate', () => {
    expect(scaleExperience(10)).toBe(10);
    expect(scaleExperience(37, 100)).toBe(37);
  });

  it('scales XP by the rate, rounding to the nearest point', () => {
    expect(scaleExperience(10, 150)).toBe(15);
    expect(scaleExperience(11, 150)).toBe(17);
    expect(scaleExperience(31, 150)).toBe(47);
    expect(scaleExperience(10, 50)).toBe(5);
  });

  it('never rounds a positive gain down to nothing', () => {
    expect(scaleExperience(1, 10)).toBe(1);
    expect(scaleExperience(1, 0)).toBe(1);
  });

  it('gives nothing for nothing', () => {
    expect(scaleExperience(0, 150)).toBe(0);
    expect(scaleExperience(-5, 150)).toBe(0);
  });
});

describe('resolveExperienceGain', () => {
  const unit = (overrides: Partial<Experienced> = {}): Experienced => ({
    unitClass: null,
    level: 1,
    experience: 0,
    maxHealth: 10,
    maxMana: 5,
    strength: 4,
    magic: 0,
    skill: 3,
    speed: 3,
    luck: 2,
    defense: 2,
    resistance: 0,
    growths: allGrowths(100),
    caps: {},
    ...overrides,
  });

  it('adds XP without leveling', () => {
    expect(resolveExperienceGain(unit(), 30, () => 0)).toEqual({ amount: 30, level: 1, experience: 30, levelUps: [] });
  });

  it("scales the gain by the unit's XP rate and reports what it earned", () => {
    expect(resolveExperienceGain(unit({ experienceRate: 150 }), 30, () => 0)).toEqual({
      amount: 45,
      level: 1,
      experience: 45,
      levelUps: [],
    });
    const result = resolveExperienceGain(unit({ experience: 40, experienceRate: 150 }), 20, () => 0);
    expect(result).toMatchObject({ amount: 30, level: 2, experience: 20 });
    expect(result.levelUps).toHaveLength(1);
  });

  it('rolls one level up per level gained, with the running stats', () => {
    const result = resolveExperienceGain(unit({ experience: 40 }), 120, () => 0);
    expect(result.level).toBe(3);
    expect(result.experience).toBe(10);
    expect(result.levelUps.map((l) => l.level)).toEqual([2, 3]);
    expect(result.levelUps[0].stats.health).toBe(11);
    expect(result.levelUps[1].stats).toMatchObject({ health: 12, strength: 6, resistance: 2 });
  });

  it('applies caps across consecutive level ups', () => {
    const result = resolveExperienceGain(unit({ caps: { strength: 5 } }), 200, () => 0);
    expect(result.levelUps.map((l) => l.gains.strength)).toEqual([1, 0]);
  });

  it('lists the skills learned at each new level', () => {
    const trees = { soldier: [{ level: 3, skill: POWER_STRIKE }] };
    const result = resolveExperienceGain(unit({ unitClass: 'soldier' }), 200, () => 0, { trees });
    expect(result.levelUps.map((l) => l.skills)).toEqual([[], [POWER_STRIKE]]);
  });

  it('skips the XP rate for an unscaled gain', () => {
    const result = resolveExperienceGain(unit({ experienceRate: 150 }), 50, () => 0, { scaled: false });
    expect(result).toMatchObject({ amount: 50, level: 2, experience: 0 });
  });

  it('does not mutate the unit', () => {
    const original = unit();
    resolveExperienceGain(original, 250, () => 0);
    expect(original).toEqual(unit());
  });
});

describe('getExperienceToNextLevel', () => {
  it('is what is left of the current level', () => {
    expect(getExperienceToNextLevel(1, 0)).toBe(FIRST_LEVEL_EXPERIENCE);
    expect(getExperienceToNextLevel(1, 35)).toBe(15);
    expect(getExperienceToNextLevel(4, 73)).toBe(27);
  });

  it('is 0 at the top level', () => {
    expect(getExperienceToNextLevel(MAX_LEVEL, 0)).toBe(0);
  });
});

describe('getCombatAward', () => {
  it("is getCombatExperience's XP, scaled, for an ordinary opponent", () => {
    expect(getCombatAward({ level: 1 }, { level: 1 }, 'kill')).toEqual({
      amount: getCombatExperience(1, 1, 'kill'),
      scaled: true,
    });
    expect(getCombatAward({ level: 3 }, { level: 1, levelUpOnKill: false }, 'hit')).toEqual({
      amount: getCombatExperience(3, 1, 'hit'),
      scaled: true,
    });
  });

  it('is exactly the XP to the next level, unscaled, for killing a levelUpOnKill opponent', () => {
    const opponent = { level: 1, levelUpOnKill: true };
    expect(getCombatAward({ level: 1, experience: 0 }, opponent, 'kill')).toEqual({ amount: 50, scaled: false });
    expect(getCombatAward({ level: 5, experience: 64 }, opponent, 'kill')).toEqual({ amount: 36, scaled: false });
  });

  it('lands every XP rate on the next level with 0 XP', () => {
    for (const experienceRate of [50, 100, 150]) {
      const leveller = { unitClass: null, level: 1, experience: 30, maxHealth: 10, maxMana: 0, experienceRate };
      const { amount, scaled } = getCombatAward(leveller, { level: 1, levelUpOnKill: true }, 'kill');
      expect(resolveExperienceGain(leveller, amount, () => 0, { scaled })).toMatchObject({ level: 2, experience: 0 });
    }
  });

  it('gives the usual XP for anything short of a kill on a levelUpOnKill opponent', () => {
    const opponent = { level: 1, levelUpOnKill: true };
    expect(getCombatAward({ level: 1 }, opponent, 'hit')).toEqual({
      amount: getCombatExperience(1, 1, 'hit'),
      scaled: true,
    });
    expect(getCombatAward({ level: 1 }, opponent, 'died')).toEqual({ amount: 0, scaled: true });
  });

  it('gives nothing at the top level', () => {
    expect(getCombatAward({ level: MAX_LEVEL }, { level: 1, levelUpOnKill: true }, 'kill').amount).toBe(0);
  });
});
