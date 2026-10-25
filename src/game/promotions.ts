// Pure promotion rules (roadmap 4.5, and Warband Mode's W.7): a unit of a
// base class that has reached PROMOTION_LEVEL can advance to one of two
// stronger classes. A promoted class keeps the base class's skill tree
// and adds a skill of its own (skills.ts), raises the caps, shifts the
// growths, adds a few points to the stats on the spot (each up to the new
// cap) and carries a passive modifier (modifiers.ts) into every battle;
// some master a second weapon type and hand the unit a weapon of it on
// promotion. The level, XP, items, boons and tome progress are kept, so a
// promotion is a step up rather than a fresh start. No Phaser, no hidden
// state: promoteUnit changes the unit it's given, like levelUp does.

import { GROWTH_STATS, type GrowthStat, type GrowthTable } from './experience.ts';
import { ACOLYTE_CAPS, ACOLYTE_GROWTHS, ACOLYTE_WEAPON_TYPES } from './Acolyte.ts';
import { ARCHER_CAPS, ARCHER_GROWTHS, ARCHER_WEAPON_TYPES } from './Archer.ts';
import { GUARD_CAPS, GUARD_GROWTHS, GUARD_WEAPON_TYPES } from './Guard.ts';
import { applyModifiers, type Modifier } from './modifiers.ts';
import { SOLDIER_CAPS, SOLDIER_GROWTHS, SOLDIER_WEAPON_TYPES } from './Soldier.ts';
import type { Unit } from './Unit.ts';
import { VANGUARD_CAPS, VANGUARD_GROWTHS, VANGUARD_WEAPON_TYPES } from './Vanguard.ts';
import { WARRIOR_CAPS, WARRIOR_GROWTHS, WARRIOR_WEAPON_TYPES } from './Warrior.ts';
import { BALLISTA, FIRE, LIGHT, POWDER_KEG, type Weapon, type WeaponType } from './weapons.ts';

// The level a unit must reach to promote. Units end a ten-stage run
// around level 6 to 10, so this lands promotions mid-run.
export const PROMOTION_LEVEL = 5;

// What a promotion adds to the stats at once (GROWTH_STATS keys, max HP
// and MP for health and mana), and to MOV.
export type PromotionBonuses = Partial<Record<GrowthStat | 'movement', number>>;

export interface Promotion {
  // The promoted class's id (a UNIT_CLASSES id) and display name.
  id: string;
  label: string;
  // The base class it promotes from.
  from: string;
  // A line on what the class is for, for the promotion screen.
  description: string;
  bonuses: PromotionBonuses;
  growths: GrowthTable;
  caps: GrowthTable;
  weaponTypes: readonly WeaponType[];
  // The class's passive, carried into every battle, and its name.
  passive: { name: string; description: string; modifiers: readonly Modifier[] };
  // A weapon handed to the unit on promotion (a second weapon type's),
  // or null.
  gift: Weapon | null;
}

// How far a promotion raises the caps: HP by 10, everything else by 5.
const CAP_RAISE = 5;
const HEALTH_CAP_RAISE = 10;

// `caps` raised by CAP_RAISE (HEALTH_CAP_RAISE for HP).
function raiseCaps(caps: GrowthTable): GrowthTable {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(caps).map(([stat, cap]) => [stat, cap + (stat === 'health' ? HEALTH_CAP_RAISE : CAP_RAISE)]),
    ),
  );
}

// `growths` with `changes` added, each kept at 0 or more.
function shiftGrowths(growths: GrowthTable, changes: GrowthTable): GrowthTable {
  return Object.freeze(
    Object.fromEntries(GROWTH_STATS.map((stat) => [stat, Math.max(0, (growths[stat] ?? 0) + (changes[stat] ?? 0))])),
  );
}

