// Base class for all units on the tactics board. No Phaser, no rendering —
// just stats and the state changes every unit shares (taking damage,
// healing, dying, spending mana, leveling up, equipping and wearing out
// weapons). Stats follow Fire Emblem: strength / intelligence power physical /
// magical hits, defense / resistance guard against them, and dexterity, speed
// and luck feed hit, crit and doubling. Specific unit types extend this
// and set their own class, stats, growth rates and XP rate
// (see experience.ts), which decide what a level up raises, and the weapon
// types they master; the skills a unit knows come from its class's skill
// tree and its level, and from its secondary class's (see skills.ts).
// It wears gear in slots (see equipment.ts): a weapon or staff in its main
// hand, armor elsewhere; its bag holds consumables (items.ts), and the
// weapons its body comes with (fists, natural weapons, spells it knows) are
// its innate attacks. It fights with one of its attacks — the main-hand
// weapon or an innate one — which sets its range and the kind of damage it
// deals (see weapons.ts), and its worn armor adds to its defense.
// Striking with a tome often enough teaches its spell (see tomes.ts).

import type { Rng } from './combatStats.ts';
import {
  DEFAULT_EXPERIENCE_RATE,
  GROWTH_STATS,
  resolveExperienceGain,
  type ExperienceGain,
  type GrowthTable,
  type StatGains,
} from './experience.ts';
import type { CarriedStaff } from './healing.ts';
import {
  createInventory,
  findItem,
  getItemRecovery,
  removeItem,
  type Armor,
  type Inventory,
  type InventoryEntry,
  type Consumable,
  type Item,
} from './items.ts';
import {
  createLoadout,
  getArmorDefense,
  getArmorWeight,
  getGearLayout,
  getMainStaff,
  getMainWeapon,
  getWornArmor,
  hasHandFree,
  type Equipment,
  type GearLayout,
} from './equipment.ts';
import { getDefaultFaction, type FactionId } from './factions.ts';
import type { Modifier } from './modifiers.ts';
import type { StatusId } from './statuses.ts';
import type { Curse } from './curses.ts';
import { getTomeSpell, isTome, knowsSpell, recordTomeUse, type TomeProgress } from './tomes.ts';
import type { Team } from './turns.ts';
import type { EquippedWeapon, Weapon, WeaponType } from './weapons.ts';

// A standout enemy: its stage's boss, or an elite at an elite lair.
export type UnitRank = 'boss' | 'elite';

export interface UnitOptions {
  name: string;
  unitClass?: string | null;
  level?: number;
  experience?: number;
  health: number;
  mana?: number;
  strength: number;
  intelligence?: number;
  dexterity?: number;
  speed?: number;
  luck?: number;
  defense: number;
  resistance?: number;
  movement: number;
  weaponTypes?: readonly WeaponType[];
  team: Team;
  // Its kit as one list (a class's starting kit): sorted into equipment,
  // innate attacks and the bag by createLoadout (see equipment.ts), and
  // anything that doesn't fit is dropped. `equipment` and `innate`, when
  // given, replace what the list would put there.
  items?: readonly InventoryEntry[];
  equipment?: Equipment;
  innate?: readonly Weapon[];
  growths?: GrowthTable;
  // Percent of each XP gain the unit earns (see scaleExperience).
  experienceRate?: number;
  // Strikes made with tomes not yet learned from (see tomes.ts).
  tomeProgress?: TomeProgress;
  // Its faction (factions.ts), whose version of its class's art it wears;
  // null for none (neutral units and monsters). Unset, its team's default.
  faction?: FactionId | null;
}

