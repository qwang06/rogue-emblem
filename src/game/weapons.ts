// Pure rules for weapons. A weapon is worn in a unit's main hand (see
// equipment.ts) or comes with its body (fists, natural weapons, spells)
// and is fought with: it sets the unit's attack range, the kind of damage
// it deals, and adds its power, hit and crit to the combat formulas
// (combat.ts, combatStats.ts). Any class can wield any weapon; the types a
// class masters are the ones it's trained in. Weapons never break. A tome
// is a magical weapon that teaches its spell to a unit that fights with it
// often enough (see tomes.ts). No Phaser, no rendering, no hidden state.

import type { MenuAction } from './actionMenu.ts';
import type { DamageType } from './combat.ts';
import type { InventoryEntry } from './items.ts';

// What a class can master. Physical and siege weapons hit with strength
// against defense, magical ones with intelligence against resistance; siege
// weapons are the long-range engines and bombs only siege units wield.
export type WeaponType = 'physical' | 'magical' | 'siege';

// How many hands a weapon (or staff, see healing.ts) takes to hold. A unit
// whose equipped weapon takes one hand has the other free for a shield;
// one that takes two can't wear a shield (see canUseShield in items.ts).
export type Hands = 1 | 2;

// A weapon: { kind: 'weapon', id, label, type, hands, power, hit, crit,
// weight, minRange, maxRange }. `hands` is 1 or 2 (see Hands); `power` adds to the wielder's attack power,
// `hit` and `crit` to its hit and crit rates, `weight` slows a wielder
// weaker than it (see getAttackSpeed in combatStats.ts).
// `teaches` makes it a tome: a unit that strikes with it `afterUses` times
// learns the spell weapon `spellId` (see tomes.ts).
export interface Weapon {
  kind: 'weapon';
  id: string;
  label: string;
  type: WeaponType;
  hands: Hands;
  power: number;
  hit: number;
  crit: number;
  weight: number;
  minRange: number;
  maxRange: number;
  teaches?: TomeLesson;
}

// What a tome teaches: the id of the spell (a weapon that never breaks)
// and how many strikes with the tome it takes to learn it.
export interface TomeLesson {
  spellId: string;
  afterUses: number;
}

// One of a unit's attacks: its main-hand weapon or an innate one (see
// Unit.attacks), and its place in the unit's attack list.
export interface EquippedWeapon {
  weapon: Weapon;
  index: number;
}

export interface WeaponAction extends MenuAction {
  // The weapon's id (the menu entry's id also carries its slot).
  itemId: string;
  index: number;
  type: WeaponType;
  power: number;
  hit: number;
  crit: number;
  weight: number;
  range: string;
}

export const WEAPON_TYPES: readonly WeaponType[] = Object.freeze(['physical', 'magical', 'siege']);

// The kind of damage each weapon type deals.
export const WEAPON_DAMAGE_TYPES: Readonly<Record<WeaponType, DamageType>> = Object.freeze({
  physical: 'physical',
  magical: 'magical',
  siege: 'physical',
});

function weapon(fields: Omit<Weapon, 'kind'>): Weapon {
  const { teaches, ...rest } = fields;
  return Object.freeze({ kind: 'weapon', ...rest, ...(teaches && { teaches: Object.freeze({ ...teaches }) }) });
}

// The starter weapons, one per armed unit in the unit catalog (see the
// tileset skill's units-catalog.md). Numbers are scaled to the game's small
// stat lines (10 HP, 4 STR at level 1).

// Bare hands: what a villager falls back on once its sword breaks. Never
// breaks.
export const FISTS = weapon({
  id: 'fists',
  label: 'Fists',
  type: 'physical',
  hands: 1,
  power: 0,
  hit: 80,
  crit: 0,
  weight: 0,
  minRange: 1,
  maxRange: 1,
});

// The soldier's spear.
export const IRON_SPEAR = weapon({
  id: 'iron-spear',
  label: 'Iron Spear',
  type: 'physical',
  hands: 1,
  power: 1,
  hit: 80,
  crit: 0,
  weight: 3,
  minRange: 1,
  maxRange: 1,
});

// The vanguard's axe: hits hard, misses more, and is heavy.
export const IRON_AXE = weapon({
  id: 'iron-axe',
  label: 'Iron Axe',
  type: 'physical',
  hands: 1,
  power: 3,
  hit: 65,
  crit: 0,
  weight: 5,
  minRange: 1,
  maxRange: 1,
});

