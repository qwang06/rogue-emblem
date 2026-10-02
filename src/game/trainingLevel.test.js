import { describe, expect, it } from 'vitest';
import { createDialog } from './dialog.js';
import { findUnit } from './grid.js';
import { getMovePath } from './movement.js';
import {
  createTrainingLevel,
  getTrainingActions,
  SPARRING_PARTNER_ID,
  SPARRING_PARTNER_POSITION,
  TRAINEE_ID,
  TRAINEE_POSITION,
  getTrainingOpeningDialog,
} from './trainingLevel.js';
import { UNIT_CLASSES } from './unitClasses.js';

describe('getTrainingActions', () => {
  it('offers one entry per unit class', () => {
    expect(getTrainingActions()).toEqual(UNIT_CLASSES.map(({ id, label }) => ({ id, label })));
  });

  it('is frozen', () => {
    const actions = getTrainingActions();
    expect(Object.isFrozen(actions)).toBe(true);
    expect(actions.every(Object.isFrozen)).toBe(true);
  });

  it('is empty with no classes', () => {
    expect(getTrainingActions([])).toEqual([]);
  });
});

describe('createTrainingLevel', () => {
  const level = createTrainingLevel('soldier');

  it('is a 3x3 grass field', () => {
    expect(level.grid.width).toBe(3);
    expect(level.grid.height).toBe(3);
    expect(level.grid.cells.every((c) => c.terrain === 'grass')).toBe(true);
  });

  it('places the trainee and the sparring partner at their positions', () => {
    expect(findUnit(level.grid, TRAINEE_ID)).toEqual(TRAINEE_POSITION);
    expect(findUnit(level.grid, SPARRING_PARTNER_ID)).toEqual(SPARRING_PARTNER_POSITION);
    expect(level.grid.cells.filter((c) => c.unitId)).toHaveLength(2);
  });

  it('puts the chosen class on the player team against the same class', () => {
    const trainee = level.units.get(TRAINEE_ID);
    const partner = level.units.get(SPARRING_PARTNER_ID);
    expect(trainee.team).toBe('player');
    expect(trainee.unitClass).toBe('soldier');
    expect(partner.team).toBe('enemy');
    expect(partner.unitClass).toBe('soldier');
    expect(partner.name).toBe('Sparring Partner');
  });

  it('registers exactly the two units on the map', () => {
    expect([...level.units.keys()].sort()).toEqual([SPARRING_PARTNER_ID, TRAINEE_ID].sort());
  });

  it('has nothing to deploy', () => {
    expect(level.roster).toEqual([]);
    expect(level.deploymentZone).toEqual([]);
  });

  it('lets the trainee step up next to the sparring partner', () => {
    expect(getMovePath(level.grid, TRAINEE_POSITION, { x: 1, y: 1 }, Infinity)).not.toBeNull();
  });

  it('builds a fresh level each call', () => {
    const other = createTrainingLevel('soldier');
    expect(other.units.get(TRAINEE_ID)).not.toBe(level.units.get(TRAINEE_ID));
  });

  it('opens with a greeting from the sparring partner', () => {
    expect(level.openingDialog).toEqual(getTrainingOpeningDialog('soldier'));
    expect(() => createDialog(level.openingDialog)).not.toThrow();
    expect(level.openingDialog.every((line) => line.speaker === 'Sparring Partner')).toBe(true);
  });

  it("gives the sparring partner the trainee's class as its portrait", () => {
    expect(level.openingDialog.every((line) => line.unitClass === 'soldier')).toBe(true);
    const villagerLevel = createTrainingLevel('villager');
    expect(villagerLevel.openingDialog.every((line) => line.unitClass === 'villager')).toBe(true);
  });

  it('pits a villager against a villager when the villager is chosen', () => {
    const villagerLevel = createTrainingLevel('villager');
    const trainee = villagerLevel.units.get(TRAINEE_ID);
    const partner = villagerLevel.units.get(SPARRING_PARTNER_ID);
    expect(trainee).toMatchObject({ team: 'player', unitClass: 'villager' });
    expect(partner).toMatchObject({ team: 'enemy', unitClass: 'villager' });
  });

  it('throws on an unknown class', () => {
    expect(() => createTrainingLevel('dragon')).toThrow();
  });
});