function promotion(
  fields: Omit<Promotion, 'caps' | 'growths' | 'passive' | 'gift'> & {
    base: { growths: GrowthTable; caps: GrowthTable };
    growthChanges: GrowthTable;
    passive: Promotion['passive'];
    gift?: Weapon;
  },
): Promotion {
  const { base, growthChanges, passive, gift = null, ...rest } = fields;
  return Object.freeze({
    ...rest,
    bonuses: Object.freeze({ ...rest.bonuses }),
    growths: shiftGrowths(base.growths, growthChanges),
    caps: raiseCaps(base.caps),
    weaponTypes: Object.freeze([...rest.weaponTypes]),
    passive: Object.freeze({ ...passive, modifiers: Object.freeze(passive.modifiers.map((m) => Object.freeze(m))) }),
    gift,
  });
}

const WARRIOR = { growths: WARRIOR_GROWTHS, caps: WARRIOR_CAPS };
const SOLDIER = { growths: SOLDIER_GROWTHS, caps: SOLDIER_CAPS };
const ARCHER = { growths: ARCHER_GROWTHS, caps: ARCHER_CAPS };
const VANGUARD = { growths: VANGUARD_GROWTHS, caps: VANGUARD_CAPS };
const GUARD = { growths: GUARD_GROWTHS, caps: GUARD_CAPS };
const ACOLYTE = { growths: ACOLYTE_GROWTHS, caps: ACOLYTE_CAPS };

