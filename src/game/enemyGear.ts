// Enemy loadouts: what a Warband enemy wears for its level, so later
// stages field steel and silver as the merchant comes to sell them (see
// TIER_STAGES in warband/merchant.ts). A humanoid enemy's weapon moves up
// the gear ladder (gearLadder.ts) in its own family as its level reaches
// each tier's stage; from ARMOR_FROM_LEVEL it wears a body piece, and from
// HELM_FROM_LEVEL a head piece, each ARMOR_LAG levels of tier behind its
// weapon, in its class's armor weight (getClassArmorWeight). It never puts
// on a piece that would cost it movement (getLoadMovementPenalty), and
// never trades down what it starts with. Monsters keep their bodies'
// weapons. Pure.

import { getLoadMovementPenalty } from './combatStats.ts';
import {
  equipGear,
  getArmorWeight,
  getGearSlot,
  getMainWeapon,
  type Equipment,
  type Gear,
  type GearLayout,
} from './equipment.ts';
import {
  GEAR_LADDER,
  GEAR_TIERS,
  getClassArmorWeight,
  getGearTier,
  LADDER_FAMILIES,
  type GearTier,
  type LadderFamily,
} from './gearLadder.ts';
import type { Item } from './items.ts';

// The level each tier reaches enemies at: the stage it reaches the
// merchant, since an enemy's level is about its stage (enemyCurve.ts).
export const ENEMY_TIER_LEVELS: Readonly<Record<GearTier, number>> = Object.freeze({
  wooden: 1,
  iron: 4,
  steel: 11,
  silver: 20,
});

// The levels enemies put on body and head armor from.
export const ARMOR_FROM_LEVEL = 3;
export const HELM_FROM_LEVEL = 8;

// How many levels armor's tier trails the weapon's.
export const ARMOR_LAG = 3;

// The tier enemies of `level` reach (wooden below the iron tier's level).
export function getEnemyTier(level: number): GearTier {
  return GEAR_TIERS.filter((tier) => level >= ENEMY_TIER_LEVELS[tier]).at(-1) ?? 'wooden';
}

// What an enemy wears.
export interface EnemyKit {
  unitClass: string | null;
  gearLayout: GearLayout;
  strength: number;
  equipment: Equipment;
}

// `enemy`'s equipment outfitted for `level` (see the top of this file).
// `items` is where the ladder's pieces are looked up by id.
export function outfitEnemy(enemy: EnemyKit, level: number, items: readonly Item[]): Equipment {
  if (enemy.gearLayout !== 'humanoid') return enemy.equipment;
  const find = (id: string) => items.find((item) => item.id === id) as Gear | undefined;
  let equipment = enemy.equipment;
  const wear = (id: string, keepMovement: boolean) => {
    const gear = find(id);
    if (!gear) return;
    const worn = equipment[getGearSlot(gear)];
    const wornTier = worn && getGearTier(worn.id);
    if (worn && (!wornTier || GEAR_TIERS.indexOf(wornTier) >= GEAR_TIERS.indexOf(getGearTier(id)!))) return;
    const next = equipGear(equipment, gear, 'humanoid', enemy.unitClass).equipment;
    const load = { strength: enemy.strength, armorWeight: getArmorWeight(next), weapon: getMainWeapon(next) };
    if (keepMovement && getLoadMovementPenalty(load) > 0) return;
    equipment = next;
  };

  const weapon = getMainWeapon(equipment);
  if (weapon && LADDER_FAMILIES.includes(weapon.type as LadderFamily)) {
    wear(GEAR_LADDER[getEnemyTier(level)].weapons[weapon.type as LadderFamily], false);
  }
  const weight = getClassArmorWeight(enemy.unitClass);
  if (level >= ARMOR_FROM_LEVEL) wear(GEAR_LADDER[getEnemyTier(level - ARMOR_LAG)].body[weight], true);
  if (level >= HELM_FROM_LEVEL) wear(GEAR_LADDER[getEnemyTier(level - ARMOR_LAG)].head[weight], true);
  return equipment;
}
