import { describe, expect, it } from 'vitest';
import { Acolyte } from './Acolyte.ts';
import { BISHOP_GROWTHS, BISHOP_ITEMS, BISHOP_STATS, Bishop } from './Bishop.ts';
import { HEAL_STAFF } from './healing.ts';
import { HEALTH_POTION, MANA_POTION } from './items.ts';
import { findPromotion, promoteUnit } from './promotions.ts';
import { describeSkill, getClassSkillPicks, getLearnedSkills, MEND, PRAYER, SANCTUARY, SMITE, WARD } from './skills.ts';
import { getUnitSprite } from './tileset.ts';
import { Unit } from './Unit.ts';
import { LIGHT } from './weapons.ts';

describe('Bishop', () => {
  it('is a Unit of the bishop class on the bishop stat line, with its passive', () => {
    const bishop = new Bishop({ team: 'enemy' });
    expect(bishop).toBeInstanceOf(Unit);
    expect(bishop.unitClass).toBe('bishop');
    expect(bishop.maxHealth).toBe(BISHOP_STATS.health);
    expect(bishop.maxMana).toBe(BISHOP_STATS.mana);
    expect(bishop.resistance).toBe(BISHOP_STATS.resistance);
    expect(bishop.growths).toBe(BISHOP_GROWTHS);
    expect(bishop.modifiers).toContainEqual({ kind: 'phase-mana', amount: 1 });
  });

  it('knows Light and carries a Heal staff and the potions', () => {
    const bishop = new Bishop({ team: 'player' });
    expect(BISHOP_ITEMS.map((entry) => entry.item)).toEqual([LIGHT, HEAL_STAFF, HEALTH_POTION, MANA_POTION]);
    expect(bishop.innate).toEqual([LIGHT]);
    expect(bishop.equipment).toEqual({ main: HEAL_STAFF });
    expect(bishop.items.map((entry) => entry.item)).toEqual([HEALTH_POTION, MANA_POTION]);
    expect(bishop.weapon).toBe(LIGHT);
    expect(bishop.weaponTypes).toEqual(['magical']);
  });

  it("keeps the acolyte's Mend, learns Sanctuary and is offered the acolyte's picks", () => {
    expect(getLearnedSkills('bishop', 1)).toEqual([]);
    expect(getLearnedSkills('bishop', 2)).toEqual([MEND, SANCTUARY]);
    expect(getClassSkillPicks('bishop')).toEqual([SMITE, PRAYER, WARD]);
  });

  it('describes Sanctuary as a heal that spreads to the wounded around its target', () => {
    expect(describeSkill(SANCTUARY)).toBe(
      'Heals an ally up to 2 tiles away and every wounded ally on the four tiles around it for 2 + INT.',
    );
  });

  it('wears the Bishop art in its faction', () => {
    expect(getUnitSprite('bishop', 'sunward')).toBe('Bishop_02');
    expect(getUnitSprite('bishop', 'crimson')).toBe('Bishop_06');
  });
});

describe('promoting an acolyte to a bishop', () => {
  it('makes it a bishop with more HP, MP, INT, LCK, DEF and RES, keeping its level, items and Mend', () => {
    const acolyte = new Acolyte({ team: 'player', level: 5 });
    const before = {
      health: acolyte.maxHealth,
      mana: acolyte.maxMana,
      intelligence: acolyte.intelligence,
      luck: acolyte.luck,
      defense: acolyte.defense,
      resistance: acolyte.resistance,
    };
    const items = acolyte.items;
    const bishop = findPromotion('bishop')!;
    expect(bishop.from).toBe('acolyte');
    expect(bishop.tier).toBe(3);
    expect(bishop.gift).toBeNull();
    promoteUnit(acolyte, bishop);
    expect(acolyte.unitClass).toBe('bishop');
    expect(acolyte.level).toBe(5);
    expect(acolyte.items).toBe(items);
    expect({
      health: acolyte.maxHealth,
      mana: acolyte.maxMana,
      intelligence: acolyte.intelligence,
      luck: acolyte.luck,
      defense: acolyte.defense,
      resistance: acolyte.resistance,
    }).toEqual({
      health: before.health + 1,
      mana: before.mana + 2,
      intelligence: before.intelligence + 1,
      luck: before.luck + 1,
      defense: before.defense + 1,
      resistance: before.resistance + 2,
    });
    expect(acolyte.modifiers).toContainEqual({ kind: 'phase-mana', amount: 1 });
    expect(getLearnedSkills(acolyte.unitClass, acolyte.level)).toEqual([MEND, SANCTUARY]);
  });
});
