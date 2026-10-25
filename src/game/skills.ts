// Pure rules for unit skills. Each unit class has a skill tree: a list of
// { level, skill } entries, and a unit knows every skill in its class's
// tree whose level it has reached — so skills are gained by leveling up —
// then those of its secondary class's tree it has reached the same way (a
// second skill set taught at camp, Final Fantasy Tactics style, see
// warband/mentors.ts), plus any its modifiers teach it (a level-up boon,
// see modifiers.ts). Using a skill costs mana. No Phaser, no rendering, no
// hidden state.

import type { MenuAction } from './actionMenu.ts';
import {
  calculateDamage,
  DAMAGE_TYPES,
  getDamageType,
  getFighterBonus,
  type DamageStats,
  type SkillFighter,
} from './combat.ts';
import { getModifierSkills, type Modifier } from './modifiers.ts';

// A skill: { id, label, manaCost, range, animation, might?, damageScale? }.
// Its damage is a variant of the user's regular hit: `might` (default 0)
// is added to the user's attack power, and the resulting damage is
// multiplied by `damageScale` (default 1). `range` is how far away
// (orthogonal steps) the target can be, and `animation` names the effect
// the presentation layer plays for it. A skill whose `effect` is 'heal'
// deals no damage: it mends a wounded ally instead, restoring its `power`
// plus the user's magic (like a staff, see healing.ts).

export interface Skill {
  id: string;
  label: string;
  manaCost: number;
  range: number;
  animation: string;
  might?: number;
  damageScale?: number;
  effect?: 'heal';
  power?: number;
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

// A prayer that closes an adjacent ally's wounds without a staff: it
// restores 2 plus the user's magic, like the Heal staff.
export const MEND: Skill = Object.freeze({
  id: 'mend',
  label: 'Mend',
  manaCost: 3,
  range: 1,
  effect: 'heal',
  power: 2,
  animation: 'mend',
});

// The level each class's first skill unlocks at: a new unit starts with
// none and learns it on its first level up.
export const SKILL_UNLOCK_LEVEL = 2;

// unitClass -> [{ level, skill }]. Classes without an entry know no skills.
export const SKILL_TREES: SkillTrees = Object.freeze({
  warrior: Object.freeze([Object.freeze({ level: SKILL_UNLOCK_LEVEL, skill: THROW_STONES })]),
  soldier: Object.freeze([Object.freeze({ level: SKILL_UNLOCK_LEVEL, skill: POWER_STRIKE })]),
  archer: Object.freeze([Object.freeze({ level: SKILL_UNLOCK_LEVEL, skill: LONG_SHOT })]),
  vanguard: Object.freeze([Object.freeze({ level: SKILL_UNLOCK_LEVEL, skill: CLEAVE })]),
  guard: Object.freeze([Object.freeze({ level: SKILL_UNLOCK_LEVEL, skill: SHIELD_BASH })]),
  acolyte: Object.freeze([Object.freeze({ level: SKILL_UNLOCK_LEVEL, skill: MEND })]),
});

// Whether `unitClass` has any skills to teach, e.g. as a secondary class.
export function hasSkillTree(unitClass: string, trees: SkillTrees = SKILL_TREES): boolean {
  return treeOf(unitClass, trees).length > 0;
}

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

// What getUnitSkills reads off a unit. `secondaryClass` is the class whose
// skill set it has learned on top of its own, if any.
export interface SkillUser {
  unitClass: string | null;
  level: number;
  secondaryClass?: string | null;
  modifiers?: readonly Modifier[];
}

// The skills `unit` knows from its secondary class: that class's tree at
// the unit's own level, as if it were its own. None without one, or when
// the secondary is its own class.
export function getSecondarySkills(unit: SkillUser, trees: SkillTrees = SKILL_TREES): Skill[] {
  const { secondaryClass } = unit;
  if (!secondaryClass || secondaryClass === unit.unitClass) return [];
  return getLearnedSkills(secondaryClass, unit.level, trees);
}

// Every skill `unit` knows: its class's at its level (getLearnedSkills),
// then its secondary class's (getSecondarySkills), then those its
// modifiers teach, each only once.
export function getUnitSkills(unit: SkillUser, trees: SkillTrees = SKILL_TREES): Skill[] {
  const skills: Skill[] = [];
  const all = [
    ...getLearnedSkills(unit.unitClass, unit.level, trees),
    ...getSecondarySkills(unit, trees),
    ...getModifierSkills(unit.modifiers),
  ];
  for (const skill of all) if (!skills.some(({ id }) => id === skill.id)) skills.push(skill);
  return skills;
}

// Finds a skill `unit` knows (getUnitSkills) by id, or null.
export function findUnitSkill(unit: SkillUser, skillId: string, trees: SkillTrees = SKILL_TREES): Skill | null {
  return getUnitSkills(unit, trees).find((skill) => skill.id === skillId) ?? null;
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
// have dealt damage still deals at least 1. Each side's modifiers count
// as in an exchange the user started (withCombatBonus). Never below zero.
// Skills don't spend weapon uses.
export function calculateSkillDamage(skill: Skill, user: SkillFighter, defender: SkillFighter): number {
  const { power } = DAMAGE_TYPES[getDamageType(user)];
  // Copied field by field: a Unit's weapon and armor are getters, which a
  // spread drops.
  const boosted: DamageStats = {
    strength: user.strength,
    magic: user.magic,
    weapon: user.weapon,
    bonus: getFighterBonus(user, defender, true),
  };
  boosted[power] = (user[power] ?? 0) + (skill.might ?? 0);
  const guarded: DamageStats = {
    defense: defender.defense,
    armorDefense: defender.armorDefense,
    resistance: defender.resistance,
    bonus: getFighterBonus(defender, user, false),
  };
  return Math.ceil(calculateDamage(boosted, guarded) * (skill.damageScale ?? 1));
}

// Whether `skill` mends an ally rather than striking a foe.
export function isHealingSkill(skill: Skill): boolean {
  return skill.effect === 'heal';
}

// HP a healing skill restores to `patient`: its power plus the user's
// magic, capped at what the patient is missing (never below 0).
export function getSkillHealAmount(
  skill: Skill,
  user: { magic: number },
  patient: { health: number; maxHealth: number },
): number {
  const missing = Math.max(0, patient.maxHealth - patient.health);
  return Math.max(0, Math.min((skill.power ?? 0) + user.magic, missing));
}

// One line on what `skill` does, e.g. for a lesson's or a boon's offer.
export function describeSkill(skill: Skill): string {
  const reach = skill.range === 1 ? 'next to it' : `up to ${skill.range} tiles away`;
  if (isHealingSkill(skill)) return `Heals an ally ${reach} for ${skill.power ?? 0} + MAG.`;
  const scale = skill.damageScale ?? 1;
  const hit = scale === 1 ? 'Its regular hit' : scale === 0.5 ? 'Half its regular hit' : `${scale}× its regular hit`;
  const might = skill.might ? ` with +${skill.might} power` : '';
  return `${hit}${might} on a foe ${reach}.`;
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