// The archer's bow: two tiles away only, so it can't strike adjacent foes.
// It takes both hands, so an archer fights without a shield.
export const IRON_BOW = weapon({
  id: 'iron-bow',
  label: 'Iron Bow',
  type: 'physical',
  hands: 2,
  power: 2,
  hit: 80,
  crit: 0,
  weight: 2,
  minRange: 2,
  maxRange: 2,
});

// The Fire tome: intelligence against resistance, near or one tile further. A
// unit that casts from it 5 times learns Fire (FIRE_SPELL) for good.
export const FIRE = weapon({
  id: 'fire',
  label: 'Fire Tome',
  type: 'magical',
  hands: 1,
  power: 2,
  hit: 85,
  crit: 0,
  weight: 1,
  minRange: 1,
  maxRange: 2,
  teaches: { spellId: 'fire-spell', afterUses: 5 },
});

// Fire once learned from its tome: the same numbers, and it never runs out.
export const FIRE_SPELL = weapon({
  id: 'fire-spell',
  label: 'Fire',
  type: 'magical',
  hands: 1,
  power: 2,
  hit: 85,
  crit: 0,
  weight: 1,
  minRange: 1,
  maxRange: 2,
});

// The acolyte's own spell: a weak flash of holy light, near or one tile
// further. It knows it from the start, so it never breaks and can't be
// handed over; the Fire tome is the stronger spell to find.
export const LIGHT = weapon({
  id: 'light',
  label: 'Light',
  type: 'magical',
  hands: 1,
  power: 0,
  hit: 90,
  crit: 0,
  weight: 0,
  minRange: 1,
  maxRange: 2,
});

// The sapper's bomb: a heavy blast, near or thrown, with few to spare.
export const POWDER_KEG = weapon({
  id: 'powder-keg',
  label: 'Powder Keg',
  type: 'siege',
  hands: 2,
  power: 5,
  hit: 70,
  crit: 0,
  weight: 6,
  minRange: 1,
  maxRange: 2,
});

// The siege engine's bolt thrower: long range, nothing up close.
export const BALLISTA = weapon({
  id: 'ballista',
  label: 'Ballista',
  type: 'siege',
  hands: 2,
  power: 6,
  hit: 70,
  crit: 0,
  weight: 8,
  minRange: 2,
  maxRange: 3,
});

// The monsters' natural weapons, which never break. The slime's body slam:
// no power at all.
export const TACKLE = weapon({
  id: 'tackle',
  label: 'Tackle',
  type: 'physical',
  hands: 1,
  power: 0,
  hit: 75,
  crit: 0,
  weight: 0,
  minRange: 1,
  maxRange: 1,
});

// The goblin's club.
export const CLUB = weapon({
  id: 'club',
  label: 'Club',
  type: 'physical',
  hands: 1,
  power: 2,
  hit: 75,
  crit: 0,
  weight: 2,
  minRange: 1,
  maxRange: 1,
});

// The skeleton's claws.
export const BONE_CLAWS = weapon({
  id: 'bone-claws',
  label: 'Bone Claws',
  type: 'physical',
  hands: 1,
  power: 2,
  hit: 80,
  crit: 0,
  weight: 1,
  minRange: 1,
  maxRange: 1,
});

// The bat's fangs: weak, but it rarely misses.
export const FANGS = weapon({
  id: 'fangs',
  label: 'Fangs',
  type: 'physical',
  hands: 1,
  power: 1,
  hit: 85,
  crit: 0,
  weight: 0,
  minRange: 1,
  maxRange: 1,
});

// The beast's bite, the one natural weapon that can crit.
export const BITE = weapon({
  id: 'bite',
  label: 'Bite',
  type: 'physical',
  hands: 1,
  power: 2,
  hit: 75,
  crit: 5,
  weight: 1,
  minRange: 1,
  maxRange: 1,
});

// The orc's axe: heavy, wild and two-handed, but it never breaks.
export const GREAT_AXE = weapon({
  id: 'great-axe',
  label: 'Great Axe',
  type: 'physical',
  hands: 2,
  power: 3,
  hit: 65,
  crit: 0,
  weight: 4,
  minRange: 1,
  maxRange: 1,
});

// The troll's maul, a boulder lashed to a branch: the hardest-hitting
// natural weapon bar the dragon's breath, and the least sure to land.
export const STONE_MAUL = weapon({
  id: 'stone-maul',
  label: 'Stone Maul',
  type: 'physical',
  hands: 2,
  power: 4,
  hit: 60,
  crit: 0,
  weight: 5,
  minRange: 1,
  maxRange: 1,
});

