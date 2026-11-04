// The gear ladder: four tiers of arms and armor, wooden → iron → steel →
// silver, each with a weapon of every melee and bow family, a shield, and
// a body piece and a head piece in each armor weight (heavy, light and
// cloth; see ArmorWeight in items.ts). Each tier hits harder or guards
// more than the one before, and weighs more (see getOverload in
// combatStats.ts), except cloth, which never weighs anything.
//
// The pieces the game had before the ladder (the wooden set, the iron
// spear, axe and bow) live in weapons.ts and items.ts; this file adds the
// rest (LADDER_WEAPONS and LADDER_ARMORS, which WEAPONS and ARMORS list)
// and names each tier's pieces by id (GEAR_LADDER), for the merchant's
// stock (merchant.ts) and enemy loadouts (enemyGear.ts). Tomes, staves
// and siege arms aren't on the ladder.

import type { Armor, ArmorWeight } from './items.ts';
import type { Weapon } from './weapons.ts';

export type GearTier = 'wooden' | 'iron' | 'steel' | 'silver';

export const GEAR_TIERS: readonly GearTier[] = Object.freeze(['wooden', 'iron', 'steel', 'silver']);

// The weapon families with a piece on every tier.
export type LadderFamily = 'sword' | 'spear' | 'axe' | 'bow' | 'dagger';

export const LADDER_FAMILIES: readonly LadderFamily[] = Object.freeze(['sword', 'spear', 'axe', 'bow', 'dagger']);

// One tier's pieces, by item id.
export interface TierGear {
  weapons: Readonly<Record<LadderFamily, string>>;
  shield: string;
  body: Readonly<Record<ArmorWeight, string>>;
  head: Readonly<Record<ArmorWeight, string>>;
}

function weapon(fields: Omit<Weapon, 'kind' | 'minRange' | 'maxRange'> & Partial<Weapon>): Weapon {
  return Object.freeze({ kind: 'weapon', minRange: 1, maxRange: 1, ...fields });
}

function armor(fields: Omit<Armor, 'kind'>): Armor {
  return Object.freeze({ kind: 'armor', ...fields });
}

// Swords: accurate and middling. Spears: a little heavier. Axes: the most
// power, the least hit, the most weight. Bows: two hands, two tiles away
// only. Daggers: light, sure, and the only family that crits.
export const IRON_SWORD = weapon({
  id: 'iron-sword',
  label: 'Iron Sword',
  type: 'sword',
  hands: 1,
  power: 2,
  hit: 85,
  crit: 0,
  weight: 2,
});
export const STEEL_SWORD = weapon({
  id: 'steel-sword',
  label: 'Steel Sword',
  type: 'sword',
  hands: 1,
  power: 4,
  hit: 80,
  crit: 0,
  weight: 4,
});
export const SILVER_SWORD = weapon({
  id: 'silver-sword',
  label: 'Silver Sword',
  type: 'sword',
  hands: 1,
  power: 6,
  hit: 85,
  crit: 0,
  weight: 5,
});
export const STEEL_SPEAR = weapon({
  id: 'steel-spear',
  label: 'Steel Spear',
  type: 'spear',
  hands: 1,
  power: 3,
  hit: 75,
  crit: 0,
  weight: 5,
});
export const SILVER_SPEAR = weapon({
  id: 'silver-spear',
  label: 'Silver Spear',
  type: 'spear',
  hands: 1,
  power: 5,
  hit: 80,
  crit: 0,
  weight: 6,
});
export const STEEL_AXE = weapon({
  id: 'steel-axe',
  label: 'Steel Axe',
  type: 'axe',
  hands: 1,
  power: 5,
  hit: 60,
  crit: 0,
  weight: 7,
});
export const SILVER_AXE = weapon({
  id: 'silver-axe',
  label: 'Silver Axe',
  type: 'axe',
  hands: 1,
  power: 7,
  hit: 65,
  crit: 0,
  weight: 8,
});
export const WOODEN_BOW = weapon({
  id: 'wooden-bow',
  label: 'Wooden Bow',
  type: 'bow',
  hands: 2,
  power: 1,
  hit: 80,
  crit: 0,
  weight: 1,
  minRange: 2,
  maxRange: 2,
});
export const STEEL_BOW = weapon({
  id: 'steel-bow',
  label: 'Steel Bow',
  type: 'bow',
  hands: 2,
  power: 4,
  hit: 75,
  crit: 0,
  weight: 4,
  minRange: 2,
  maxRange: 2,
});
export const SILVER_BOW = weapon({
  id: 'silver-bow',
  label: 'Silver Bow',
  type: 'bow',
  hands: 2,
  power: 6,
  hit: 80,
  crit: 0,
  weight: 5,
  minRange: 2,
  maxRange: 2,
});
export const WOODEN_DAGGER = weapon({
  id: 'wooden-dagger',
  label: 'Wooden Dagger',
  type: 'dagger',
  hands: 1,
  power: 0,
  hit: 95,
  crit: 5,
  weight: 0,
});
export const IRON_DAGGER = weapon({
  id: 'iron-dagger',
  label: 'Iron Dagger',
  type: 'dagger',
  hands: 1,
  power: 1,
  hit: 90,
  crit: 10,
  weight: 1,
});
export const STEEL_DAGGER = weapon({
  id: 'steel-dagger',
  label: 'Steel Dagger',
  type: 'dagger',
  hands: 1,
  power: 3,
  hit: 85,
  crit: 10,
  weight: 2,
});
export const SILVER_DAGGER = weapon({
  id: 'silver-dagger',
  label: 'Silver Dagger',
  type: 'dagger',
  hands: 1,
  power: 5,
  hit: 90,
  crit: 15,
  weight: 3,
});

