import { describe, expect, it } from 'vitest';
import { Elemental, ELEMENTAL_KINDS, ELEMENTALS, elementalClassId, getElementalItems } from './Elemental.ts';
import { FIRE_SPELL, LIGHT, TACKLE } from './weapons.ts';

describe('Elemental', () => {
  it('builds one class per element, named after it', () => {
    expect(ELEMENTAL_KINDS.map(elementalClassId)).toEqual([
      'water-elemental',
      'fire-elemental',
      'air-elemental',
      'earth-elemental',
    ]);
    const unit = new Elemental('fire', { team: 'enemy' });
    expect(unit.unitClass).toBe('fire-elemental');
    expect(unit.name).toBe('Fire Elemental');
    expect(unit.kind).toBe('fire');
    expect(unit.level).toBe(1);
  });

  it("uses its element's stat line, growths", () => {
    for (const kind of ELEMENTAL_KINDS) {
      const unit = new Elemental(kind, { team: 'enemy' });
      const line = ELEMENTALS[kind];
      expect(unit.maxHealth, kind).toBe(line.stats.health);
      expect(unit.intelligence, kind).toBe(line.stats.intelligence);
      expect(unit.movement, kind).toBe(line.stats.movement);
      expect(unit.growths, kind).toBe(line.growths);
    }
  });

  it('carries only its natural weapon, and wields it', () => {
    expect(getElementalItems('water').map(({ item }) => item)).toEqual([LIGHT]);
    expect(getElementalItems('fire').map(({ item }) => item)).toEqual([FIRE_SPELL]);
    expect(getElementalItems('earth').map(({ item }) => item)).toEqual([TACKLE]);
    for (const kind of ELEMENTAL_KINDS) {
      expect(new Elemental(kind, { team: 'player' }).weapon, kind).toBe(ELEMENTALS[kind].weapon);
    }
  });

  it('belongs to no faction, whatever it is given', () => {
    expect(new Elemental('air', { team: 'player' }).faction).toBeNull();
    expect(new Elemental('air', { team: 'enemy', faction: 'azure' }).faction).toBeNull();
  });

  it('takes a name and level', () => {
    const unit = new Elemental('earth', { team: 'enemy', name: 'Golem', level: 3 });
    expect(unit.name).toBe('Golem');
    expect(unit.level).toBe(3);
  });
});
