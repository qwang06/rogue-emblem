import { describe, expect, it } from 'vitest';
import { UNIT_CLASSES } from '../unitClasses.ts';
import {
  ALL_STARTING_CLASSES,
  DEFAULT_STARTING_CLASS,
  STARTING_CLASSES,
  UNLOCKABLE_STARTING_CLASSES,
} from './startingClasses.ts';

describe('STARTING_CLASSES', () => {
  it('offers the Warrior, the Soldier and the Archer, in that order', () => {
    expect(STARTING_CLASSES.map((c) => c.id)).toEqual(['warrior', 'soldier', 'archer']);
    expect(STARTING_CLASSES.map((c) => c.label)).toEqual(['Warrior', 'Soldier', 'Archer']);
  });

  it('names only real classes, with their own labels', () => {
    for (const { id, label } of STARTING_CLASSES) {
      expect(UNIT_CLASSES.find((c) => c.id === id)?.label).toBe(label);
    }
  });

  it('pitches each class', () => {
    for (const { description } of STARTING_CLASSES) expect(description.length).toBeGreaterThan(0);
  });

  it('defaults to one of them', () => {
    expect(STARTING_CLASSES.map((c) => c.id)).toContain(DEFAULT_STARTING_CLASS);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(STARTING_CLASSES)).toBe(true);
    expect(STARTING_CLASSES.every(Object.isFrozen)).toBe(true);
  });
});

describe('UNLOCKABLE_STARTING_CLASSES', () => {
  it('offers the Vanguard and the Guard once renown opens them', () => {
    expect(UNLOCKABLE_STARTING_CLASSES.map((c) => c.id)).toEqual(['vanguard', 'guard']);
  });

  it('names only real playable classes, with their own labels and a pitch, none of them base classes', () => {
    for (const { id, label, description } of UNLOCKABLE_STARTING_CLASSES) {
      const unitClass = UNIT_CLASSES.find((c) => c.id === id);
      expect(unitClass?.label).toBe(label);
      expect(unitClass?.monster).toBeFalsy();
      expect(description.length).toBeGreaterThan(0);
      expect(STARTING_CLASSES.map((c) => c.id)).not.toContain(id);
    }
  });

  it('joins the base classes in ALL_STARTING_CLASSES, frozen', () => {
    expect(ALL_STARTING_CLASSES).toEqual([...STARTING_CLASSES, ...UNLOCKABLE_STARTING_CLASSES]);
    expect(Object.isFrozen(UNLOCKABLE_STARTING_CLASSES)).toBe(true);
    expect(UNLOCKABLE_STARTING_CLASSES.every(Object.isFrozen)).toBe(true);
  });
});
