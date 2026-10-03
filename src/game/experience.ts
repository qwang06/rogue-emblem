// Pure experience and growth rules, Fire Emblem style: a unit earns XP
// from each combat it survives (more for hitting, most for killing, scaled
// by how its level compares with its opponent's), every 100 XP is a level,
// and each level rolls the unit's growth rates to decide which stats rise.
// No Phaser, no hidden state; randomness comes in through an injected
// `rng` (() => [0, 1)). Applying the result to a Unit is the caller's job.

import type { CombatSide, Strike } from './combat.ts';
import type { Rng } from './combatStats.ts';
import { SKILL_TREES, getSkillsLearnedBetween, type Skill, type SkillTrees } from './skills.ts';

export const EXPERIENCE_PER_LEVEL = 100;
export const MAX_LEVEL = 20;
// XP for a combat in which the unit landed no damage (a miss, a 0-damage
// hit, or never getting to strike).
export const MISS_EXPERIENCE = 1;
// Extra XP for a kill against an opponent of the same level.
export const KILL_BONUS = 20;

// The stats a level up can raise, in the order they're rolled. Health and
// mana raise the unit's maximums.
export const GROWTH_STATS = Object.freeze([
  'health',
  'mana',
  'strength',
  'magic',
  'skill',
  'speed',
  'luck',
  'defense',
  'resistance',
] as const);

export type GrowthStat = (typeof GROWTH_STATS)[number];
// Growth stats other than health and mana, which are plain unit fields.
export type PlainGrowthStat = Exclude<GrowthStat, 'health' | 'mana'>;

// Per-stat numbers: growth rates (percent), caps, or gains.
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
  caps?: GrowthTable;
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
  if (strikes.some((s) => s.target === side && s.lethal)) return 'died';
  const own = strikes.filter((s) => s.by === side);
  if (own.some((s) => s.lethal)) return 'kill';
  if (own.some((s) => s.hit && s.damage > 0)) return 'hit';
  return 'miss';
}

// XP a unit of `level` earns from a combat against an opponent of
// `enemyLevel` that ended in `outcome` (see getCombatOutcome). Never more
// than one level's worth, and nothing at MAX_LEVEL or for a unit that died.
export function getCombatExperience(level: number, enemyLevel: number, outcome: CombatOutcome): number {
  if (level >= MAX_LEVEL || outcome === 'died') return 0;
  const amount =
    outcome === 'kill'
      ? getKillExperience(level, enemyLevel)
      : outcome === 'hit'
        ? getHitExperience(level, enemyLevel)
        : MISS_EXPERIENCE;
  return Math.min(EXPERIENCE_PER_LEVEL, amount);
}

// Adds `amount` XP to a unit at `level` with `experience`, carrying the
// overflow past each EXPERIENCE_PER_LEVEL into the next level. Stops at
// maxLevel, where experience stays 0. Returns { level, experience,
// levelsGained }.
export function addExperience(
  level: number,
  experience: number,
  amount: number,
  maxLevel = MAX_LEVEL,
): { level: number; experience: number; levelsGained: number } {
  if (level >= maxLevel) return { level, experience: 0, levelsGained: 0 };
  const total = experience + amount;
  const newLevel = Math.min(maxLevel, level + Math.floor(total / EXPERIENCE_PER_LEVEL));
  const newExperience = newLevel >= maxLevel ? 0 : total % EXPERIENCE_PER_LEVEL;
  return { level: newLevel, experience: newExperience, levelsGained: newLevel - level };
}

// A unit's current value of a growth stat (health and mana are its
// maximums).
export function getGrowthStatValue(unit: GrowthSource, stat: GrowthStat): number {
  if (stat === 'health') return unit.maxHealth;
  if (stat === 'mana') return unit.maxMana;
  return unit[stat] ?? 0;
}

// The stat gains for one level up, as { health, mana, strength, ... } (every
// GROWTH_STATS key, 0 when it didn't grow). Each stat rolls once, in
// GROWTH_STATS order: a growth rate of g% gains floor(g / 100) for sure plus
// one more with a (g mod 100)% chance. A stat with a cap in `caps` never
// rises past it. `stats` is the unit (see getGrowthStatValue); missing
// growths count as 0%.
export function rollLevelUp(stats: GrowthSource, growths: GrowthTable, rng: Rng, caps: GrowthTable = {}): StatGains {
  const gains = {} as StatGains;
  for (const stat of GROWTH_STATS) {
    const growth = growths[stat] ?? 0;
    const roll = Math.min(99, Math.floor(rng() * 100));
    const rolled = Math.floor(growth / 100) + (roll < growth % 100 ? 1 : 0);
    const room = Math.max(0, (caps[stat] ?? Infinity) - getGrowthStatValue(stats, stat));
    gains[stat] = Math.min(rolled, room);
  }
  return gains;
}

// Everything that happens when `unit` gains `amount` XP: its new level and
// experience, and one entry per level gained, in order, as { level, gains,
// stats, skills } — the level reached, the stat gains rolled for it (see
// rollLevelUp, against the unit's `growths` and `caps`), the growth stats'
// values after it, and the skills its class learns at it (from `trees`).
// Nothing is mutated. Returns { amount, level, experience, levelUps }.
export function resolveExperienceGain(
  unit: Experienced,
  amount: number,
  rng: Rng,
  trees: SkillTrees = SKILL_TREES,
): ExperienceGain {
  const result = addExperience(unit.level, unit.experience ?? 0, amount);
  const stats = Object.fromEntries(GROWTH_STATS.map((stat) => [stat, getGrowthStatValue(unit, stat)])) as StatGains;
  const levelUps: LevelUpResult[] = [];
  for (let level = unit.level + 1; level <= result.level; level++) {
    const current = { ...stats, maxHealth: stats.health, maxMana: stats.mana };
    const gains = rollLevelUp(current, unit.growths ?? {}, rng, unit.caps ?? {});
    for (const stat of GROWTH_STATS) stats[stat] += gains[stat];
    const skills = getSkillsLearnedBetween(unit.unitClass, level - 1, level, trees);
    levelUps.push({ level, gains, stats: { ...stats }, skills });
  }
  return { amount, level: result.level, experience: result.experience, levelUps };
}
