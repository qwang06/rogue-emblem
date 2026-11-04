// Pure experience and growth rules, Fire Emblem style: a unit earns XP
// from each combat it survives (more for hitting, most for killing, scaled
// by how its level compares with its opponent's), every 100 XP is a level
// (only 50 for the first, from level 1 to 2), with no level cap, and each
// level raises the stats its class's growths set out for it, the same
// every time (no dice). No Phaser, no hidden state. Applying the result to
// a Unit is the caller's job.

import type { CombatSide, Strike } from './combat.ts';
import type { Unit } from './Unit.ts';
import { SKILL_TREES, getSkillsLearnedBetween, type Skill, type SkillTrees } from './skills.ts';
import { getGearModifiers, type Equipment } from './equipment.ts';
import { sumModifiers } from './modifiers.ts';

export const EXPERIENCE_PER_LEVEL = 100;
// The XP from level 1 to 2, less than the rest so a new unit's first
// level, and its first skill, come quickly.
export const FIRST_LEVEL_EXPERIENCE = 50;
// XP for a combat in which the unit landed no damage (a miss, a 0-damage
// hit, or never getting to strike).
export const MISS_EXPERIENCE = 1;
// Extra XP for a kill against an opponent of the same level.
export const KILL_BONUS = 20;
// The XP rate (percent of every gain) of a unit whose class doesn't set
// one. Villagers learn faster (see Villager.ts).
export const DEFAULT_EXPERIENCE_RATE = 100;

// The stats a level up can raise, in the order they're rolled. Health and
// mana raise the unit's maximums.
export const GROWTH_STATS = Object.freeze([
  'health',
  'mana',
  'strength',
  'intelligence',
  'dexterity',
  'speed',
  'luck',
  'defense',
  'resistance',
] as const);

export type GrowthStat = (typeof GROWTH_STATS)[number];
// Growth stats other than health and mana, which are plain unit fields.
export type PlainGrowthStat = Exclude<GrowthStat, 'health' | 'mana'>;

// Per-stat numbers: growth rates (percent) or gains.
export type GrowthTable = Partial<Record<GrowthStat, number>>;
export type StatGains = Record<GrowthStat, number>;

export type CombatOutcome = 'died' | 'kill' | 'hit' | 'miss';

// What a growth stat's value is read from: health and mana from their
// maximums, the rest from the stat itself (missing counts as 0).
export interface GrowthSource extends Partial<Record<PlainGrowthStat, number>> {
  maxHealth: number;
  maxMana: number;
}

// The unit fields resolveExperienceGain reads.
export interface Experienced extends GrowthSource {
  unitClass: string | null;
  level: number;
  experience?: number;
  growths?: GrowthTable;
  // Percent of each XP gain the unit actually earns (default
  // DEFAULT_EXPERIENCE_RATE); see scaleExperience. Its worn gear's
  // 'experience' modifiers add to it.
  experienceRate?: number;
  equipment?: Equipment;
}

export interface LevelUpResult {
  level: number;
  gains: StatGains;
  stats: StatGains;
  skills: Skill[];
}

export interface ExperienceGain {
  amount: number;
  level: number;
  experience: number;
  levelUps: LevelUpResult[];
}

// The XP a unit at `level` needs to reach the next one:
// FIRST_LEVEL_EXPERIENCE at level 1, EXPERIENCE_PER_LEVEL after.
export function getExperienceForLevel(level: number): number {
  return level <= 1 ? FIRST_LEVEL_EXPERIENCE : EXPERIENCE_PER_LEVEL;
}

// XP for landing damage on an opponent: 10 at an even level, one more for
// every three levels the opponent is above the unit (one less below),
// never under 1.
export function getHitExperience(level: number, enemyLevel: number): number {
  return Math.max(1, Math.floor((31 + enemyLevel - level) / 3));
}

// XP for a kill: the hit XP plus KILL_BONUS, which grows by 3 for every
// level the opponent is above the unit and shrinks by 3 below (never
// negative).
export function getKillExperience(level: number, enemyLevel: number): number {
  return getHitExperience(level, enemyLevel) + Math.max(0, KILL_BONUS + 3 * (enemyLevel - level));
}

