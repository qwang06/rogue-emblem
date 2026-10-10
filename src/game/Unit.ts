// Base class for all units on the tactics board. No Phaser, no rendering —
// just stats and the state changes every unit shares (taking damage,
// healing, dying, spending mana, leveling up, equipping and wearing out
// weapons). Stats follow Fire Emblem: strength / magic power physical /
// magical hits, defense / resistance guard against them, and skill, speed
// and luck feed hit, crit and doubling. Specific unit types extend this
// and set their own class, stats, growth rates, stat caps and XP rate
// (see experience.ts), which decide what a level up raises, and the weapon
// types they master; the skills a unit knows come from its class's skill
// tree and its level (see skills.ts). Items it carries — consumables and
// weapons — are an inventory from items.ts; the first weapon in it the
// unit can wield is the one it fights with (see weapons.ts), which sets
// its range and the kind of damage it deals, and it wears the first armor
// of each slot it carries, which adds to its defense (see items.ts).

import type { Rng } from './combatStats.ts';
import {
  DEFAULT_EXPERIENCE_RATE,
  GROWTH_STATS,
  resolveExperienceGain,
  type ExperienceGain,
  type GrowthTable,
  type StatGains,
} from './experience.ts';
import { spendStaffUse, type Staff } from './healing.ts';
import {
  createInventory,
  findItem,
  getArmorDefense,
  getWornArmor,
  wearArmor,
  type Armor,
  getItemRecovery,
  removeItem,
  type Inventory,
  type InventoryEntry,
  type Consumable,
  type Item,
} from './items.ts';
import type { Team } from './turns.ts';
import {
  equipWeapon,
  getEquippedWeapon,
  getWieldableWeapons,
  spendWeaponUse,
  type EquippedWeapon,
  type Weapon,
  type WeaponType,
} from './weapons.ts';

export interface UnitOptions {
  name: string;
  unitClass?: string | null;
  level?: number;
  experience?: number;
  health: number;
  mana?: number;
  strength: number;
  magic?: number;
  skill?: number;
  speed?: number;
  luck?: number;
  defense: number;
  resistance?: number;
  movement: number;
  weaponTypes?: readonly WeaponType[];
  team: Team;
  items?: readonly InventoryEntry[];
  growths?: GrowthTable;
  caps?: GrowthTable;
  // Percent of each XP gain the unit earns (see scaleExperience).
  experienceRate?: number;
}

// The options a class (Soldier, Villager, ...) takes: the class fills in
// everything else.
export interface ClassUnitOptions {
  name?: string;
  team: Team;
  level?: number;
  items?: readonly InventoryEntry[];
}

export class Unit {
  name: string;
  unitClass: string | null;
  level: number;
  experience: number;
  maxHealth: number;
  health: number;
  maxMana: number;
  mana: number;
  strength: number;
  magic: number;
  skill: number;
  speed: number;
  luck: number;
  defense: number;
  resistance: number;
  movement: number;
  weaponTypes: readonly WeaponType[];
  team: Team;
  items: Inventory;
  growths: GrowthTable;
  caps: GrowthTable;
  experienceRate: number;
  // Killing this unit gives the killer exactly the XP it needs for its next
  // level (see getCombatAward), e.g. a first stage's lone enemy.
  levelUpOnKill = false;
  // An item this unit drops when it's defeated (see loot.ts), carried apart
  // from its inventory so it never fights with it.
  loot: Item | null = null;

  constructor({
    name,
    unitClass = null,
    level = 1,
    experience = 0,
    health,
    mana = 0,
    strength,
    magic = 0,
    skill = 0,
    speed = 0,
    luck = 0,
    defense,
    resistance = 0,
    movement,
    weaponTypes = [],
    team,
    items = [],
    growths = {},
    caps = {},
    experienceRate = DEFAULT_EXPERIENCE_RATE,
  }: UnitOptions) {
    this.name = name;
    this.unitClass = unitClass;
    this.level = level;
    this.experience = experience;
    this.maxHealth = health;
    this.health = health;
    this.maxMana = mana;
    this.mana = mana;
    this.strength = strength;
    this.magic = magic;
    this.skill = skill;
    this.speed = speed;
    this.luck = luck;
    this.defense = defense;
    this.resistance = resistance;
    this.movement = movement;
    this.weaponTypes = Object.freeze([...weaponTypes]);
    this.team = team;
    this.items = createInventory(items);
    this.growths = growths;
    this.caps = caps;
    this.experienceRate = experienceRate;
  }

  isAlive(): boolean {
    return this.health > 0;
  }

  takeDamage(amount: number): number {
    this.health = Math.max(0, this.health - amount);
    return this.health;
  }

  heal(amount: number): number {
    this.health = Math.min(this.maxHealth, this.health + amount);
    return this.health;
  }

