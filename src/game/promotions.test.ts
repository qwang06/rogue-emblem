import { describe, expect, it } from 'vitest';
import { Acolyte } from './Acolyte.ts';
import { Archer } from './Archer.ts';
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
import { PLAYABLE_CLASSES, createUnitOfClass } from './unitClasses.ts';
import { Warrior, WARRIOR_CAPS } from './Warrior.ts';
import { BALLISTA } from './weapons.ts';

const hero = findPromotion('hero')!;

describe('PROMOTIONS', () => {
  it('gives every playable class exactly two promotions, and promoted classes none', () => {
    for (const { id } of PLAYABLE_CLASSES) expect(getPromotions(id), id).toHaveLength(2);
    for (const promotion of PROMOTIONS) expect(getPromotions(promotion.id), promotion.id).toEqual([]);
    expect(getPromotions('slime')).toEqual([]);
    expect(getPromotions(null)).toEqual([]);
    expect(PROMOTIONS).toHaveLength(12);
  });

  it('raises every cap by 5, HP by 10, over the base class', () => {
    for (const promotion of PROMOTIONS) {
      const base = createUnitOfClass(promotion.from, { team: 'player' });
      for (const [stat, cap] of Object.entries(base.caps)) {
        expect(promotion.caps[stat as keyof typeof promotion.caps], `${promotion.id} ${stat}`).toBe(
          cap + (stat === 'health' ? 10 : 5),
        );
      }
    }
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
    expect(findPromotion('sage')?.from).toBe('acolyte');
    expect(findPromotion('warrior')).toBeNull();
  });

  it('tells promoted classes apart and names their base class', () => {
    expect(isPromotedClass('general')).toBe(true);
    expect(isPromotedClass('soldier')).toBe(false);
    expect(isPromotedClass(null)).toBe(false);
    expect(getBaseClassId('general')).toBe('soldier');
    expect(getBaseClassId('soldier')).toBe('soldier');
  });
});

describe('canPromote', () => {
  it('needs PROMOTION_LEVEL: one short, exact and over', () => {
    expect(canPromote({ classId: 'warrior', level: PROMOTION_LEVEL - 1 })).toBe(false);
    expect(canPromote({ classId: 'warrior', level: PROMOTION_LEVEL })).toBe(true);
    expect(canPromote({ classId: 'warrior', level: 20 })).toBe(true);
  });

  it('is false for a promoted class or a monster at any level', () => {
    expect(canPromote({ classId: 'hero', level: 20 })).toBe(false);
    expect(canPromote({ classId: 'orc', level: 20 })).toBe(false);
  });
});

describe('getPromotionGains', () => {
  it('gives each bonus in full under the new cap, leaving out stats it doesn’t raise', () => {
    const unit = new Warrior({ team: 'player' });
    expect(getPromotionGains(unit, hero)).toEqual({
      health: 4,
      strength: 2,
      skill: 2,
      speed: 2,
      defense: 1,
      resistance: 1,
    });
  });

  it('cuts a bonus to what the new cap leaves, and to nothing at it', () => {
    const unit = new Warrior({ team: 'player' });
    unit.strength = hero.caps.strength! - 1;
    unit.skill = hero.caps.skill!;
    const gains = getPromotionGains(unit, hero);
    expect(gains.strength).toBe(1);
    expect(gains.skill).toBeUndefined();
  });
});

describe('promoteUnit', () => {
  it('changes the class, growths, caps and weapon types, and adds the bonuses', () => {
    const unit = new Warrior({ team: 'player', level: 6 });
    unit.health = 3;
    promoteUnit(unit, hero);
    expect(unit.unitClass).toBe('hero');
    expect(unit.level).toBe(6);
    expect(unit.caps).toEqual(hero.caps);
    expect(unit.caps.health).toBe(WARRIOR_CAPS.health + 10);
    expect(unit.growths).toEqual(hero.growths);
    expect(unit.maxHealth).toBe(14);
    expect(unit.health).toBe(7);
    expect(unit.strength).toBe(5);
  });

  it('carries the passive into battle', () => {
    const unit = promoteUnit(new Warrior({ team: 'player' }), hero);
    expect(getStandingCombatBonus(unit.modifiers).crit).toBe(10);
  });

  it('adds a second weapon type and changes MOV by its bonus', () => {
    const unit = promoteUnit(new Archer({ team: 'player' }), findPromotion('arbalest')!);
    expect(unit.weaponTypes).toEqual(['physical', 'siege']);
    expect(unit.movement).toBe(4);
    // The gift is handed over by the caller, not here.
    expect(unit.items.some(({ item }) => item.id === BALLISTA.id)).toBe(false);
  });

  it('raises current MP with max MP', () => {
    const unit = new Acolyte({ team: 'player' });
    unit.mana = 0;
    promoteUnit(unit, findPromotion('bishop')!);
    expect(unit.maxMana).toBe(9);
    expect(unit.mana).toBe(3);
  });

  it('keeps items and boons', () => {
    const unit = new Warrior({ team: 'player' });
    unit.boons = ['keen-eye'];
    const items = unit.items;
    promoteUnit(unit, hero);
    expect(unit.items).toBe(items);
    expect(unit.boons).toEqual(['keen-eye']);
  });
});

describe('becomePromotedClass', () => {
  it('changes the class but leaves the stats alone', () => {
    const unit = becomePromotedClass(new Warrior({ team: 'player' }), hero);
    expect(unit.unitClass).toBe('hero');
    expect(unit.strength).toBe(3);
  });
});

describe('promoted classes as unit classes', () => {
  it('builds a fresh unit with the base stats plus the bonuses', () => {
    const unit = createUnitOfClass('general', { team: 'enemy' });
    expect(unit.unitClass).toBe('general');
    expect(unit.defense).toBe(2 + 4);
    expect(unit.movement).toBe(5);
    expect(unit.weapon?.label).toBe('Iron Spear');
  });
});
