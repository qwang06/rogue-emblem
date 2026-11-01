import { describe, expect, it } from 'vitest';
import { Soldier } from './Soldier.ts';
import { createUnitOfClass, PLAYABLE_CLASSES, UNIT_CLASSES } from './unitClasses.ts';
import type { ClassUnitOptions, Unit } from './Unit.ts';
import { DEFAULT_ENEMY_FACTION, PLAYER_FACTION } from './factions.ts';

describe('UNIT_CLASSES', () => {
  it('lists the villager, its four promotions, the specialized units, the elementals, then the monsters', () => {
    expect(UNIT_CLASSES.map((c) => c.id)).toEqual([
      'villager',
      'archer',
      'soldier',
      'vanguard',
      'sapper',
      'scout',
      'beast',
      'whelp',
      'beast-rider',
      'siege',
      'ram',
      'acolyte',
      'mage',
      'water-elemental',
      'fire-elemental',
      'air-elemental',
      'earth-elemental',
      'slime',
      'goblin',
      'skeleton',
      'bat',
      'orc',
      'dragon',
    ]);
    expect(UNIT_CLASSES.map((c) => c.label)).toEqual([
      'Villager',
      'Archer',
      'Soldier',
      'Vanguard',
      'Sapper',
      'Scout',
      'Beast',
      'Whelp',
      'Beast Rider',
      'Siege',
      'Ram',
      'Acolyte',
      'Mage',
      'Water Elemental',
      'Fire Elemental',
      'Air Elemental',
      'Earth Elemental',
      'Slime',
      'Goblin',
      'Skeleton',
      'Bat',
      'Orc',
      'Dragon',
    ]);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(UNIT_CLASSES)).toBe(true);
    expect(UNIT_CLASSES.every(Object.isFrozen)).toBe(true);
  });

  it('builds units whose unitClass matches the entry id', () => {
    for (const { id } of UNIT_CLASSES) {
      expect(createUnitOfClass(id, { team: 'player' }).unitClass).toBe(id);
    }
  });

  it("gives faction units their team's faction or the one asked for, and neutral units and monsters none", () => {
    expect(createUnitOfClass('archer', { team: 'player' }).faction).toBe(PLAYER_FACTION);
    expect(createUnitOfClass('archer', { team: 'enemy' }).faction).toBe(DEFAULT_ENEMY_FACTION);
    expect(createUnitOfClass('ram', { team: 'enemy', faction: 'azure' }).faction).toBe('azure');
    expect(createUnitOfClass('fire-elemental', { team: 'enemy', faction: 'azure' }).faction).toBeNull();
    expect(createUnitOfClass('orc', { team: 'enemy' }).faction).toBeNull();
  });
});

describe('PLAYABLE_CLASSES', () => {
  it('lists the villager and the specialized units, none of the promoted, neutral or monster classes', () => {
    expect(PLAYABLE_CLASSES.map((c) => c.id)).toEqual([
      'villager',
      'scout',
      'beast',
      'whelp',
      'beast-rider',
      'siege',
      'ram',
      'acolyte',
    ]);
  });

  it('marks exactly the monsters as monsters, and the elementals as neutral', () => {
    expect(UNIT_CLASSES.filter((c) => c.monster).map((c) => c.id)).toEqual([
      'slime',
      'goblin',
      'skeleton',
      'bat',
      'orc',
      'dragon',
    ]);
    expect(UNIT_CLASSES.filter((c) => c.neutral).map((c) => c.id)).toEqual([
      'water-elemental',
      'fire-elemental',
      'air-elemental',
      'earth-elemental',
    ]);
  });

  it('marks each promoted class with the class it promotes from', () => {
    expect(UNIT_CLASSES.filter((c) => c.promotedFrom).map((c) => [c.id, c.promotedFrom])).toEqual([
      ['archer', 'villager'],
      ['soldier', 'villager'],
      ['vanguard', 'villager'],
      ['sapper', 'villager'],
      ['mage', 'acolyte'],
    ]);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(PLAYABLE_CLASSES)).toBe(true);
  });
});

describe('createUnitOfClass', () => {
  it('builds a unit of the class with the given options', () => {
    const unit = createUnitOfClass('soldier', { name: 'Alden', team: 'enemy', level: 2 });
    expect(unit).toBeInstanceOf(Soldier);
    expect(unit.name).toBe('Alden');
    expect(unit.team).toBe('enemy');
    expect(unit.level).toBe(2);
  });

  it('builds a fresh unit each call', () => {
    expect(createUnitOfClass('soldier', { team: 'player' })).not.toBe(createUnitOfClass('soldier', { team: 'player' }));
  });

  it('throws on an unknown class', () => {
    expect(() => createUnitOfClass('kraken', { team: 'player' })).toThrow('Unknown unit class: kraken');
  });

  it('can use a custom class list', () => {
    // A stand-in class whose 'units' are plain objects.
    const classes = [
      {
        id: 'dummy',
        label: 'Dummy',
        create: (o: ClassUnitOptions) => ({ ...o, unitClass: 'dummy' }) as unknown as Unit,
      },
    ];
    expect(createUnitOfClass('dummy', { team: 'player' }, classes)).toEqual({ team: 'player', unitClass: 'dummy' });
    expect(() => createUnitOfClass('soldier', { team: 'player' }, classes)).toThrow();
  });
});