// How a combat (a strike list from resolveCombat) went for one side
// ('attacker' | 'defender'): 'died' if it was killed, 'kill' if it killed
// its opponent, 'hit' if it landed any damage, otherwise 'miss'.
export function getCombatOutcome(strikes: readonly Strike[], side: CombatSide): CombatOutcome {
  if (strikes.some((s) => (s.target === side && s.lethal) || (s.by === side && s.recoilLethal))) return 'died';
  const own = strikes.filter((s) => s.by === side);
  if (own.some((s) => s.lethal) || strikes.some((s) => s.target === side && s.recoilLethal)) return 'kill';
  if (own.some((s) => s.hit && s.damage > 0)) return 'hit';
  return 'miss';
}

// XP a unit of `level` earns from a combat against an opponent of
// `enemyLevel` that ended in `outcome` (see getCombatOutcome). Never more
// than one level's worth, and nothing for a unit that died.
export function getCombatExperience(level: number, enemyLevel: number, outcome: CombatOutcome): number {
  if (outcome === 'died') return 0;
  const amount =
    outcome === 'kill'
      ? getKillExperience(level, enemyLevel)
      : outcome === 'hit'
        ? getHitExperience(level, enemyLevel)
        : MISS_EXPERIENCE;
  return Math.min(getExperienceForLevel(level), amount);
}

// The XP a unit at `level` with `experience` still needs for its next
// level.
export function getExperienceToNextLevel(level: number, experience: number): number {
  return Math.max(0, getExperienceForLevel(level) - experience);
}

// XP to give a unit, and whether its XP rate scales it (see
// resolveExperienceGain).
export interface ExperienceAward {
  amount: number;
  scaled: boolean;
}

// The opponent fields getCombatAward reads.
export interface ExperienceOpponent {
  level: number;
  // Killing it levels the killer up exactly (see getCombatAward).
  levelUpOnKill?: boolean;
}

// The XP `unit` earns from a combat against `opponent` that ended in
// `outcome`: getCombatExperience's, scaled by the unit's XP rate — except
// killing an opponent with levelUpOnKill, which earns exactly what the unit
// still needs for its next level, unscaled, so every class lands on the
// new level with 0 XP.
export function getCombatAward(
  unit: { level: number; experience?: number },
  opponent: ExperienceOpponent,
  outcome: CombatOutcome,
): ExperienceAward {
  if (outcome === 'kill' && opponent.levelUpOnKill) {
    return { amount: getExperienceToNextLevel(unit.level, unit.experience ?? 0), scaled: false };
  }
  return { amount: getCombatExperience(unit.level, opponent.level, outcome), scaled: true };
}

// `amount` XP scaled by an XP rate of `rate` percent, rounded to the
// nearest whole point but never below 1 for a positive gain. Nothing in
// gives nothing out.
export function scaleExperience(amount: number, rate: number = DEFAULT_EXPERIENCE_RATE): number {
  if (amount <= 0) return 0;
  return Math.max(1, Math.round((amount * rate) / 100));
}

// Adds `amount` XP to a unit at `level` with `experience`, carrying the
// overflow past each level's getExperienceForLevel into the next level.
// There's no level cap. Returns { level, experience, levelsGained }.
export function addExperience(
  level: number,
  experience: number,
  amount: number,
): { level: number; experience: number; levelsGained: number } {
  let newLevel = level;
  let newExperience = experience + amount;
  while (newExperience >= getExperienceForLevel(newLevel)) {
    newExperience -= getExperienceForLevel(newLevel);
    newLevel++;
  }
  return { level: newLevel, experience: newExperience, levelsGained: newLevel - level };
}

// A unit's current value of a growth stat (health and mana are its
// maximums).
export function getGrowthStatValue(unit: GrowthSource, stat: GrowthStat): number {
  if (stat === 'health') return unit.maxHealth;
  if (stat === 'mana') return unit.maxMana;
  return unit[stat] ?? 0;
}