  // Throws if the unit can't afford it — check canUseSkill first.
  spendMana(amount: number): number {
    if (amount > this.mana) {
      throw new Error(`${this.name} has ${this.mana} mana, can't spend ${amount}`);
    }
    this.mana -= amount;
    return this.mana;
  }

  restoreMana(amount: number): number {
    this.mana = Math.min(this.maxMana, this.mana + amount);
    return this.mana;
  }

  // The weapon it fights with — the first in its inventory it can wield —
  // or null if it has none (then it can't attack or counter).
  get weapon(): Weapon | null {
    return this.equippedWeapon?.weapon ?? null;
  }

  // Uses the equipped weapon has left, or null if it never breaks (or
  // there's no weapon).
  get weaponUses(): number | null {
    return this.equippedWeapon?.uses ?? null;
  }

  // The equipped weapon with its inventory slot and uses left, or null.
  get equippedWeapon(): EquippedWeapon | null {
    return getEquippedWeapon(this.items, this.weaponTypes);
  }

  // The armor it wears (the first of each slot it carries), with slots.
  get wornArmor(): { armor: Armor; index: number }[] {
    return getWornArmor(this.items);
  }

  // What its worn armor adds to its defense against physical hits.
  get armorDefense(): number {
    return getArmorDefense(this.items);
  }

  // Wears the armor in inventory slot `index` (moving it to the front).
  // Throws if there's no armor there.
  wear(index: number): Armor {
    const armor = this.items[index]?.item;
    this.items = wearArmor(this.items, index);
    return armor as Armor;
  }

  // Every weapon it carries and can wield, equipped first.
  get wieldableWeapons(): EquippedWeapon[] {
    return getWieldableWeapons(this.items, this.weaponTypes);
  }

  // Equips the weapon in inventory slot `index` (moving it to the front).
  // Throws if there's no weapon it can wield there.
  equip(index: number): Weapon {
    this.items = equipWeapon(this.items, index, this.weaponTypes);
    return this.weapon!;
  }

  // Spends one use of the equipped weapon, for a strike made with it.
  // Returns { weapon, broke }: a weapon that runs out is removed from the
  // inventory, and the next one it can wield (if any) is equipped. Throws
  // if it has no weapon.
  spendWeaponUse(): { weapon: Weapon; broke: boolean } {
    const equipped = this.equippedWeapon;
    if (!equipped) throw new Error(`${this.name} has no weapon`);
    const { inventory, broke } = spendWeaponUse(this.items, equipped.index);
    this.items = inventory;
    return { weapon: equipped.weapon, broke };
  }

  // Spends one use of the staff in inventory slot `index`, for a heal made
  // with it. Returns { staff, broke }: a staff that runs out is removed
  // from the inventory. Throws if there's no staff there.
  spendStaffUse(index: number): { staff: Staff; broke: boolean } {
    const staff = this.items[index]?.item as Staff | undefined;
    const { inventory, broke } = spendStaffUse(this.items, index);
    this.items = inventory;
    return { staff: staff!, broke };
  }

  // Uses one of the consumable itemId from the inventory, restoring its
  // stat. Returns { item, amount } with the amount actually restored.
  // Throws if the unit doesn't carry it (or it's a weapon) — check
  // canUseItem first to avoid wasting one.
  useItem(itemId: string): { item: Consumable; amount: number } {
    const entry = findItem(this.items, itemId);
    if (!entry || entry.item.kind !== 'consumable') {
      throw new Error(`${this.name} has no ${itemId} to use`);
    }
    const { item } = entry;
    const amount = getItemRecovery(this, item);
    if (item.stat === 'health') this.heal(amount);
    else if (item.stat === 'mana') this.restoreMana(amount);
    this.items = removeItem(this.items, itemId);
    return { item, amount };
  }

  // Raises the level by one and adds `gains` ({ health, strength, ... },
  // from rollLevelUp) to the stats. Health and mana gains raise both the
  // maximum and the current value. Returns the new level.
  levelUp(gains: Partial<StatGains> = {}): number {
    this.level += 1;
    for (const stat of GROWTH_STATS) {
      const gain = gains[stat] ?? 0;
      if (stat === 'health') {
        this.maxHealth += gain;
        this.health += gain;
      } else if (stat === 'mana') {
        this.maxMana += gain;
        this.mana += gain;
      } else {
        this[stat] += gain;
      }
    }
    return this.level;
  }

  // Gains `amount` XP (scaled by its XP rate unless `scaled` is false),
  // leveling up (rolling growths with `rng`) for every 100 it crosses, with
  // the overflow carried. Returns the resolveExperienceGain result, whose
  // levelUps say what each level raised and which skills it taught.
  gainExperience(amount: number, rng: Rng = Math.random, scaled = true): ExperienceGain {
    const result = resolveExperienceGain(this, amount, rng, { scaled });
    for (const { gains } of result.levelUps) this.levelUp(gains);
    this.experience = result.experience;
    return result;
  }
}
