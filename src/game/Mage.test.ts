import { describe, expect, it } from 'vitest';
import { Acolyte } from './Acolyte.ts';
import { HEALTH_POTION, MANA_POTION } from './items.ts';
import { MAGE_GROWTHS, MAGE_ITEMS, MAGE_STATS, Mage } from './Mage.ts';
import { findPromotion, promoteUnit } from './promotions.ts';
import { getClassSkillPicks, getLearnedSkills, FIREBALL, FLARE, FROST_LANCE, MEND, SIPHON } from './skills.ts';
import { getUnitSprite } from './tileset.ts';
import { Unit } from './Unit.ts';
import { FIRE, FIRE_SPELL } from './weapons.ts';

describe('Mage', () => {
  it('is a Unit of the mage class on the mage stat line, with its passive', () => {
    const mage = new Mage({ team: 'enemy' });
    expect(mage).toBeInstanceOf(Unit);
    expect(mage.unitClass).toBe('mage');
    expect(mage.maxHealth).toBe(MAGE_STATS.health);
    expect(mage.maxMana).toBe(MAGE_STATS.mana);
    expect(mage.intelligence).toBe(MAGE_STATS.intelligence);
    expect(mage.growths).toBe(MAGE_GROWTHS);
    expect(mage.modifiers).toContainEqual({ kind: 'combat', term: 'damage', amount: 2 });
  });

  it('knows Fire and carries the potions', () => {
    const mage = new Mage({ team: 'player' });
    expect(MAGE_ITEMS.map((entry) => entry.item)).toEqual([FIRE_SPELL, HEALTH_POTION, MANA_POTION]);
    expect(mage.innate).toEqual([FIRE_SPELL]);
    expect(mage.items.map((entry) => entry.item)).toEqual([HEALTH_POTION, MANA_POTION]);
    expect(mage.weapon).toBe(FIRE_SPELL);
    expect(mage.weaponTypes).toEqual(['magical']);
  });

  it("keeps the acolyte's Mend and learns Flare, and is offered only its own picks", () => {
    expect(getLearnedSkills('mage', 1)).toEqual([]);
    expect(getLearnedSkills('mage', 2)).toEqual([MEND, FLARE]);
    expect(getClassSkillPicks('mage')).toEqual([FIREBALL, FROST_LANCE, SIPHON]);
  });

  it('wears the Mage art in its faction', () => {
    expect(getUnitSprite('mage', 'sunward')).toBe('Mage_02');
    expect(getUnitSprite('mage', 'crimson')).toBe('Mage_06');
  });
});

describe('promoting an acolyte to a mage', () => {
  it('makes it a mage with more MP, INT and SKL, keeping its level, items and Mend', () => {
    const acolyte = new Acolyte({ team: 'player', level: 5 });
    const before = { mana: acolyte.maxMana, intelligence: acolyte.intelligence, skill: acolyte.skill };
    const items = acolyte.items;
    const mage = findPromotion('mage')!;
    expect(mage.from).toBe('acolyte');
    expect(mage.gift).toBe(FIRE);
    promoteUnit(acolyte, mage);
    expect(acolyte.unitClass).toBe('mage');
    expect(acolyte.level).toBe(5);
    expect(acolyte.items).toBe(items);
    expect(acolyte.maxMana).toBe(before.mana + 1);
    expect(acolyte.intelligence).toBe(before.intelligence + 2);
    expect(acolyte.skill).toBe(before.skill + 1);
    expect(acolyte.growths).toBe(MAGE_GROWTHS);
    expect(getLearnedSkills(acolyte.unitClass, acolyte.level)).toContain(MEND);
  });
});
