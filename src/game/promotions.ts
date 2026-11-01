// Pure promotion rules: the class tree's second tier. A villager (the
// starting unit) that has reached PROMOTION_LEVEL can become an Archer,
// Soldier, Vanguard or Sapper, and an acolyte a Mage. Promoting makes the unit that class: it
// takes the class's growths, weapon types, XP rate and skill tree,
// gains whatever stats the class starts above the class it promotes from, carries the class's passive modifier (modifiers.ts) into every
// battle and is handed the class's weapon. The level, XP, items, boons and
// tome progress are kept, so a promotion is a step up rather than a fresh
// start. No Phaser, no hidden state: promoteUnit changes the unit it's
// given, like levelUp does.

import { ACOLYTE_STATS } from './Acolyte.ts';
import { ARCHER_GROWTHS, ARCHER_PASSIVE, ARCHER_STATS, ARCHER_WEAPON_TYPES } from './Archer.ts';
import { DEFAULT_EXPERIENCE_RATE, GROWTH_STATS, type GrowthStat, type GrowthTable } from './experience.ts';
import { MAGE_GROWTHS, MAGE_PASSIVE, MAGE_STATS, MAGE_WEAPON_TYPES } from './Mage.ts';
import { applyModifiers, type Modifier } from './modifiers.ts';
import { SAPPER_GROWTHS, SAPPER_PASSIVE, SAPPER_STATS, SAPPER_WEAPON_TYPES } from './Sapper.ts';
import { SOLDIER_GROWTHS, SOLDIER_PASSIVE, SOLDIER_STATS, SOLDIER_WEAPON_TYPES } from './Soldier.ts';
import type { Unit } from './Unit.ts';
import { VANGUARD_GROWTHS, VANGUARD_PASSIVE, VANGUARD_STATS, VANGUARD_WEAPON_TYPES } from './Vanguard.ts';
import { VILLAGER_STATS } from './Villager.ts';
import { FIRE, IRON_AXE, IRON_BOW, IRON_SPEAR, POWDER_KEG, type Weapon, type WeaponType } from './weapons.ts';

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
  // The class it promotes from: the villager, or the acolyte.
  from: string;
  // A line on what the class is for, for the promotion screen.
  description: string;
  bonuses: PromotionBonuses;
  growths: GrowthTable;
  // Percent of each XP gain the class earns (see scaleExperience).
  experienceRate: number;
  weaponTypes: readonly WeaponType[];
  // The class's passive, carried into every battle, and its name.
  passive: { name: string; description: string; modifiers: readonly Modifier[] };
  // The class's weapon, handed to the unit on promotion.
  gift: Weapon | null;
}

type StatLine = Readonly<Record<GrowthStat | 'movement', number>>;

// What a unit on stat line `base` gains becoming a class that starts on
// `stats`: each stat the class starts above the base by the difference, MOV
// by the difference either way.
function bonusesOver(stats: StatLine, base: StatLine): PromotionBonuses {
  const bonuses: PromotionBonuses = {};
  for (const stat of GROWTH_STATS) {
    const gain = stats[stat] - base[stat];
    if (gain > 0) bonuses[stat] = gain;
  }
  if (stats.movement !== base.movement) bonuses.movement = stats.movement - base.movement;
  return Object.freeze(bonuses);
}

// The stat line of each class that has promotions, by id.
const BASE_STATS: Readonly<Record<string, StatLine>> = Object.freeze({
  villager: VILLAGER_STATS,
  acolyte: ACOLYTE_STATS,
});

function promotion(
  fields: Omit<Promotion, 'bonuses' | 'passive' | 'from'> & {
    from?: string;
    stats: StatLine;
    passive: Promotion['passive'];
  },
): Promotion {
  const { stats, passive, from = 'villager', ...rest } = fields;
  return Object.freeze({
    ...rest,
    from,
    bonuses: bonusesOver(stats, BASE_STATS[from]),
    weaponTypes: Object.freeze([...rest.weaponTypes]),
    passive: Object.freeze({ ...passive, modifiers: Object.freeze(passive.modifiers.map((m) => Object.freeze(m))) }),
  });
}