export const LADDER_WEAPONS: readonly Weapon[] = Object.freeze([
  IRON_SWORD,
  STEEL_SWORD,
  SILVER_SWORD,
  STEEL_SPEAR,
  SILVER_SPEAR,
  STEEL_AXE,
  SILVER_AXE,
  WOODEN_BOW,
  STEEL_BOW,
  SILVER_BOW,
  WOODEN_DAGGER,
  IRON_DAGGER,
  STEEL_DAGGER,
  SILVER_DAGGER,
]);

// Shields (the wooden one is in items.ts).
export const IRON_SHIELD = armor({ id: 'iron-shield', label: 'Iron Shield', slot: 'shield', defense: 2, weight: 3 });
export const STEEL_SHIELD = armor({ id: 'steel-shield', label: 'Steel Shield', slot: 'shield', defense: 3, weight: 4 });
export const SILVER_SHIELD = armor({
  id: 'silver-shield',
  label: 'Silver Shield',
  slot: 'shield',
  defense: 4,
  weight: 4,
});

// Heavy: plate and helms, the most DEF (the wooden body is Wooden Armor in
// items.ts).
function heavy(id: string, label: string, slot: 'body' | 'head', defense: number, weight: number): Armor {
  return armor({ id, label, slot, defense, weight, weightClass: 'heavy' });
}

export const IRON_PLATE = heavy('iron-plate', 'Iron Plate', 'body', 3, 4);
export const STEEL_PLATE = heavy('steel-plate', 'Steel Plate', 'body', 4, 6);
export const SILVER_PLATE = heavy('silver-plate', 'Silver Plate', 'body', 6, 7);
export const WOODEN_HELM = heavy('wooden-helm', 'Wooden Helm', 'head', 1, 1);
export const IRON_HELM = heavy('iron-helm', 'Iron Helm', 'head', 1, 2);
export const STEEL_HELM = heavy('steel-helm', 'Steel Helm', 'head', 2, 3);
export const SILVER_HELM = heavy('silver-helm', 'Silver Helm', 'head', 3, 3);

// Light: leathers, some DEF and some avoid, and little weight.
function light(id: string, label: string, slot: 'body' | 'head', defense: number, avoid: number, weight: number) {
  return armor({ id, label, slot, defense, avoid, weight, weightClass: 'light' });
}

export const HIDE_VEST = light('hide-vest', 'Hide Vest', 'body', 0, 5, 0);
export const LEATHER_ARMOR = light('leather-armor', 'Leather Armor', 'body', 1, 5, 1);
export const STUDDED_LEATHER = light('studded-leather', 'Studded Leather', 'body', 2, 10, 2);
export const SILVERWEAVE_COAT = light('silverweave-coat', 'Silverweave Coat', 'body', 3, 10, 2);
export const HIDE_CAP = light('hide-cap', 'Hide Cap', 'head', 0, 5, 0);
export const LEATHER_HOOD = light('leather-hood', 'Leather Hood', 'head', 0, 5, 0);
export const STUDDED_HOOD = light('studded-hood', 'Studded Hood', 'head', 1, 5, 1);
export const SILVERWEAVE_HOOD = light('silverweave-hood', 'Silverweave Hood', 'head', 1, 10, 1);

// Cloth: robes and hats, no DEF but RES, and weightless.
function cloth(id: string, label: string, slot: 'body' | 'head', resistance: number): Armor {
  return armor({ id, label, slot, defense: 0, resistance, weight: 0, weightClass: 'cloth' });
}

export const LINEN_ROBE = cloth('linen-robe', 'Linen Robe', 'body', 1);
export const WOOL_ROBE = cloth('wool-robe', 'Wool Robe', 'body', 2);
export const SILK_ROBE = cloth('silk-robe', 'Silk Robe', 'body', 3);
export const SILVER_ROBE = cloth('silver-robe', 'Silver Robe', 'body', 4);
export const LINEN_HAT = cloth('linen-hat', 'Linen Hat', 'head', 1);
export const WOOL_HAT = cloth('wool-hat', 'Wool Hat', 'head', 1);
export const SILK_HAT = cloth('silk-hat', 'Silk Hat', 'head', 2);
export const SILVER_CIRCLET = cloth('silver-circlet', 'Silver Circlet', 'head', 3);