// The stat gains for a unit's `step`-th level up (1 is the first, from
// level 1 to 2), as { health, mana, strength, ... } (every GROWTH_STATS key,
// 0 when it didn't grow). No dice: a growth of g means g/100 of a point a
// level (25 = one point every 4 levels, 100 = one every level), and each
// level up hands out the whole points the growth total has earned by then
// (floor(step × total / 100) in all), one at a time to the stat furthest
// behind its share (step × g / 100 less what it has had; ties to the higher
// growth, then GROWTH_STATS order). So every level gives about the same
// number of points, each stat stays within a point of its share, and the
// same growths and step always give the same gains. Stats have no caps.
// Missing or negative growths count as 0.
export function getLevelUpGains(growths: GrowthTable, step: number): StatGains {
  const rates = GROWTH_STATS.map((stat) => Math.max(0, growths[stat] ?? 0));
  const total = rates.reduce((sum, rate) => sum + rate, 0);
  const had = rates.map(() => 0);
  let gains = rates.map(() => 0);
  for (let level = 1; level <= Math.max(0, Math.floor(step)); level++) {
    gains = rates.map(() => 0);
    const points = Math.floor((level * total) / 100) - Math.floor(((level - 1) * total) / 100);
    for (let point = 0; point < points; point++) {
      let best = -1;
      let bestOwed = 0;
      rates.forEach((rate, i) => {
        if (rate <= 0) return;
        const owed = (level * rate) / 100 - had[i];
        if (best < 0 || owed > bestOwed || (owed === bestOwed && rate > rates[best])) {
          best = i;
          bestOwed = owed;
        }
      });
      had[best] += 1;
      gains[best] += 1;
    }
  }
  return Object.fromEntries(GROWTH_STATS.map((stat, i) => [stat, gains[i]])) as StatGains;
}

// Everything that happens when `unit` gains `amount` XP, scaled by its
// experienceRate (scaleExperience) unless `scaled` is false; `amount` in
// the result is what it actually earned: its new level and experience, and one entry per level gained, in order, as { level, gains,
// stats, skills } — the level reached, the stat gains for it (see
// getLevelUpGains, against the unit's `growths`), the growth stats'
// values after it, and the skills its class learns at it (from `trees`).
// Nothing is mutated. Returns { amount, level, experience, levelUps }.
export function resolveExperienceGain(
  unit: Experienced,
  amount: number,
  { trees = SKILL_TREES, scaled = true }: { trees?: SkillTrees; scaled?: boolean } = {},
): ExperienceGain {
  const gearRate = unit.equipment ? sumModifiers(getGearModifiers(unit.equipment), 'experience') : 0;
  const rate = (unit.experienceRate ?? DEFAULT_EXPERIENCE_RATE) + gearRate;
  const earned = scaled ? scaleExperience(amount, rate) : Math.max(0, amount);
  const result = addExperience(unit.level, unit.experience ?? 0, earned);
  const stats = Object.fromEntries(GROWTH_STATS.map((stat) => [stat, getGrowthStatValue(unit, stat)])) as StatGains;
  const levelUps: LevelUpResult[] = [];
  for (let level = unit.level + 1; level <= result.level; level++) {
    const gains = getLevelUpGains(unit.growths ?? {}, level - 1);
    for (const stat of GROWTH_STATS) stats[stat] += gains[stat];
    const skills = getSkillsLearnedBetween(unit.unitClass, level - 1, level, trees);
    levelUps.push({ level, gains, stats: { ...stats }, skills });
  }
  return { amount: earned, level: result.level, experience: result.experience, levelUps };
}

// Levels `unit` up to `level` on its growths (getLevelUpGains), one level
// up at a time, so its stats are the same for the same class and level
// every time. Does nothing when it's already there.
export function growToLevel(unit: Unit, level: number): void {
  for (let step = unit.level; step < level; step = unit.level) {
    unit.levelUp(getLevelUpGains(unit.growths, step));
  }
}