// Every promotion, in UNIT_CLASSES order: the villager's four, then the
// acolyte's one.
export const PROMOTIONS: readonly Promotion[] = Object.freeze([
  promotion({
    id: 'archer',
    label: 'Archer',
    description: 'Takes up the bow: accurate and quick from two tiles away, but frail up close.',
    stats: ARCHER_STATS,
    growths: ARCHER_GROWTHS,
    experienceRate: DEFAULT_EXPERIENCE_RATE,
    weaponTypes: ARCHER_WEAPON_TYPES,
    passive: ARCHER_PASSIVE,
    gift: IRON_BOW,
  }),
  promotion({
    id: 'soldier',
    label: 'Soldier',
    description: 'Spear and shield: sturdy infantry that holds the line.',
    stats: SOLDIER_STATS,
    growths: SOLDIER_GROWTHS,
    experienceRate: DEFAULT_EXPERIENCE_RATE,
    weaponTypes: SOLDIER_WEAPON_TYPES,
    passive: SOLDIER_PASSIVE,
    gift: IRON_SPEAR,
  }),
  promotion({
    id: 'vanguard',
    label: 'Vanguard',
    description: 'A polearm and raw strength: hits hardest and soaks blows, but slow and easy to hit.',
    stats: VANGUARD_STATS,
    growths: VANGUARD_GROWTHS,
    experienceRate: DEFAULT_EXPERIENCE_RATE,
    weaponTypes: VANGUARD_WEAPON_TYPES,
    passive: VANGUARD_PASSIVE,
    gift: IRON_AXE,
  }),
  promotion({
    id: 'sapper',
    label: 'Sapper',
    description: 'Hauls a powder keg: a heavy blast near or thrown, with few to spare.',
    stats: SAPPER_STATS,
    growths: SAPPER_GROWTHS,
    experienceRate: DEFAULT_EXPERIENCE_RATE,
    weaponTypes: SAPPER_WEAPON_TYPES,
    passive: SAPPER_PASSIVE,
    gift: POWDER_KEG,
  }),
  promotion({
    id: 'mage',
    label: 'Mage',
    from: 'acolyte',
    description: 'Trades prayers for fire: hits hardest from range, still frail up close.',
    stats: MAGE_STATS,
    growths: MAGE_GROWTHS,
    experienceRate: DEFAULT_EXPERIENCE_RATE,
    weaponTypes: MAGE_WEAPON_TYPES,
    passive: MAGE_PASSIVE,
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

// Whether a unit of `classId` at `level` can promote: its class has
// promotions and it has reached PROMOTION_LEVEL.
export function canPromote(unit: { classId: string; level: number }): boolean {
  return unit.level >= PROMOTION_LEVEL && getPromotions(unit.classId).length > 0;
}

// The stats promoteUnit would add to `unit` for `promotion`: each bonus
// in full (there are no stat caps). Stats it wouldn't raise are left out.
export function getPromotionGains(unit: Unit, promotion: Promotion): Partial<Record<GrowthStat, number>> {
  const gains: Partial<Record<GrowthStat, number>> = {};
  for (const stat of GROWTH_STATS) {
    const bonus = promotion.bonuses[stat] ?? 0;
    const gain = Math.max(0, bonus);
    if (gain > 0) gains[stat] = gain;
  }
  return gains;
}

// Makes `unit` a unit of `promotion`'s class: its class id, growths,
// XP rate and weapon types, MOV changed by the MOV bonus, and the passive's
// modifiers added. Stats are left alone. Changes `unit` itself.
export function becomePromotedClass(unit: Unit, promotion: Promotion): Unit {
  unit.unitClass = promotion.id;
  unit.growths = promotion.growths;
  unit.weaponTypes = promotion.weaponTypes;
  unit.experienceRate = promotion.experienceRate;
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
