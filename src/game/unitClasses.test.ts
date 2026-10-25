import { describe, expect, it } from 'vitest';
import { Soldier } from './Soldier.ts';
import { createUnitOfClass, PLAYABLE_CLASSES, UNIT_CLASSES } from './unitClasses.ts';
import type { ClassUnitOptions, Unit } from './Unit.ts';

describe('UNIT_CLASSES', () => {
  it('lists the six player classes, then the twelve promoted classes, then the six monsters', () => {
    expect(UNIT_CLASSES.map((c) => c.id)).toEqual([
      'warrior',
      'soldier',
      'archer',
      'vanguard',
      'guard',
      'acolyte',
      'hero',
      'berserker',
      'general',
      'halberdier',
      'sniper',
      'arbalest',
      'champion',
      'bombardier',
      'bastion',
      'templar',
      'bishop',
      'sage',
      'slime',
      'goblin',
      'skeleton',
      'bat',
      'wolf',
      'orc',
    ]);
    expect(UNIT_CLASSES.map((c) => c.label)).toEqual([
      'Warrior',
      'Soldier',
      'Archer',
      'Vanguard',
      'Guard',
      'Acolyte',
      'Hero',
      'Berserker',
      'General',
      'Halberdier',
      'Sniper',
      'Arbalest',
      'Champion',
      'Bombardier',
      'Bastion',
      'Templar',
      'Bishop',
      'Sage',
      'Slime',
      'Goblin',
      'Skeleton',
      'Bat',
      'Wolf',
      'Orc',
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
});

describe('PLAYABLE_CLASSES', () => {
  it('lists the six player classes and none of the promoted classes or monsters', () => {
    expect(PLAYABLE_CLASSES.map((c) => c.id)).toEqual(['warrior', 'soldier', 'archer', 'vanguard', 'guard', 'acolyte']);
  });

  it('marks exactly the six monsters as monsters', () => {
    expect(UNIT_CLASSES.filter((c) => c.monster).map((c) => c.id)).toEqual([
      'slime',
      'goblin',
      'skeleton',
      'bat',
      'wolf',
      'orc',
    ]);
  });

  it('marks each promoted class with the class it promotes from', () => {
    expect(UNIT_CLASSES.filter((c) => c.promotedFrom).map((c) => [c.id, c.promotedFrom])).toEqual([
      ['hero', 'warrior'],
      ['berserker', 'warrior'],
      ['general', 'soldier'],
      ['halberdier', 'soldier'],
      ['sniper', 'archer'],
      ['arbalest', 'archer'],
      ['champion', 'vanguard'],
      ['bombardier', 'vanguard'],
      ['bastion', 'guard'],
      ['templar', 'guard'],
      ['bishop', 'acolyte'],
      ['sage', 'acolyte'],
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
    expect(() => createUnitOfClass('dragon', { team: 'player' })).toThrow('Unknown unit class: dragon');
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
