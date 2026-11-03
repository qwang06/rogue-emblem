// Pure modifier rules: the one way bonuses reach the game's formulas. A
// modifier is plain data ({ kind, ... }) that a relic (warband/relics.ts),
// a level-up boon (warband/boons.ts), an elite affix (warband/elites.ts)
// and, later, traits
// hand a unit. A unit carries its modifiers for a battle
// (`Unit.modifiers`), and the rules read them from there:
// - 'combat' adds to a combat term (hit, avoid, crit, damage dealt, or
//   `guard`, damage taken off each hit, and the percent terms
//   `damage-percent` and `guard-percent` that scale a hit's damage after
//   defense), always or only `when` a condition
//   holds; combat.ts sums them per exchange (getCombatBonus), so the
//   forecast and the roll always agree.
// - 'movement' and 'experience' change the unit's MOV and XP rate for the
//   battle (applyModifiers bakes them in).
// - 'kill-heal', 'phase-heal' and 'phase-mana' are triggers the battle's
//   commands (battle/commands.ts) fire on a kill or as the unit's phase
//   starts, and 'spare-weapon-on-kill' keeps a killing strike from
//   wearing the weapon.
// - 'skill' teaches the unit a skill on top of its class's (skills.ts).
// - The combat procs and gear effects (twin-strike through overkill-heal)
//   are read by resolveCombat and getFighterBonus in combat.ts, or by the
//   battle's commands for the map procs.
// No Phaser, no hidden state.

import type { Skill } from './skills.ts';
import type { StatusId } from './statuses.ts';

// The combat terms a modifier can add to: hit, avoid and crit rates,
// damage dealt by each hit, `guard`, damage taken off each hit, and the
// percent terms: `damage-percent` more damage dealt and `guard-percent`
// less damage taken, both applied after defense.
export const COMBAT_TERMS = Object.freeze([
  'hit',
  'avoid',
  'crit',
  'damage',
  'guard',
  'damage-percent',
  'guard-percent',
] as const);
export type CombatTerm = (typeof COMBAT_TERMS)[number];

