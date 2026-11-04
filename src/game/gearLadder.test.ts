import { describe, expect, it } from 'vitest';
import {
  CLASS_ARMOR_WEIGHTS,
  GEAR_LADDER,
  GEAR_TIERS,
  getClassArmorWeight,
  getGearTier,
  getTierItemIds,
  isHigherTier,
  LADDER_ARMORS,
  LADDER_FAMILIES,
  LADDER_WEAPONS,
} from './gearLadder.ts';
import { ARMORS, isArmor, type Armor } from './items.ts';
import { isWeapon, WEAPONS, type Weapon } from './weapons.ts';

const ALL = [...WEAPONS, ...ARMORS];
const find = (id: string) => ALL.find((item) => item.id === id);

describe('the gear ladder', () => {
  it('names a real piece for every slot of every tier, each on one tier only', () => {
    const ids = GEAR_TIERS.flatMap(getTierItemIds);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(find(id), id).toBeDefined();
    for (const tier of GEAR_TIERS) for (const id of getTierItemIds(tier)) expect(getGearTier(id)).toBe(tier);
    expect(getGearTier('fists')).toBeNull();
  });

  it('is registered in WEAPONS and ARMORS', () => {
    for (const weapon of LADDER_WEAPONS) expect(WEAPONS).toContain(weapon);
    for (const armor of LADDER_ARMORS) expect(ARMORS).toContain(armor);
  });

  it('puts each family on every tier, of that family, never weaker or lighter than the tier before', () => {
    for (const family of LADDER_FAMILIES) {
      const pieces = GEAR_TIERS.map((tier) => find(GEAR_LADDER[tier].weapons[family]) as Weapon);
      for (const piece of pieces) expect(isWeapon(piece) && piece.type, piece.id).toBe(family);
      for (let i = 1; i < pieces.length; i++) {
        // The wooden spear already has the iron spear's power (but less hit).
        expect(pieces[i].power, pieces[i].id).toBeGreaterThanOrEqual(pieces[i - 1].power);
        expect(pieces[i].weight, pieces[i].id).toBeGreaterThanOrEqual(pieces[i - 1].weight);
      }
      expect(pieces[3].power).toBeGreaterThan(pieces[1].power);
    }
  });

  it('gives bows both hands and a range of 2 only', () => {
    for (const tier of GEAR_TIERS) {
      expect(find(GEAR_LADDER[tier].weapons.bow)).toMatchObject({ hands: 2, minRange: 2, maxRange: 2 });
    }
  });

  it('makes daggers the only family that crits', () => {
    for (const weapon of LADDER_WEAPONS) {
      if (weapon.type === 'dagger') expect(weapon.crit).toBeGreaterThan(0);
      else expect(weapon.crit).toBe(0);
    }
  });

  it('wears each armor piece in its slot and weight, guarding more each tier', () => {
    const guard = (armor: Armor) => armor.defense + (armor.avoid ?? 0) / 5 + (armor.resistance ?? 0);
    for (const slot of ['body', 'head'] as const) {
      for (const weight of ['heavy', 'light', 'cloth'] as const) {
        const pieces = GEAR_TIERS.map((tier) => find(GEAR_LADDER[tier][slot][weight]) as Armor);
        for (const piece of pieces) expect(piece, piece.id).toMatchObject({ slot, weightClass: weight });
        for (let i = 1; i < pieces.length; i++) expect(guard(pieces[i])).toBeGreaterThanOrEqual(guard(pieces[i - 1]));
        if (weight === 'cloth') for (const piece of pieces) expect(piece.weight).toBe(0);
      }
    }
    for (const tier of GEAR_TIERS) expect((find(GEAR_LADDER[tier].shield) as Armor).slot).toBe('shield');
  });

  it('makes heavy the most DEF and the most weight, light the avoid, cloth the RES', () => {
    for (const tier of GEAR_TIERS) {
      const [heavy, light, cloth] = (['heavy', 'light', 'cloth'] as const).map(
        (weight) => find(GEAR_LADDER[tier].body[weight]) as Armor,
      );
      expect(heavy.defense).toBeGreaterThan(light.defense);
      expect(heavy.weight).toBeGreaterThan(light.weight);
      expect(light.avoid).toBeGreaterThan(0);
      expect(cloth.resistance).toBeGreaterThan(0);
      expect(isArmor(cloth)).toBe(true);
    }
  });
});

describe('getClassArmorWeight', () => {
  it('dresses the front line in heavy, casters in cloth and the rest in light', () => {
    expect(getClassArmorWeight('soldier')).toBe('heavy');
    expect(getClassArmorWeight('mage')).toBe('cloth');
    expect(getClassArmorWeight('archer')).toBe('light');
    expect(getClassArmorWeight(null)).toBe('light');
    expect(Object.values(CLASS_ARMOR_WEIGHTS)).not.toContain('light');
  });
});

describe('isHigherTier', () => {
  it('orders the tiers wooden, iron, steel, silver', () => {
    expect(isHigherTier('iron', 'wooden')).toBe(true);
    expect(isHigherTier('silver', 'steel')).toBe(true);
    expect(isHigherTier('iron', 'iron')).toBe(false);
    expect(isHigherTier('wooden', 'steel')).toBe(false);
  });
});