// The options a class (Soldier, Villager, ...) takes: the class fills in
// everything else.
export interface ClassUnitOptions {
  name?: string;
  team: Team;
  level?: number;
  items?: readonly InventoryEntry[];
  // Its faction; unset, its team's default (see UnitOptions.faction).
  faction?: FactionId | null;
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
  intelligence: number;
  dexterity: number;
  speed: number;
  luck: number;
  defense: number;
  resistance: number;
  movement: number;
  weaponTypes: readonly WeaponType[];
  team: Team;
  // Its faction (factions.ts), or null for a neutral unit or a monster.
  faction: FactionId | null;
  // Its bag: consumables only (see items.ts).
  items: Inventory;
  // The gear it wears, by slot (see equipment.ts).
  equipment: Equipment;
  // The weapons its body comes with: fists, natural weapons, spells it
  // knows. Never gear: they can't be taken off or handed over.
  innate: readonly Weapon[];
  // Which of its attacks (see attacks) it fights with, by attack index.
  // Picked in battle; never saved.
  attackIndex = 0;
  growths: GrowthTable;
  experienceRate: number;
  tomeProgress: TomeProgress;
  // Killing this unit gives the killer exactly the XP it needs for its next
  // level (see getCombatAward), e.g. a first stage's lone enemy.
  levelUpOnKill = false;
  // An item this unit drops when it's defeated (see loot.ts), carried apart
  // from its inventory so it never fights with it.
  loot: Item | null = null;
  // Whether this unit stands its ground on the enemy phase: it strikes
  // anyone in reach of its tile but never moves (a boss, see
  // warband/stageObjective.ts).
  holdsPosition = false;
  // What its relics and boons add for the battle (see modifiers.ts), set
  // by applyModifiers when a Warband run fields it.
  modifiers: readonly Modifier[] = Object.freeze([]);
  // The curses its cursed gear lays on the enemies of any battle it's
  // deployed in (see curses.ts).
  curses: readonly Curse[] = Object.freeze([]);
  // Statuses a skill has left on it this battle (see statuses.ts), until
  // its team's next phase ends. Never saved.
  statuses: readonly StatusId[] = Object.freeze([]);
  // Debuffs among its statuses that outlast the next time its debuffs wear
  // off, once: one laid on its own phase, or by a unit that makes debuffs
  // linger (see battle/commands.ts). Never saved.
  lingering: readonly StatusId[] = Object.freeze([]);
  // How many tiles it walked this phase (its move's path), for skills that
  // hit harder after a run up (a skill's `chargePower`). Never saved.
  movedTiles = 0;
  // Whether it's a monster (the monster classes set it), for modifiers
  // that only count against monsters.
  monster = false;
  // The level-up boons it has taken in a Warband run (warband/boons.ts),
  // by id, in the order taken.
  boons: readonly string[] = Object.freeze([]);
  // The evolutions it has in a Warband run (warband/evolutions.ts), by id,
  // set with their modifiers when the run fields it.
  evolutions: readonly string[] = Object.freeze([]);
  // The elite affixes it fights with at an elite lair (warband/elites.ts),
  // by id.
  eliteAffixes: readonly string[] = Object.freeze([]);
  // Whether it's its stage's boss (warband/stageObjective.ts) or an elite
  // (warband/elites.ts), which the map and HUD mark it as; null for neither.
  rank: UnitRank | null = null;
  // The class whose skill set it has learned on top of its own (see
  // skills.ts and warband/mentors.ts), or null.
  secondaryClass: string | null = null;
  // The quirk it joined a Warband run with (warband/quirks.ts), by id, or
  // null.
  quirk: string | null = null;

