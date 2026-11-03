import { describe, expect, it } from 'vitest';
import type { GrowthTable } from './experience.ts';
import { HEALTH_POTION, MANA_POTION, WOODEN_ARMOR, WOODEN_SHIELD, type InventoryEntry } from './items.ts';
import { Unit } from './Unit.ts';
import { Villager } from './Villager.ts';
import { FIRE, FIRE_SPELL, FISTS, IRON_BOW, IRON_SPEAR, weaponEntry, type WeaponType } from './weapons.ts';

function makeUnit(overrides = {}) {
  return new Unit({
    name: 'Soldier',
    health: 10,
    mana: 5,
    strength: 4,
    defense: 2,
    movement: 5,
    team: 'player',
    ...overrides,
  });
}

describe('Unit', () => {
  it('initializes from the given stats', () => {
    const unit = makeUnit();
    expect(unit.name).toBe('Soldier');
    expect(unit.health).toBe(10);
    expect(unit.maxHealth).toBe(10);
    expect(unit.strength).toBe(4);
    expect(unit.defense).toBe(2);
    expect(unit.movement).toBe(5);
    expect(unit.team).toBe('player');
    expect(unit.mana).toBe(5);
    expect(unit.maxMana).toBe(5);
  });

  it('defaults to level 1, no class, and no mana', () => {
    const unit = new Unit({ name: 'Blob', health: 1, strength: 0, defense: 0, movement: 1, team: 'enemy' });
    expect(unit.level).toBe(1);
    expect(unit.unitClass).toBeNull();
    expect(unit.mana).toBe(0);
    expect(unit.maxMana).toBe(0);
  });

  it('defaults intelligence, dexterity, speed, luck, and resistance to 0', () => {
    const unit = makeUnit();
    expect(unit.intelligence).toBe(0);
    expect(unit.dexterity).toBe(0);
    expect(unit.speed).toBe(0);
    expect(unit.luck).toBe(0);
    expect(unit.resistance).toBe(0);
  });

  it('accepts the expanded stats', () => {
    const unit = makeUnit({ intelligence: 6, dexterity: 5, speed: 7, luck: 3, resistance: 4 });
    expect(unit.intelligence).toBe(6);
    expect(unit.dexterity).toBe(5);
    expect(unit.speed).toBe(7);
    expect(unit.luck).toBe(3);
    expect(unit.resistance).toBe(4);
  });

  it('accepts an explicit class and level', () => {
    const unit = makeUnit({ unitClass: 'soldier', level: 4 });
    expect(unit.unitClass).toBe('soldier');
    expect(unit.level).toBe(4);
  });

  describe('weapons', () => {
    const armed = (items: InventoryEntry[], weaponTypes: WeaponType[] = ['physical']) =>
      makeUnit({ items, weaponTypes });

    describe('learning from a tome', () => {
      const mage = (items: InventoryEntry[]) => armed(items, ['magical']);

      it('learns Fire on the fifth strike with the Fire tome and keeps the tome in hand', () => {
        const unit = mage([weaponEntry(FIRE)]);
        for (let strike = 1; strike < 5; strike++) {
          expect(unit.recordStrike()).toEqual({ weapon: FIRE, learned: null });
          expect(unit.tomeProgress).toEqual({ fire: strike });
        }
        expect(unit.recordStrike()).toEqual({ weapon: FIRE, learned: FIRE_SPELL });
        expect(unit.tomeProgress).toEqual({});
        expect(unit.innate).toEqual([FIRE_SPELL]);
        expect(unit.equipment.main).toBe(FIRE);
        expect(unit.wieldableWeapons.map(({ weapon }) => weapon)).toEqual([FIRE, FIRE_SPELL]);
      });

      it('picks up where it left off', () => {
        const unit = makeUnit({ items: [weaponEntry(FIRE)], weaponTypes: ['magical'], tomeProgress: { fire: 4 } });
        expect(unit.recordStrike().learned).toBe(FIRE_SPELL);
      });

      it('makes no progress once it knows the spell', () => {
        const unit = mage([weaponEntry(FIRE), weaponEntry(FIRE_SPELL)]);
        expect(unit.recordStrike()).toEqual({ weapon: FIRE, learned: null });
        expect(unit.tomeProgress).toEqual({});
      });
    });

    it('masters no weapon types and has no weapon by default', () => {
      const unit = makeUnit();
      expect(unit.weaponTypes).toEqual([]);
      expect(unit.weapon).toBeNull();
      expect(unit.equippedWeapon).toBeNull();
      expect(() => unit.recordStrike()).toThrow(/no weapon/);
    });

    it('holds the first weapon of its kit in its main hand and its potions in its bag', () => {
      const unit = armed([{ item: HEALTH_POTION, quantity: 1 }, weaponEntry(IRON_BOW), weaponEntry(IRON_SPEAR)]);
      expect(unit.equipment.main).toBe(IRON_BOW);
      expect(unit.weapon).toBe(IRON_BOW);
      expect(unit.equippedWeapon).toEqual({ weapon: IRON_BOW, index: 0 });
      expect(unit.items).toEqual([{ item: HEALTH_POTION, quantity: 1 }]);
    });

    it('wields any weapon, mastered or not', () => {
      expect(armed([weaponEntry(FIRE)]).weapon).toBe(FIRE);
    });

    it('lists its main-hand weapon and its innate attacks, the one it fights with first', () => {
      const unit = armed([weaponEntry(FISTS), weaponEntry(IRON_SPEAR)]);
      expect(unit.innate).toEqual([FISTS]);
      expect(unit.wieldableWeapons).toEqual([
        { weapon: IRON_SPEAR, index: 0 },
        { weapon: FISTS, index: 1 },
      ]);
      expect(unit.equip(1)).toBe(FISTS);
      expect(unit.weapon).toBe(FISTS);
      expect(unit.wieldableWeapons.map(({ weapon }) => weapon)).toEqual([FISTS, IRON_SPEAR]);
      expect(unit.equipment.main).toBe(IRON_SPEAR);
    });

    it('throws when picking an attack it lacks', () => {
      expect(() => armed([weaponEntry(IRON_SPEAR)]).equip(1)).toThrow();
    });

    it('never wears its weapon down', () => {
      const unit = armed([weaponEntry(IRON_SPEAR)]);
      for (let strike = 0; strike < 50; strike++) unit.recordStrike();
      expect(unit.weapon).toBe(IRON_SPEAR);
    });
  });

  it('is alive when health is above zero', () => {
    expect(makeUnit().isAlive()).toBe(true);
  });

  it('is not alive once health reaches zero', () => {
    const unit = makeUnit();
    unit.takeDamage(10);
    expect(unit.isAlive()).toBe(false);
  });

  describe('clone', () => {
    it('copies the unit, class and all, without tying the two together', () => {
      const villager = new Villager({ team: 'player' });
      const copy = villager.clone();
      expect(copy).toBeInstanceOf(Villager);
      expect(copy).not.toBe(villager);
      copy.useItem(copy.items.find((entry) => entry.item.kind === 'consumable')!.item.id);
      copy.takeDamage(3);
      expect(copy.health).toBe(villager.maxHealth - 3);
      expect(villager.health).toBe(villager.maxHealth);
      expect(copy.items).not.toEqual(villager.items);
    });
  });

  describe('takeDamage', () => {
    it('reduces health by the given amount', () => {
      const unit = makeUnit();
      unit.takeDamage(3);
      expect(unit.health).toBe(7);
    });

    it('does not drop health below zero', () => {
      const unit = makeUnit();
      unit.takeDamage(999);
      expect(unit.health).toBe(0);
    });
  });

  describe('heal', () => {
    it('increases health by the given amount', () => {
      const unit = makeUnit();
      unit.takeDamage(6);
      unit.heal(2);
      expect(unit.health).toBe(6);
    });

    it('does not raise health above maxHealth', () => {
      const unit = makeUnit();
      unit.takeDamage(1);
      unit.heal(999);
      expect(unit.health).toBe(unit.maxHealth);
    });
  });

  describe('spendMana', () => {
    it('reduces mana by the given amount', () => {
      const unit = makeUnit();
      expect(unit.spendMana(3)).toBe(2);
      expect(unit.mana).toBe(2);
    });

    it('can spend exactly all remaining mana', () => {
      const unit = makeUnit();
      unit.spendMana(5);
      expect(unit.mana).toBe(0);
    });

    it('throws and leaves mana unchanged when the unit cannot afford it', () => {
      const unit = makeUnit();
      expect(() => unit.spendMana(6)).toThrow();
      expect(unit.mana).toBe(5);
    });
  });

  describe('restoreMana', () => {
    it('increases mana by the given amount', () => {
      const unit = makeUnit();
      unit.spendMana(4);
      unit.restoreMana(2);
      expect(unit.mana).toBe(3);
    });

    it('does not raise mana above maxMana', () => {
      const unit = makeUnit();
      unit.spendMana(1);
      unit.restoreMana(999);
      expect(unit.mana).toBe(unit.maxMana);
    });
  });

  describe('items', () => {
    it('carries no items by default', () => {
      expect(makeUnit().items).toEqual([]);
    });

    it('starts with the items it was given, as a frozen inventory', () => {
      const unit = makeUnit({ items: [{ item: HEALTH_POTION, quantity: 2 }] });
      expect(unit.items).toEqual([{ item: HEALTH_POTION, quantity: 2 }]);
      expect(Object.isFrozen(unit.items)).toBe(true);
    });
  });

  describe('useItem', () => {
    const stocked = () =>
      makeUnit({
        items: [
          { item: HEALTH_POTION, quantity: 2 },
          { item: MANA_POTION, quantity: 1 },
        ],
      });

    it('restores health with a health potion and uses one up', () => {
      const unit = stocked();
      unit.takeDamage(7);
      expect(unit.useItem('health-potion')).toEqual({ item: HEALTH_POTION, amount: HEALTH_POTION.amount });
      expect(unit.health).toBe(3 + HEALTH_POTION.amount);
      expect(unit.items[0].quantity).toBe(1);
    });

    it('restores mana with a mana potion and drops the empty entry', () => {
      const unit = stocked();
      unit.spendMana(5);
      expect(unit.useItem('mana-potion').amount).toBe(MANA_POTION.amount);
      expect(unit.mana).toBe(MANA_POTION.amount);
      expect(unit.items.map((entry) => entry.item)).toEqual([HEALTH_POTION]);
    });

    it('reports only what was actually restored near the maximum', () => {
      const unit = stocked();
      unit.takeDamage(1);
      expect(unit.useItem('health-potion').amount).toBe(1);
      expect(unit.health).toBe(unit.maxHealth);
    });

    it('still uses the item up when it restores nothing', () => {
      const unit = stocked();
      expect(unit.useItem('mana-potion').amount).toBe(0);
      expect(unit.mana).toBe(5);
      expect(unit.items).toHaveLength(1);
    });

    it('throws for an item it does not carry, changing nothing', () => {
      const unit = makeUnit();
      unit.takeDamage(5);
      expect(() => unit.useItem('health-potion')).toThrow();
      expect(unit.health).toBe(5);
    });

    it('throws for a weapon, which is fought with rather than used', () => {
      const unit = makeUnit({ items: [weaponEntry(IRON_SPEAR)], weaponTypes: ['physical'] });
      expect(() => unit.useItem('iron-spear')).toThrow(/iron-spear/);
      expect(unit.weapon).toBe(IRON_SPEAR);
    });
  });

  describe('levelUp', () => {
    it('raises the level by one', () => {
      const unit = makeUnit();
      expect(unit.levelUp()).toBe(2);
      expect(unit.level).toBe(2);
    });

    it('applies stat gains, raising max and current health and mana', () => {
      const unit = new Unit({ name: 'U', health: 10, mana: 5, strength: 4, defense: 2, movement: 5, team: 'player' });
      unit.takeDamage(4);
      unit.spendMana(2);
      unit.levelUp({ health: 2, mana: 1, strength: 1, luck: 1, resistance: 0 });
      expect(unit.maxHealth).toBe(12);
      expect(unit.health).toBe(8);
      expect(unit.maxMana).toBe(6);
      expect(unit.mana).toBe(4);
      expect(unit.strength).toBe(5);
      expect(unit.luck).toBe(1);
      expect(unit.resistance).toBe(0);
    });
  });

  describe('gainExperience', () => {
    const makeGrower = (growths: GrowthTable) =>
      new Unit({ name: 'U', health: 10, strength: 4, defense: 2, movement: 5, team: 'player', growths });

    it('starts at 0 XP and stores what it gains', () => {
      const unit = makeGrower({});
      expect(unit.experience).toBe(0);
      unit.gainExperience(30);
      expect(unit.experience).toBe(30);
      expect(unit.level).toBe(1);
    });

    it('levels up with its growths and carries the overflow', () => {
      const unit = makeGrower({ health: 100, strength: 100 });
      unit.experience = 30;
      const result = unit.gainExperience(45);
      expect(unit.level).toBe(2);
      expect(unit.experience).toBe(25);
      expect(unit.maxHealth).toBe(11);
      expect(unit.strength).toBe(5);
      expect(unit.defense).toBe(2);
      expect(result.levelUps).toHaveLength(1);
    });

    it('applies several level ups at once', () => {
      const unit = makeGrower({ strength: 100 });
      unit.gainExperience(200);
      expect(unit.level).toBe(3);
      expect(unit.strength).toBe(6);
      expect(unit.experience).toBe(50);
    });
  });

  describe('armor', () => {
    it('wears its armor in its slots, adding its defense apart from the stat', () => {
      const unit = makeUnit({
        items: [weaponEntry(IRON_SPEAR), { item: WOODEN_SHIELD, quantity: 1 }, { item: WOODEN_ARMOR, quantity: 1 }],
      });
      expect(unit.equipment).toEqual({ main: IRON_SPEAR, off: WOODEN_SHIELD, body: WOODEN_ARMOR });
      expect(unit.wornArmor.map((armor) => armor.id)).toEqual(['wooden-shield', 'wooden-armor']);
      expect(unit.armorDefense).toBe(2);
      expect(unit.armorWeight).toBe(3);
      expect(unit.defense).toBe(2);
    });

    it('has no hand free for a shield with a two-handed weapon', () => {
      const unit = makeUnit({ items: [weaponEntry(IRON_BOW), { item: WOODEN_SHIELD, quantity: 1 }] });
      expect(unit.canUseShield).toBe(false);
      expect(unit.equipment.off).toBeUndefined();
      expect(unit.armorDefense).toBe(0);
    });

    it('wears nothing without armor', () => {
      expect(makeUnit().armorDefense).toBe(0);
      expect(makeUnit().armorWeight).toBe(0);
    });
  });
});