export const LADDER_ARMORS: readonly Armor[] = Object.freeze([
  IRON_SHIELD,
  STEEL_SHIELD,
  SILVER_SHIELD,
  IRON_PLATE,
  STEEL_PLATE,
  SILVER_PLATE,
  WOODEN_HELM,
  IRON_HELM,
  STEEL_HELM,
  SILVER_HELM,
  HIDE_VEST,
  LEATHER_ARMOR,
  STUDDED_LEATHER,
  SILVERWEAVE_COAT,
  HIDE_CAP,
  LEATHER_HOOD,
  STUDDED_HOOD,
  SILVERWEAVE_HOOD,
  LINEN_ROBE,
  WOOL_ROBE,
  SILK_ROBE,
  SILVER_ROBE,
  LINEN_HAT,
  WOOL_HAT,
  SILK_HAT,
  SILVER_CIRCLET,
]);

// Each tier's pieces by id. The wooden and iron tiers name the older
// pieces in weapons.ts and items.ts by id, so this file needn't import
// them (weapons.ts and items.ts import it).
export const GEAR_LADDER: Readonly<Record<GearTier, TierGear>> = Object.freeze({
  wooden: tier({
    weapons: {
      sword: 'wooden-sword',
      spear: 'wooden-spear',
      axe: 'wooden-axe',
      bow: WOODEN_BOW.id,
      dagger: WOODEN_DAGGER.id,
    },
    shield: 'wooden-shield',
    body: { heavy: 'wooden-armor', light: HIDE_VEST.id, cloth: LINEN_ROBE.id },
    head: { heavy: WOODEN_HELM.id, light: HIDE_CAP.id, cloth: LINEN_HAT.id },
  }),
  iron: tier({
    weapons: { sword: IRON_SWORD.id, spear: 'iron-spear', axe: 'iron-axe', bow: 'iron-bow', dagger: IRON_DAGGER.id },
    shield: IRON_SHIELD.id,
    body: { heavy: IRON_PLATE.id, light: LEATHER_ARMOR.id, cloth: WOOL_ROBE.id },
    head: { heavy: IRON_HELM.id, light: LEATHER_HOOD.id, cloth: WOOL_HAT.id },
  }),
  steel: tier({
    weapons: {
      sword: STEEL_SWORD.id,
      spear: STEEL_SPEAR.id,
      axe: STEEL_AXE.id,
      bow: STEEL_BOW.id,
      dagger: STEEL_DAGGER.id,
    },
    shield: STEEL_SHIELD.id,
    body: { heavy: STEEL_PLATE.id, light: STUDDED_LEATHER.id, cloth: SILK_ROBE.id },
    head: { heavy: STEEL_HELM.id, light: STUDDED_HOOD.id, cloth: SILK_HAT.id },
  }),
  silver: tier({
    weapons: {
      sword: SILVER_SWORD.id,
      spear: SILVER_SPEAR.id,
      axe: SILVER_AXE.id,
      bow: SILVER_BOW.id,
      dagger: SILVER_DAGGER.id,
    },
    shield: SILVER_SHIELD.id,
    body: { heavy: SILVER_PLATE.id, light: SILVERWEAVE_COAT.id, cloth: SILVER_ROBE.id },
    head: { heavy: SILVER_HELM.id, light: SILVERWEAVE_HOOD.id, cloth: SILVER_CIRCLET.id },
  }),
});

function tier(gear: TierGear): TierGear {
  return Object.freeze({
    weapons: Object.freeze({ ...gear.weapons }),
    shield: gear.shield,
    body: Object.freeze({ ...gear.body }),
    head: Object.freeze({ ...gear.head }),
  });
}

// Every item id on `tier`: its weapons (in LADDER_FAMILIES order), its
// shield, then its body and head pieces, heavy, light, cloth.
export function getTierItemIds(tier: GearTier): string[] {
  const gear = GEAR_LADDER[tier];
  return [
    ...LADDER_FAMILIES.map((family) => gear.weapons[family]),
    gear.shield,
    gear.body.heavy,
    gear.body.light,
    gear.body.cloth,
    gear.head.heavy,
    gear.head.light,
    gear.head.cloth,
  ];
}

// The tier `itemId` is on, or null when it's not on the ladder.
export function getGearTier(itemId: string): GearTier | null {
  return GEAR_TIERS.find((tier) => getTierItemIds(tier).includes(itemId)) ?? null;
}

// What weight of armor each class wears by choice (enemy loadouts and the
// auto-run policy go by it): heavy for the front line, cloth for casters,
// and light for everyone else (CLASS_ARMOR_WEIGHTS leaves those out).
export const CLASS_ARMOR_WEIGHTS: Readonly<Record<string, ArmorWeight>> = Object.freeze({
  soldier: 'heavy',
  vanguard: 'heavy',
  fighter: 'heavy',
  siege: 'heavy',
  acolyte: 'cloth',
  mage: 'cloth',
  bishop: 'cloth',
});

export function getClassArmorWeight(unitClass: string | null): ArmorWeight {
  return CLASS_ARMOR_WEIGHTS[unitClass ?? ''] ?? 'light';
}

// Whether `a` is a higher tier than `b`.
export function isHigherTier(a: GearTier, b: GearTier): boolean {
  return GEAR_TIERS.indexOf(a) > GEAR_TIERS.indexOf(b);
}
