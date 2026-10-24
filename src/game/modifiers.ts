// Pure modifier rules: the one way bonuses reach the game's formulas. A
// modifier is plain data ({ kind, ... }) that a relic (warband/relics.ts),
// a level-up boon (warband/boons.ts) and, later, traits or elite enemies
// hand a unit. A unit carries its modifiers for a battle
// (`Unit.modifiers`), and the rules read them from there:
// - 'combat' adds to a combat term (hit, avoid, crit, damage dealt, or
//   `guard`, damage taken off each hit), always or only `when` a condition
//   holds; combat.ts sums them per exchange (getCombatBonus), so the
//   forecast and the roll always agree.
// - 'movement' and 'experience' change the unit's MOV and XP rate for the
//   battle (applyModifiers bakes them in).
// - 'kill-heal', 'phase-heal' and 'phase-mana' are triggers the battle's
//   commands (battle/commands.ts) fire on a kill or as the unit's phase
//   starts, and 'spare-weapon-on-kill' keeps a killing strike from
//   wearing the weapon.
// - 'skill' teaches the unit a skill on top of its class's (skills.ts).
// No Phaser, no hidden state.

import type { Skill } from './skills.ts';

// The combat terms a modifier can add to: hit, avoid and crit rates,
// damage dealt by each hit, and `guard`, damage taken off each hit.
export const COMBAT_TERMS = Object.freeze(['hit', 'avoid', 'crit', 'damage', 'guard'] as const);
export type CombatTerm = (typeof COMBAT_TERMS)[number];

// When a combat modifier applies: on the unit's own attack (`attacking`),
// on a foe's (`defending`), while it's under half its max HP (`wounded`),
// or against a monster (`vs-monster`). Checked once per exchange, as it
// starts.
export type ModifierCondition = 'attacking' | 'defending' | 'wounded' | 'vs-monster';

export type Modifier =
  | { kind: 'combat'; term: CombatTerm; amount: number; when?: ModifierCondition }
  | { kind: 'movement'; amount: number }
  // Percentage points added to the unit's XP rate (see scaleExperience).
  | { kind: 'experience'; percent: number }
  // HP healed by the unit when it defeats a foe.
  | { kind: 'kill-heal'; amount: number }
  // HP and MP the unit recovers as each of its team's phases starts.
  | { kind: 'phase-heal'; amount: number }
  | { kind: 'phase-mana'; amount: number }
  | { kind: 'spare-weapon-on-kill' }
  | { kind: 'skill'; skill: Skill };

export type ModifierKind = Modifier['kind'];

// The kinds whose amount sums up, by the field that holds it.
type Summable = Extract<Modifier, { amount: number } | { percent: number }>['kind'];

export type CombatBonus = Readonly<Record<CombatTerm, number>>;

export const NO_COMBAT_BONUS: CombatBonus = Object.freeze({ hit: 0, avoid: 0, crit: 0, damage: 0, guard: 0 });

// Where a unit stands as an exchange starts, for the conditions.
export interface CombatContext {
  attacking: boolean;
  wounded: boolean;
  vsMonster: boolean;
}

// Whether `condition` holds in `context`; no condition always holds.
export function isConditionMet(condition: ModifierCondition | undefined, context: CombatContext): boolean {
  switch (condition) {
    case undefined:
      return true;
    case 'attacking':
      return context.attacking;
    case 'defending':
      return !context.attacking;
    case 'wounded':
      return context.wounded;
    case 'vs-monster':
      return context.vsMonster;
  }
}

// The combat terms `modifiers` add up to in `context`: every combat
// modifier whose condition holds, summed per term (stacking freely).
export function getCombatBonus(modifiers: readonly Modifier[], context: CombatContext): CombatBonus {
  const bonus = { ...NO_COMBAT_BONUS };
  for (const modifier of modifiers) {
    if (modifier.kind === 'combat' && isConditionMet(modifier.when, context)) bonus[modifier.term] += modifier.amount;
  }
  return Object.freeze(bonus);
}

// The combat terms that hold whatever the exchange: the unconditional
// ones, e.g. for the unit info screen's rates.
export function getStandingCombatBonus(modifiers: readonly Modifier[]): CombatBonus {
  return getCombatBonus(
    modifiers.filter((modifier) => modifier.kind !== 'combat' || modifier.when === undefined),
    { attacking: false, wounded: false, vsMonster: false },
  );
}

// Whether a unit is under half its max HP (the `wounded` condition).
export function isWounded(unit: { health: number; maxHealth?: number }): boolean {
  return unit.maxHealth !== undefined && unit.health * 2 < unit.maxHealth;
}

// The total of every `kind` modifier's amount (or percent), 0 for none.
export function sumModifiers(modifiers: readonly Modifier[] | undefined, kind: Summable): number {
  let total = 0;
  for (const modifier of modifiers ?? []) {
    if (modifier.kind !== kind) continue;
    total += 'percent' in modifier ? modifier.percent : modifier.amount;
  }
  return total;
}

// Whether any of `modifiers` is of `kind`.
export function hasModifier(modifiers: readonly Modifier[] | undefined, kind: ModifierKind): boolean {
  return (modifiers ?? []).some((modifier) => modifier.kind === kind);
}

// The skills `modifiers` teach, in order, without repeats.
export function getModifierSkills(modifiers: readonly Modifier[] | undefined): Skill[] {
  const skills: Skill[] = [];
  for (const modifier of modifiers ?? []) {
    if (modifier.kind === 'skill' && !skills.some((skill) => skill.id === modifier.skill.id)) {
      skills.push(modifier.skill);
    }
  }
  return skills;
}

// What applyModifiers changes on a unit.
export interface Modifiable {
  modifiers: readonly Modifier[];
  movement: number;
  experienceRate: number;
}

// Gives `unit` `modifiers` on top of the ones it has, baking the
// movement and XP rate ones into its MOV and XP rate. Changes `unit`
// itself: use it on a unit freshly built for a battle (see restoreUnit in
// warband/run.ts), whose MOV and XP rate come from its class.
export function applyModifiers<T extends Modifiable>(unit: T, modifiers: readonly Modifier[]): T {
  if (modifiers.length === 0) return unit;
  unit.modifiers = Object.freeze([...unit.modifiers, ...modifiers]);
  unit.movement += sumModifiers(modifiers, 'movement');
  unit.experienceRate += sumModifiers(modifiers, 'experience');
  return unit;
}
