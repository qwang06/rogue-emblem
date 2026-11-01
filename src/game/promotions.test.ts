import { describe, expect, it } from 'vitest';
import { ARCHER_GROWTHS } from './Archer.ts';
import { GROWTH_STATS } from './experience.ts';
import { getStandingCombatBonus } from './modifiers.ts';
import {
  becomePromotedClass,
  canPromote,
  findPromotion,
  getPromotionGains,
  getPromotions,
  isPromotedClass,
  promoteUnit,
  PROMOTION_LEVEL,
  PROMOTIONS,
} from './promotions.ts';
import { createUnitOfClass, UNIT_CLASSES } from './unitClasses.ts';
import { Villager } from './Villager.ts';
import { IRON_BOW } from './weapons.ts';

const archer = findPromotion('archer')!;
const vanguard = findPromotion('vanguard')!;

describe('PROMOTIONS', () => {
  it('gives the villager the four tier-2 classes, the acolyte the mage, and nothing else any', () => {
    expect(getPromotions('villager').map(({ id }) => id)).toEqual(['archer', 'soldier', 'vanguard', 'sapper']);
    expect(getPromotions('acolyte').map(({ id }) => id)).toEqual(['mage']);
    for (const { id } of UNIT_CLASSES) {
      if (id !== 'villager' && id !== 'acolyte') expect(getPromotions(id), id).toEqual([]);
    }
    expect(getPromotions(null)).toEqual([]);
  });

  it("takes the promoted class's own growths", () => {
    expect(archer.growths).toEqual(ARCHER_GROWTHS);
  });

  it('adds what the class starts above a villager, and MOV either way', () => {
    expect(archer.bonuses).toEqual({ skill: 2, speed: 1, resistance: 1 });
    expect(vanguard.bonuses).toEqual({ health: 2, strength: 2 });
  });

  it('adds what the mage starts above an acolyte, the class it promotes from', () => {
    expect(findPromotion('mage')!.bonuses).toEqual({ mana: 1, intelligence: 2, skill: 1 });
  });

  it("puts the villager's promotions at tier 2 and the acolyte's mage at tier 3", () => {
    expect(PROMOTIONS.map(({ id, tier }) => [id, tier])).toEqual([
      ['archer', 2],
      ['soldier', 2],
      ['vanguard', 2],
      ['sapper', 2],
      ['mage', 3],
    ]);
  });

  it('keeps every growth at 0% or more', () => {
    for (const promotion of PROMOTIONS) {
      for (const stat of GROWTH_STATS) expect(promotion.growths[stat], promotion.id).toBeGreaterThanOrEqual(0);
    }
  });

  it('only hands over a gift the promoted class can wield', () => {
    for (const { id, gift, weaponTypes } of PROMOTIONS) {
      if (gift) expect(weaponTypes, id).toContain(gift.type);
    }
  });

  it('is frozen', () => {
    expect(Object.isFrozen(PROMOTIONS)).toBe(true);
    expect(PROMOTIONS.every((p) => Object.isFrozen(p) && Object.isFrozen(p.passive))).toBe(true);
  });
});

describe('lookups', () => {
  it('finds a promotion by id', () => {
    expect(findPromotion('sapper')?.from).toBe('villager');
    expect(findPromotion('villager')).toBeNull();
  });

  it('tells promoted classes apart', () => {
    expect(isPromotedClass('soldier')).toBe(true);
    expect(isPromotedClass('villager')).toBe(false);
    expect(isPromotedClass('scout')).toBe(false);
    expect(isPromotedClass(null)).toBe(false);
  });
});

describe('canPromote', () => {
  it('needs PROMOTION_LEVEL: one short, exact and over', () => {
    expect(canPromote({ classId: 'villager', level: PROMOTION_LEVEL - 1 })).toBe(false);
    expect(canPromote({ classId: 'villager', level: PROMOTION_LEVEL })).toBe(true);
    expect(canPromote({ classId: 'villager', level: 20 })).toBe(true);
  });

  it('is false for a promoted class, a specialized unit or a monster at any level', () => {
    expect(canPromote({ classId: 'archer', level: 20 })).toBe(false);
    expect(canPromote({ classId: 'scout', level: 20 })).toBe(false);
    expect(canPromote({ classId: 'orc', level: 20 })).toBe(false);
  });
});

describe('getPromotionGains', () => {
  it('gives each bonus in full, leaving out stats it doesn’t raise', () => {
    const unit = new Villager({ team: 'player' });
    expect(getPromotionGains(unit, archer)).toEqual({ skill: 2, speed: 1, resistance: 1 });
  });

  it('gives the full bonus however high the stat already is (no caps)', () => {
    const unit = new Villager({ team: 'player' });
    unit.skill = 99;
    expect(getPromotionGains(unit, archer).skill).toBe(2);
  });
});

describe('promoteUnit', () => {
  it('changes the class, growths, weapon types and XP rate, and adds the bonuses', () => {
    const unit = new Villager({ team: 'player', level: 6 });
    unit.health = 3;
    promoteUnit(unit, vanguard);
    expect(unit.unitClass).toBe('vanguard');
    expect(unit.level).toBe(6);
    expect(unit.growths).toEqual(vanguard.growths);
    expect(unit.experienceRate).toBe(100);
    expect(unit.maxHealth).toBe(12);
    expect(unit.health).toBe(5);
    expect(unit.strength).toBe(5);
  });

  it('carries the passive into battle', () => {
    const unit = promoteUnit(new Villager({ team: 'player' }), archer);
    expect(getStandingCombatBonus(unit.modifiers).hit).toBe(10);
  });

  it('adds a weapon type, and leaves handing over the gift to the caller', () => {
    const unit = promoteUnit(new Villager({ team: 'player' }), findPromotion('sapper')!);
    expect(unit.weaponTypes).toEqual(['physical', 'siege']);
    expect(unit.items.some(({ item }) => item.id === IRON_BOW.id)).toBe(false);
  });

  it('keeps items and boons', () => {
    const unit = new Villager({ team: 'player' });
    unit.boons = ['keen-eye'];
    const items = unit.items;
    promoteUnit(unit, archer);
    expect(unit.items).toBe(items);
    expect(unit.boons).toEqual(['keen-eye']);
  });
});

describe('becomePromotedClass', () => {
  it('changes the class but leaves the stats alone', () => {
    const unit = becomePromotedClass(new Villager({ team: 'player' }), vanguard);
    expect(unit.unitClass).toBe('vanguard');
    expect(unit.strength).toBe(3);
  });
});

describe('promoted classes as unit classes', () => {
  it("builds a fresh unit with its own class's stats, carrying the passive", () => {
    const unit = createUnitOfClass('soldier', { team: 'enemy' });
    expect(unit.unitClass).toBe('soldier');
    expect(unit.strength).toBe(4);
    expect(unit.weapon?.label).toBe('Iron Spear');
    expect(getStandingCombatBonus(unit.modifiers).guard).toBe(0);
    expect(unit.modifiers).toHaveLength(1);
  });
});