  constructor({
    name,
    unitClass = null,
    level = 1,
    experience = 0,
    health,
    mana = 0,
    strength,
    intelligence = 0,
    dexterity = 0,
    speed = 0,
    luck = 0,
    defense,
    resistance = 0,
    movement,
    weaponTypes = [],
    team,
    items = [],
    equipment,
    innate,
    growths = {},
    experienceRate = DEFAULT_EXPERIENCE_RATE,
    tomeProgress = {},
    faction,
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
    this.intelligence = intelligence;
    this.dexterity = dexterity;
    this.speed = speed;
    this.luck = luck;
    this.defense = defense;
    this.resistance = resistance;
    this.movement = movement;
    this.weaponTypes = Object.freeze([...weaponTypes]);
    this.team = team;
    this.faction = faction === undefined ? getDefaultFaction(team) : faction;
    const loadout = createLoadout(createInventory(items, Infinity), getGearLayout(unitClass), unitClass);
    this.items = loadout.bag;
    this.equipment = equipment ?? loadout.equipment;
    this.innate = Object.freeze([...(innate ?? loadout.innate)]);
    this.growths = growths;
    this.experienceRate = experienceRate;
    this.tomeProgress = Object.freeze({ ...tomeProgress });
  }

  // A copy of this unit, of the same class, that can change without
  // changing this one. Stats are plain numbers and its inventory and tome
  // progress are replaced rather than edited, so a shallow copy is enough.
  clone(): this {
    return Object.assign(Object.create(Object.getPrototypeOf(this)), this);
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

  // The slots it has: a humanoid's paper doll or a monster's.
  get gearLayout(): GearLayout {
    return getGearLayout(this.unitClass);
  }

  // The weapon it fights with — its picked attack — or null if it has none
  // (then it can't attack or counter).
  get weapon(): Weapon | null {
    return this.equippedWeapon?.weapon ?? null;
  }

  // Its attacks in their fixed order, by index: the main-hand weapon, then
  // its innate weapons.
  private get attackList(): EquippedWeapon[] {
    const main = getMainWeapon(this.equipment);
    return [...(main ? [main] : []), ...this.innate].map((weapon, index) => ({ weapon, index }));
  }

  // The attack it fights with, or null if it has none.
  get equippedWeapon(): EquippedWeapon | null {
    const list = this.attackList;
    return list.find(({ index }) => index === this.attackIndex) ?? list[0] ?? null;
  }

  // Every attack it can make, the one it fights with first.
  get wieldableWeapons(): EquippedWeapon[] {
    const picked = this.equippedWeapon;
    const rest = this.attackList.filter(({ index }) => index !== picked?.index);
    return picked ? [picked, ...rest] : rest;
  }

  // The staves it can heal with: the one in its main hand, if any.
  get staves(): CarriedStaff[] {
    const staff = getMainStaff(this.equipment);
    return staff ? [{ staff, index: 0 }] : [];
  }

  // The armor it wears, in slot order.
  get wornArmor(): Armor[] {
    return getWornArmor(this.equipment);
  }

  // Whether its off hand is free for a shield (see hasHandFree).
  get canUseShield(): boolean {
    return hasHandFree(this.equipment);
  }

  // What its worn armor adds to its defense against physical hits.
  get armorDefense(): number {
    return getArmorDefense(this.equipment);
  }

  // What its worn armor weighs; it slows the unit along with its weapon.
  get armorWeight(): number {
    return getArmorWeight(this.equipment);
  }

  // Fights with attack `index` (see wieldableWeapons) from now on. Throws if
  // it has no such attack.
  equip(index: number): Weapon {
    const attack = this.attackList.find((candidate) => candidate.index === index);
    if (!attack) throw new Error(`${this.name} has no attack ${index}`);
    this.attackIndex = index;
    return attack.weapon;
  }

  // Records a strike with the weapon it fights with. Weapons never break;
  // a strike with a tome whose spell it doesn't know counts towards
  // learning it, and the strike that learns it adds the spell to its innate
  // attacks (`learned` is the spell, else null). Throws if it has no weapon.
  recordStrike(): { weapon: Weapon; learned: Weapon | null } {
    const weapon = this.weapon;
    if (!weapon) throw new Error(`${this.name} has no weapon`);
    if (!isTome(weapon) || knowsSpell(this.innate, weapon)) return { weapon, learned: null };
    const { progress, learned } = recordTomeUse(this.tomeProgress, weapon);
    this.tomeProgress = progress;
    if (!learned) return { weapon, learned: null };
    const spell = getTomeSpell(weapon);
    this.innate = Object.freeze([...this.innate, spell]);
    return { weapon, learned: spell };
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
  // from getLevelUpGains) to the stats. Health and mana gains raise both the
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
  // leveling up (on its fixed growths) for every 100 it crosses, with
  // the overflow carried. Returns the resolveExperienceGain result, whose
  // levelUps say what each level raised and which skills it taught.
  gainExperience(amount: number, scaled = true): ExperienceGain {
    const result = resolveExperienceGain(this, amount, { scaled });
    for (const { gains } of result.levelUps) this.levelUp(gains);
    this.experience = result.experience;
    return result;
  }
}
