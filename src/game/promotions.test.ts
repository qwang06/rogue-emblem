import { describe, expect, it } from 'vitest';
import { ARCHER_CAPS, ARCHER_GROWTHS } from './Archer.ts';
import { GROWTH_STATS } from './experience.ts';
import { getStandingCombatBonus } from './modifiers.ts';
import {
  becomePromotedClass,
  canPromote,
  findPromotion,
  getBaseClassId,
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
  it('gives the villager the four tier-2 classes, and nothing else any', () => {
    expect(getPromotions('villager').map(({ id }) => id)).toEqual(['archer', 'soldier', 'vanguard', 'sapper']);
    for (const { id } of UNIT_CLASSES) if (id !== 'villager') expect(getPromotions(id), id).toEqual([]);
    expect(getPromotions(null)).toEqual([]);
  });

  it("takes the promoted class's own growths and caps", () => {
    expect(archer.growths).toEqual(ARCHER_GROWTHS);
    expect(archer.caps).toEqual(ARCHER_CAPS);
  });

  it('adds what the class starts above a villager, and MOV either way', () => {
    expect(archer.bonuses).toEqual({ skill: 2, speed: 1, resistance: 1 });
    expect(vanguard.bonuses).toEqual({ health: 2, strength: 2 });
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

  it('tells promoted classes apart and names their base class', () => {
    expect(isPromotedClass('soldier')).toBe(true);
    expect(isPromotedClass('villager')).toBe(false);
    expect(isPromotedClass('scout')).toBe(false);
    expect(isPromotedClass(null)).toBe(false);
    expect(getBaseClassId('soldier')).toBe('villager');
    expect(getBaseClassId('scout')).toBe('scout');
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
  it('gives each bonus in full under the new cap, leaving out stats it doesn’t raise', () => {
    const unit = new Villager({ team: 'player' });
    expect(getPromotionGains(unit, archer)).toEqual({ skill: 2, speed: 1, resistance: 1 });
  });

  it('cuts a bonus to what the new cap leaves, and to nothing at it', () => {
    const unit = new Villager({ team: 'player' });
    unit.skill = archer.caps.skill! - 1;
    unit.speed = archer.caps.speed!;
    const gains = getPromotionGains(unit, archer);
    expect(gains.skill).toBe(1);
    expect(gains.speed).toBeUndefined();
  });
});

describe('promoteUnit', () => {
  it('changes the class, growths, caps, weapon types and XP rate, and adds the bonuses', () => {
    const unit = new Villager({ team: 'player', level: 6 });
    unit.health = 3;
    promoteUnit(unit, vanguard);
    expect(unit.unitClass).toBe('vanguard');
    expect(unit.level).toBe(6);
    expect(unit.caps).toEqual(vanguard.caps);
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