// When a combat modifier applies: on the unit's own attack (`attacking`),
// on a foe's (`defending`), while it's under half its max HP (`wounded`),
// against a monster (`vs-monster`), against a foe under half its max HP
// (`vs-wounded`) or at full HP (`vs-unhurt`), or against a foe with any
// debuff (`vs-debuffed`) or Marked (`vs-marked`; see statuses.ts).
// Checked once per exchange, as it starts.
export type ModifierCondition =
  'attacking' | 'defending' | 'wounded' | 'vs-monster' | 'vs-wounded' | 'vs-unhurt' | 'vs-debuffed' | 'vs-marked';

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
  // Also as a share of its max HP, in percent, rounded down.
  | { kind: 'phase-heal-percent'; percent: number }
  | { kind: 'spare-weapon-on-kill' }
  | { kind: 'skill'; skill: Skill }
  // Combat procs (see resolveCombat in combat.ts). The percent chance each
  // of the unit's strikes is followed at once by another (`twin-strike`);
  // a foe its hit leaves at or under this percent of max HP falls
  // (`finisher`); the percent of the damage it deals it heals
  // (`lifesteal`).
  | { kind: 'twin-strike'; percent: number }
  | { kind: 'finisher'; percent: number }
  | { kind: 'lifesteal'; percent: number }
  // Map procs (see battle/commands.ts): each of the unit's hits also deals
  // this percent of its damage to the target's other foes beside it
  // (`cleave-through`); the percent chance a kill in its own attack earns
  // it a free strike, no counter, on another foe in reach (`chain-kill`).
  | { kind: 'cleave-through'; percent: number }
  | { kind: 'chain-kill'; percent: number }
  // It moves over any terrain and through any unit (see BLINK_MOVEMENT in
  // movement.ts).
  | { kind: 'blink' }
  // A kill in its own attack lets it move this many more tiles before it's
  // done (a canto; see grantMomentum in battle/commands.ts).
  | { kind: 'momentum'; amount: number }
  // It strikes twice in every exchange, fast enough or not.
  | { kind: 'always-double' }
  // A hit in its own attack shoves the target a tile away (see push.ts),
  // once the exchange is over, if both still stand.
  | { kind: 'shove-on-attack' }
  // Its strikes never miss (only `when` the condition holds, if it has one).
  | { kind: 'sure-hit'; when?: ModifierCondition }
  // Its crits deal this many times the damage instead of CRIT_MULTIPLIER
  // (the highest one counts).
  | { kind: 'crit-multiplier'; amount: number }
  // Gear effects (see combat.ts). `amount` more crit for each debuff its
  // foe carries (`crit-per-foe-debuff`); `amount` more of `term` for each
  // full tenth of its max HP it's missing (`missing-health-bonus`); a foe
  // whose strike lands on it from the next tile takes `amount` damage
  // (`thorns`); `percent` of the damage a strike deals it goes back to the
  // striker, only while it has `status` if one is named (`reflect`); a
  // crit that fells a foe heals it by the damage past the foe's HP
  // (`overkill-heal`).
  | { kind: 'crit-per-foe-debuff'; amount: number }
  | { kind: 'missing-health-bonus'; term: CombatTerm; amount: number }
  | { kind: 'thorns'; amount: number }
  | { kind: 'reflect'; percent: number; status?: StatusId }
  | { kind: 'overkill-heal' }
  // Gear effects the battle's commands play (see battle/commands.ts). A
  // strike of its that lands (`on` 'hit', the default) or crits lays
  // `status` on the foe it struck, if the foe survives (`status-on-hit`);
  // its recoil lays `status` on the striker (`status-on-recoil`); each kill
  // adds `amount` to `term` for the rest of the battle (`kill-stack`) and
  // heals `percent` of its max HP (`kill-heal-percent`); a kill in its own
  // attack lets it act again, once per phase (`encore`); a foe it fells
  // passes its debuffs to the foe nearest it (`contagion`); as its phase
  // starts, it Taunts the foes beside it (`taunt-aura`); waiting leaves it
  // Veiled (`veil-on-wait`); the debuffs it lays last one more of the
  // foe's phases (`linger-debuffs`).
  | { kind: 'status-on-hit'; status: StatusId; on?: 'hit' | 'crit' }
  | { kind: 'status-on-recoil'; status: StatusId }
  | { kind: 'kill-stack'; term: CombatTerm; amount: number }
  | { kind: 'kill-heal-percent'; percent: number }
  | { kind: 'encore' }
  | { kind: 'contagion' }
  | { kind: 'taunt-aura' }
  | { kind: 'veil-on-wait' }
  | { kind: 'linger-debuffs' };

export type ModifierKind = Modifier['kind'];

// The kinds whose amount sums up, by the field that holds it.
type Summable = Extract<Modifier, { amount: number } | { percent: number }>['kind'];

export type CombatBonus = Readonly<Record<CombatTerm, number>>;

export const NO_COMBAT_BONUS: CombatBonus = Object.freeze({
  hit: 0,
  avoid: 0,
  crit: 0,
  damage: 0,
  guard: 0,
  'damage-percent': 0,
  'guard-percent': 0,
});

// Where a unit stands as an exchange starts, for the conditions. The foe
// fields are left out where there's no foe to read (they count as false).
export interface CombatContext {
  attacking: boolean;
  wounded: boolean;
  vsMonster: boolean;
  foeWounded?: boolean;
  foeUnhurt?: boolean;
  foeDebuffed?: boolean;
  foeMarked?: boolean;
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
    case 'vs-wounded':
      return context.foeWounded === true;
    case 'vs-unhurt':
      return context.foeUnhurt === true;
    case 'vs-debuffed':
      return context.foeDebuffed === true;
    case 'vs-marked':
      return context.foeMarked === true;
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