// Every promotion, two per base class, in UNIT_CLASSES order.
export const PROMOTIONS: readonly Promotion[] = Object.freeze([
  promotion({
    id: 'hero',
    label: 'Hero',
    from: 'warrior',
    description: 'The all-rounder the warrior was growing into: quick, sure-handed and hard to stop.',
    base: WARRIOR,
    bonuses: { health: 4, strength: 2, skill: 2, speed: 2, defense: 1, resistance: 1 },
    growthChanges: { skill: 5, speed: 5 },
    weaponTypes: WARRIOR_WEAPON_TYPES,
    passive: {
      name: "Hero's Poise",
      description: '+10 crit.',
      modifiers: [{ kind: 'combat', term: 'crit', amount: 10 }],
    },
  }),
  promotion({
    id: 'berserker',
    label: 'Berserker',
    from: 'warrior',
    description: 'Trades guard for raw strength, and hits hardest when bleeding.',
    base: WARRIOR,
    bonuses: { health: 6, strength: 3, skill: 1, speed: 1 },
    growthChanges: { health: 5, strength: 10, defense: -10 },
    weaponTypes: WARRIOR_WEAPON_TYPES,
    passive: {
      name: 'Bloodrage',
      description: '+3 damage while under half HP.',
      modifiers: [{ kind: 'combat', term: 'damage', amount: 3, when: 'wounded' }],
    },
  }),
  promotion({
    id: 'general',
    label: 'General',
    from: 'soldier',
    description: 'Heavy armor over the spear: holds the line and shrugs off blows.',
    base: SOLDIER,
    bonuses: { health: 5, strength: 2, defense: 4, resistance: 2 },
    growthChanges: { defense: 15, speed: -10 },
    weaponTypes: SOLDIER_WEAPON_TYPES,
    passive: {
      name: 'Iron Wall',
      description: 'Takes 2 less damage when attacked.',
      modifiers: [{ kind: 'combat', term: 'guard', amount: 2, when: 'defending' }],
    },
  }),
  promotion({
    id: 'halberdier',
    label: 'Halberdier',
    from: 'soldier',
    description: 'A long polearm and a sure aim: strikes from two tiles off with Lunge.',
    base: SOLDIER,
    bonuses: { health: 3, strength: 2, skill: 3, speed: 2 },
    growthChanges: { skill: 10, speed: 10 },
    weaponTypes: SOLDIER_WEAPON_TYPES,
    passive: {
      name: 'Reach',
      description: '+15 hit.',
      modifiers: [{ kind: 'combat', term: 'hit', amount: 15 }],
    },
  }),
  promotion({
    id: 'sniper',
    label: 'Sniper',
    from: 'archer',
    description: 'A master of the bow, deadly from four tiles away.',
    base: ARCHER,
    bonuses: { health: 3, strength: 2, skill: 3, speed: 1, luck: 1 },
    growthChanges: { strength: 5, skill: 10 },
    weaponTypes: ARCHER_WEAPON_TYPES,
    passive: {
      name: 'Deadeye',
      description: '+10 crit.',
      modifiers: [{ kind: 'combat', term: 'crit', amount: 10 }],
    },
  }),
  promotion({
    id: 'arbalest',
    label: 'Arbalest',
    from: 'archer',
    description: 'Crews a ballista: slow, but masters siege weapons and gets one on promotion.',
    base: ARCHER,
    bonuses: { health: 5, strength: 3, defense: 2, movement: -1 },
    growthChanges: { strength: 10, defense: 10, speed: -10 },
    weaponTypes: ['physical', 'siege'],
    passive: {
      name: 'Braced',
      description: '+2 damage when it attacks.',
      modifiers: [{ kind: 'combat', term: 'damage', amount: 2, when: 'attacking' }],
    },
    gift: BALLISTA,
  }),
  promotion({
    id: 'champion',
    label: 'Champion',
    from: 'vanguard',
    description: 'The axe in sure hands at last: faster and far more accurate.',
    base: VANGUARD,
    bonuses: { health: 4, strength: 2, skill: 2, speed: 2, defense: 1 },
    growthChanges: { skill: 10, speed: 10 },
    weaponTypes: VANGUARD_WEAPON_TYPES,
    passive: {
      name: 'Onslaught',
      description: '+2 damage when it attacks.',
      modifiers: [{ kind: 'combat', term: 'damage', amount: 2, when: 'attacking' }],
    },
  }),
  promotion({
    id: 'bombardier',
    label: 'Bombardier',
    from: 'vanguard',
    description: 'Masters siege weapons and gets a powder keg on promotion.',
    base: VANGUARD,
    bonuses: { health: 3, strength: 2, skill: 2, defense: 1 },
    growthChanges: { skill: 10 },
    weaponTypes: ['physical', 'siege'],
    passive: {
      name: 'Steady Fuse',
      description: '+10 hit.',
      modifiers: [{ kind: 'combat', term: 'hit', amount: 10 }],
    },
    gift: POWDER_KEG,
  }),
  promotion({
    id: 'bastion',
    label: 'Bastion',
    from: 'guard',
    description: 'A living wall: harder to hurt with weapons or magic.',
    base: GUARD,
    bonuses: { health: 5, strength: 1, defense: 3, resistance: 3 },
    growthChanges: { defense: 10, resistance: 15 },
    weaponTypes: GUARD_WEAPON_TYPES,
    passive: {
      name: 'Bulwark',
      description: 'Takes 2 less damage from every hit.',
      modifiers: [{ kind: 'combat', term: 'guard', amount: 2 }],
    },
  }),
  promotion({
    id: 'templar',
    label: 'Templar',
    from: 'guard',
    description: 'Spear and spell: learns magic and gets Light on promotion.',
    base: GUARD,
    bonuses: { health: 3, magic: 3, speed: 1, resistance: 4 },
    growthChanges: { magic: 35, resistance: 20 },
    weaponTypes: ['physical', 'magical'],
    passive: {
      name: 'Devotion',
      description: 'Recovers 1 HP at the start of each of your phases.',
      modifiers: [{ kind: 'phase-heal', amount: 1 }],
    },
    gift: LIGHT,
  }),
  promotion({
    id: 'bishop',
    label: 'Bishop',
    from: 'acolyte',
    description: 'A seasoned healer whose mana never runs dry.',
    base: ACOLYTE,
    bonuses: { health: 3, mana: 3, magic: 2, resistance: 3 },
    growthChanges: { health: 10, magic: 5, resistance: 5 },
    weaponTypes: ACOLYTE_WEAPON_TYPES,
    passive: {
      name: 'Wellspring',
      description: 'Recovers 1 MP at the start of each of your phases.',
      modifiers: [{ kind: 'phase-mana', amount: 1 }],
    },
  }),
  promotion({
    id: 'sage',
    label: 'Sage',
    from: 'acolyte',
    description: 'Turns to battle magic and gets a Fire Tome on promotion.',
    base: ACOLYTE,
    bonuses: { health: 2, magic: 3, skill: 2, speed: 2 },
    growthChanges: { magic: 10, skill: 10, speed: 5 },
    weaponTypes: ACOLYTE_WEAPON_TYPES,
    passive: {
      name: 'Arcane Focus',
      description: '+10 hit.',
      modifiers: [{ kind: 'combat', term: 'hit', amount: 10 }],
    },
    gift: FIRE,
  }),
]);