// The red dragon's breath: a gout of flame that reaches a tile further
// than a bite, so the dragon answers archers too. It never runs out.
export const FIRE_BREATH = weapon({
  id: 'fire-breath',
  label: 'Fire Breath',
  type: 'physical',
  hands: 1,
  power: 4,
  hit: 75,
  crit: 0,
  weight: 0,
  minRange: 1,
  maxRange: 2,
});

// The wooden set: basic practice arms, lighter and weaker than iron and
// quicker to break (their icons are ITEM_SPRITES in tileset.ts). The sword
// is the accurate one.
export const WOODEN_SWORD = weapon({
  id: 'wooden-sword',
  label: 'Wooden Sword',
  type: 'physical',
  hands: 1,
  power: 1,
  hit: 90,
  crit: 0,
  weight: 1,
  minRange: 1,
  maxRange: 1,
});

// A sharpened pole: the iron spear's power, less sure to land.
export const WOODEN_SPEAR = weapon({
  id: 'wooden-spear',
  label: 'Wooden Spear',
  type: 'physical',
  hands: 1,
  power: 1,
  hit: 75,
  crit: 0,
  weight: 2,
  minRange: 1,
  maxRange: 1,
});

// Hits hardest of the three and misses most.
export const WOODEN_AXE = weapon({
  id: 'wooden-axe',
  label: 'Wooden Axe',
  type: 'physical',
  hands: 1,
  power: 2,
  hit: 60,
  crit: 0,
  weight: 3,
  minRange: 1,
  maxRange: 1,
});

export const WEAPONS: readonly Weapon[] = Object.freeze([
  FISTS,
  IRON_SPEAR,
  IRON_AXE,
  IRON_BOW,
  FIRE,
  FIRE_SPELL,
  LIGHT,
  POWDER_KEG,
  BALLISTA,
  TACKLE,
  CLUB,
  BONE_CLAWS,
  FANGS,
  BITE,
  GREAT_AXE,
  STONE_MAUL,
  FIRE_BREATH,
  WOODEN_SWORD,
  WOODEN_SPEAR,
  WOODEN_AXE,
]);

// The weapons a body comes with rather than carries: fists, the monsters'
// natural weapons and spells (learned or known from the start). They can't be handed over or stored.
export const NATURAL_WEAPON_IDS: ReadonlySet<string> = new Set([
  FISTS.id,
  TACKLE.id,
  CLUB.id,
  BONE_CLAWS.id,
  FANGS.id,
  BITE.id,
  GREAT_AXE.id,
  STONE_MAUL.id,
  FIRE_BREATH.id,
  FIRE_SPELL.id,
  LIGHT.id,
]);

// An inventory entry for weapon (one of it).
export function weaponEntry(weapon: Weapon): InventoryEntry {
  return Object.freeze({ item: weapon, quantity: 1 });
}

export function isWeapon(item: { kind: string }): item is Weapon {
  return item.kind === 'weapon';
}

// Whether a class that masters `weaponTypes` is trained in weapon.
export function canWield(weaponTypes: readonly WeaponType[], weapon: Weapon): boolean {
  return weaponTypes.includes(weapon.type);
}

// The span of tiles any of `weapons` can strike, as { minRange, maxRange }
// — the shortest minimum and the longest maximum — or null for none. Used
// for the threat fringe around a unit's move range.
export function getWeaponReach(weapons: readonly Weapon[]): { minRange: number; maxRange: number } | null {
  if (weapons.length === 0) return null;
  return {
    minRange: Math.min(...weapons.map((w) => w.minRange)),
    maxRange: Math.max(...weapons.map((w) => w.maxRange)),
  };
}

// A weapon's range as it reads in the UI: "1", or "1–2" for a span.
export function formatWeaponRange(weapon: Pick<Weapon, 'minRange' | 'maxRange'>): string {
  return weapon.minRange === weapon.maxRange ? `${weapon.minRange}` : `${weapon.minRange}–${weapon.maxRange}`;
}

// Entries for the weapon menu shown after choosing Attack: each of the
// unit's attacks (the one it fights with first) with its numbers. One is
// disabled when hasTarget(weapon) says nothing is in its range from where
// the unit stands.
export function getWeaponActions(
  attacks: readonly EquippedWeapon[],
  hasTarget: (weapon: Weapon) => boolean,
): readonly WeaponAction[] {
  return Object.freeze(
    attacks.map(({ weapon, index }) =>
      Object.freeze({
        id: `${weapon.id}@${index}`,
        itemId: weapon.id,
        label: weapon.label,
        index,
        type: weapon.type,
        power: weapon.power,
        hit: weapon.hit,
        crit: weapon.crit,
        weight: weapon.weight,
        range: formatWeaponRange(weapon),
        disabled: !hasTarget(weapon),
      }),
    ),
  );
}
