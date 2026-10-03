// Base class for all units on the tactics board. No Phaser, no rendering —
// just stats and the state changes every unit shares (taking damage,
// healing, dying, spending mana, leveling up). Stats follow Fire Emblem:
// strength / magic power physical / magical hits, defense / resistance
// guard against them, and skill, speed and luck feed hit, crit and
// doubling. `damageType` says which kind of hit the unit's attacks deal. Specific unit types extend
// this and set their own class, stats, growth rates and stat caps (see
// experience.ts), which decide what a level up raises; the skills a unit knows come
// from its class's skill tree and its level (see skills.ts). Items it
// carries are an inventory from items.ts.

import type { DamageType } from './combat.ts';
import type { Rng } from './combatStats.ts';
import {
  GROWTH_STATS,
  resolveExperienceGain,
  type ExperienceGain,
  type GrowthTable,
  type StatGains,
} from './experience.ts';
import {
  createInventory,
  findItem,
  getItemRecovery,
  removeItem,
  type Inventory,
  type InventoryEntry,
  type Item,
} from './items.ts';
import type { Team } from './turns.ts';

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
  range?: number;
  damageType?: DamageType;
  team: Team;
  items?: readonly InventoryEntry[];
  growths?: GrowthTable;
  caps?: GrowthTable;
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
  range: number;
  damageType: DamageType;
  team: Team;
  items: Inventory;
  growths: GrowthTable;
  caps: GrowthTable;

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
    range = 1,
    damageType = 'physical',
    team,
    items = [],
    growths = {},
    caps = {},
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
    this.range = range;
    this.damageType = damageType;
    this.team = team;
    this.items = createInventory(items);
    this.growths = growths;
    this.caps = caps;
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

  // Uses one of itemId from the inventory, restoring its stat. Returns
  // { item, amount } with the amount actually restored. Throws if the unit
  // doesn't carry the item — check canUseItem first to avoid wasting one.
  useItem(itemId: string): { item: Item; amount: number } {
    const entry = findItem(this.items, itemId);
    if (!entry) {
      throw new Error(`${this.name} has no ${itemId}`);
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

  // Gains `amount` XP, leveling up (rolling growths with `rng`) for every
  // 100 it crosses, with the overflow carried. Returns the
  // resolveExperienceGain result, whose levelUps say what each level
  // raised and which skills it taught.
  gainExperience(amount: number, rng: Rng = Math.random): ExperienceGain {
    const result = resolveExperienceGain(this, amount, rng);
    for (const { gains } of result.levelUps) this.levelUp(gains);
    this.experience = result.experience;
    return result;
  }
}