// The promotion with `id`, or null.
export function findPromotion(id: string): Promotion | null {
  return PROMOTIONS.find((candidate) => candidate.id === id) ?? null;
}

// The promotions open to class `classId`, in order: none for a promoted
// class or a monster.
export function getPromotions(classId: string | null): Promotion[] {
  return PROMOTIONS.filter((candidate) => candidate.from === classId);
}

// Whether `classId` is a promoted class.
export function isPromotedClass(classId: string | null): boolean {
  return classId !== null && findPromotion(classId) !== null;
}

// The base class `classId` promoted from, or `classId` itself when it
// isn't a promoted class.
export function getBaseClassId(classId: string): string {
  return findPromotion(classId)?.from ?? classId;
}

// Whether a unit of `classId` at `level` can promote: its class has
// promotions and it has reached PROMOTION_LEVEL.
export function canPromote(unit: { classId: string; level: number }): boolean {
  return unit.level >= PROMOTION_LEVEL && getPromotions(unit.classId).length > 0;
}

// The stats promoteUnit would add to `unit` for `promotion`: each bonus,
// cut to what the new cap leaves (health and mana read their maximums).
// Stats it wouldn't raise are left out.
export function getPromotionGains(unit: Unit, promotion: Promotion): Partial<Record<GrowthStat, number>> {
  const gains: Partial<Record<GrowthStat, number>> = {};
  for (const stat of GROWTH_STATS) {
    const bonus = promotion.bonuses[stat] ?? 0;
    const value = stat === 'health' ? unit.maxHealth : stat === 'mana' ? unit.maxMana : unit[stat];
    const gain = Math.max(0, Math.min(bonus, (promotion.caps[stat] ?? Infinity) - value));
    if (gain > 0) gains[stat] = gain;
  }
  return gains;
}

// Makes `unit` a unit of `promotion`'s class: its class id, growths, caps
// and weapon types, MOV changed by the MOV bonus, and the passive's
// modifiers added. Stats are left alone. Changes `unit` itself.
export function becomePromotedClass(unit: Unit, promotion: Promotion): Unit {
  unit.unitClass = promotion.id;
  unit.growths = promotion.growths;
  unit.caps = promotion.caps;
  unit.weaponTypes = promotion.weaponTypes;
  unit.movement += promotion.bonuses.movement ?? 0;
  return applyModifiers(unit, promotion.passive.modifiers);
}

// Promotes `unit` to `promotion`'s class (becomePromotedClass) and adds
// the stat bonuses (getPromotionGains; a max HP or MP gain raises the
// current value too). Level, XP, items and boons stay. The gift weapon
// isn't handed over here: where it goes is the caller's (see
// warband/promotion.ts). Changes `unit` itself, like levelUp.
export function promoteUnit(unit: Unit, promotion: Promotion): Unit {
  const gains = getPromotionGains(unit, promotion);
  becomePromotedClass(unit, promotion);
  for (const [stat, gain] of Object.entries(gains) as [GrowthStat, number][]) {
    if (stat === 'health') {
      unit.maxHealth += gain;
      unit.health += gain;
    } else if (stat === 'mana') {
      unit.maxMana += gain;
      unit.mana += gain;
    } else {
      unit[stat] += gain;
    }
  }
  return unit;
}
