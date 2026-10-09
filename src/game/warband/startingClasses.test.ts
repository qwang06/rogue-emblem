import { describe, expect, it } from 'vitest';
import { UNIT_CLASSES } from '../unitClasses.ts';
import { DEFAULT_STARTING_CLASS, STARTING_CLASSES } from './startingClasses.ts';

describe('STARTING_CLASSES', () => {
  it('offers the Villager, the Soldier and the Archer, in that order', () => {
    expect(STARTING_CLASSES.map((c) => c.id)).toEqual(['villager', 'soldier', 'archer']);
    expect(STARTING_CLASSES.map((c) => c.label)).toEqual(['Villager', 'Soldier', 'Archer']);
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
