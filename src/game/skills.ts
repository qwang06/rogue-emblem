// Pure rules for unit skills. Each unit class has a skill tree: a list of
// { level, skill } entries, and a unit knows every skill in its class's
// tree whose level it has reached — so skills are gained by leveling up.
// Using a skill costs mana. No Phaser, no rendering, no hidden state.

import type { MenuAction } from './actionMenu.ts';
import { calculateDamage, DAMAGE_TYPES, getDamageType, type DamageStats } from './combat.ts';

// A skill: { id, label, manaCost, range, animation, might?, damageScale? }.
// Its damage is a variant of the user's regular hit: `might` (default 0)
// is added to the user's attack power, and the resulting damage is
// multiplied by `damageScale` (default 1). `range` is how far away
// (orthogonal steps) the target can be, and `animation` names the effect
// the presentation layer plays for it.

export interface Skill {
  id: string;
  label: string;
  manaCost: number;
  range: number;
  animation: string;
  might?: number;
  damageScale?: number;
}

export interface SkillTreeEntry {
  level: number;
  skill: Skill;
}

export type SkillTrees = Readonly<Record<string, readonly SkillTreeEntry[]>>;

export interface SkillAction extends MenuAction {
  manaCost: number;
}

// The tree for unitClass; a class without one (or no class) has none.
function treeOf(unitClass: string | null, trees: SkillTrees): readonly SkillTreeEntry[] {
  return (unitClass !== null && trees[unitClass]) || [];
}

// Stones lobbed at a distant foe: half the damage of the user's regular
// attack, from up to 4 tiles away.
export const THROW_STONES: Skill = Object.freeze({
  id: 'throw-stones',
  label: 'Throw Stones',
  manaCost: 2,
  range: 4,
  damageScale: 0.5,
  animation: 'stone',
});

// A heavier blow against an adjacent foe: the user's regular attack with
// 3 more power behind it.
export const POWER_STRIKE: Skill = Object.freeze({
  id: 'power-strike',
  label: 'Power Strike',
  manaCost: 2,
  range: 1,
  might: 3,
  animation: 'strike',
});

// An arrow loosed from further off than the bow reaches: the user's
// regular attack from up to 3 tiles away. Like every skill it can't be
// countered, and it can hit an adjacent foe the bow can't. Flies like a
// thrown stone until it gets an arrow of its own.
export const LONG_SHOT: Skill = Object.freeze({
  id: 'long-shot',
  label: 'Long Shot',
  manaCost: 2,
  range: 3,
  animation: 'stone',
});

// A wild overhead swing against an adjacent foe: the user's regular
// attack with 2 more power behind it.
export const CLEAVE: Skill = Object.freeze({
  id: 'cleave',
  label: 'Cleave',
  manaCost: 2,
  range: 1,
  might: 2,
  animation: 'strike',
});

// A ball of flame hurled at a foe up to 3 tiles away: the user's regular
// spell with 1 more power behind it. Flies like a thrown stone until it
// gets an animation of its own.
export const FIREBALL: Skill = Object.freeze({
  id: 'fireball',
  label: 'Fireball',
  manaCost: 3,
  range: 3,
  might: 1,
  animation: 'stone',
});

// A shove with the tower shield behind the spear: the user's regular
// attack with 1 more power behind it, against an adjacent foe.
export const SHIELD_BASH: Skill = Object.freeze({
  id: 'shield-bash',
  label: 'Shield Bash',
  manaCost: 2,
  range: 1,
  might: 1,
  animation: 'strike',
});

// unitClass -> [{ level, skill }]. Classes without an entry know no skills.
export const SKILL_TREES: SkillTrees = Object.freeze({
  villager: Object.freeze([Object.freeze({ level: 1, skill: THROW_STONES })]),
  soldier: Object.freeze([Object.freeze({ level: 1, skill: POWER_STRIKE })]),
  archer: Object.freeze([Object.freeze({ level: 1, skill: LONG_SHOT })]),
  vanguard: Object.freeze([Object.freeze({ level: 1, skill: CLEAVE })]),
  wizard: Object.freeze([Object.freeze({ level: 1, skill: FIREBALL })]),
  guard: Object.freeze([Object.freeze({ level: 1, skill: SHIELD_BASH })]),
});

// Every skill a unit of unitClass knows at the given level, in tree order.
export function getLearnedSkills(unitClass: string | null, level: number, trees: SkillTrees = SKILL_TREES): Skill[] {
  const tree = treeOf(unitClass, trees);
  return tree.filter((entry) => entry.level <= level).map((entry) => entry.skill);
}

// Skills newly learned by going from fromLevel up to toLevel, e.g. to
// announce them on level up.
export function getSkillsLearnedBetween(
  unitClass: string | null,
  fromLevel: number,
  toLevel: number,
  trees: SkillTrees = SKILL_TREES,
): Skill[] {
  const tree = treeOf(unitClass, trees);
  return tree.filter((entry) => entry.level > fromLevel && entry.level <= toLevel).map((entry) => entry.skill);
}

// Finds a skill the unit knows by id, or null.
export function findLearnedSkill(
  unitClass: string | null,
  level: number,
  skillId: string,
  trees: SkillTrees = SKILL_TREES,
): Skill | null {
  return getLearnedSkills(unitClass, level, trees).find((skill) => skill.id === skillId) ?? null;
}

// Damage a skill deals when `user` uses it on `defender`: the user's
// regular hit (calculateDamage, of its weapon's damage type and with its
// weapon's might) with the skill's `might` added to its attack power,
// times its `damageScale`, rounded up — so a scaled-down hit that would
// have dealt damage still deals at least 1. Never below zero. Skills
// don't spend weapon uses.
export function calculateSkillDamage(skill: Skill, user: DamageStats, defender: DamageStats): number {
  const { power } = DAMAGE_TYPES[getDamageType(user)];
  // Copied field by field: a Unit's weapon is a getter, which a spread drops.
  const boosted: DamageStats = { strength: user.strength, magic: user.magic, weapon: user.weapon };
  boosted[power] = (user[power] ?? 0) + (skill.might ?? 0);
  return Math.ceil(calculateDamage(boosted, defender) * (skill.damageScale ?? 1));
}

export function canUseSkill(unit: { mana: number }, skill: Skill): boolean {
  return unit.mana >= skill.manaCost;
}

// Entries for the skill menu: each skill with its cost, disabled if the
// unit can't afford it.
export function getSkillActions(unit: { mana: number }, skills: readonly Skill[]): readonly SkillAction[] {
  return Object.freeze(
    skills.map((skill) =>
      Object.freeze({
        id: skill.id,
        label: skill.label,
        manaCost: skill.manaCost,
        disabled: !canUseSkill(unit, skill),
      }),
    ),
  );
}
