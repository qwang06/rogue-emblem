import { describe, expect, it } from 'vitest';
import type { DialogScripts } from './dialogScript.ts';
import { DIALOGS } from '../data/dialogs.ts';
import { createDialog } from './dialog.ts';
import { findUnit } from './grid.ts';
import { getMovePath } from './movement.ts';
import {
  createTrainingLevel,
  getTrainingActions,
  getTrainingDialogs,
  SPARRING_PARTNER_ID,
  SPARRING_PARTNER_POSITION,
  TRAINEE_ID,
  TRAINEE_POSITION,
} from './trainingLevel.ts';
import { PLAYABLE_CLASSES, UNIT_CLASSES } from './unitClasses.ts';

describe('getTrainingActions', () => {
  it('offers one entry per playable class', () => {
    expect(getTrainingActions()).toEqual(PLAYABLE_CLASSES.map(({ id, label }) => ({ id, label })));
  });

  it('leaves out the monsters', () => {
    const ids = getTrainingActions().map((a) => a.id);
    expect(ids).not.toContain('slime');
    expect(ids).not.toContain('goblin');
    expect(ids).not.toContain('skeleton');
  });

  it('offers whatever classes it is given', () => {
    expect(getTrainingActions(UNIT_CLASSES)).toHaveLength(UNIT_CLASSES.length);
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

describe('getTrainingDialogs', () => {
  it('keeps every conversation from training.txt, with the given class on each line', () => {
    const dialogs = getTrainingDialogs('villager');
    expect(Object.keys(dialogs)).toEqual(Object.keys(DIALOGS.training));
    for (const [trigger, lines] of Object.entries(dialogs)) {
      expect(lines).toEqual(DIALOGS.training[trigger].map((line) => ({ ...line, unitClass: 'villager' })));
    }
  });

  it('is frozen and leaves the loaded dialogs alone', () => {
    const dialogs = getTrainingDialogs('soldier');
    expect(Object.isFrozen(dialogs)).toBe(true);
    expect(Object.isFrozen(dialogs.opening)).toBe(true);
    expect(dialogs.opening.every(Object.isFrozen)).toBe(true);
    expect(DIALOGS.training.opening[0].unitClass).toBeNull();
  });

  it('is empty for a level without dialog', () => {
    expect(getTrainingDialogs('soldier', {})).toEqual({});
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
    expect(trainee!.team).toBe('player');
    expect(trainee!.unitClass).toBe('soldier');
    expect(partner!.team).toBe('enemy');
    expect(partner!.unitClass).toBe('soldier');
    expect(partner!.name).toBe('Sparring Partner');
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
    expect(level.dialogs).toEqual(getTrainingDialogs('soldier'));
    expect(() => createDialog(level.dialogs.opening)).not.toThrow();
    expect(level.dialogs.opening.every((line) => line.speaker === 'Sparring Partner')).toBe(true);
  });

  it("gives the sparring partner the trainee's class as its portrait", () => {
    const allLines = (dialogs: DialogScripts) => Object.values(dialogs).flat();
    expect(allLines(level.dialogs).every((line) => line.unitClass === 'soldier')).toBe(true);
    const villagerLevel = createTrainingLevel('villager');
    expect(allLines(villagerLevel.dialogs).every((line) => line.unitClass === 'villager')).toBe(true);
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
