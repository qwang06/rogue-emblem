import { describe, expect, it } from 'vitest';
import { createActionMenu, getSelectedAction, moveSelection } from './actionMenu.ts';
import {
  getFirstEnabledIndex,
  getWarbandActions,
  SETTINGS_ACTIONS,
  STARTING_CLASS_ACTIONS,
  TITLE_ACTIONS,
} from './titleMenu.ts';
import { STARTING_CLASSES } from './warband/startingClasses.ts';
import { advanceStage, createRun } from './warband/run.ts';
import { createStartingWarband } from './warband/stageLevel.ts';

describe('TITLE_ACTIONS', () => {
  it('lists Story Mode, Warband Mode, Training, then Settings', () => {
    expect(TITLE_ACTIONS.map((a) => a.id)).toEqual(['story', 'warband', 'training', 'settings']);
    expect(TITLE_ACTIONS.map((a) => a.label)).toEqual(['Story Mode', 'Warband Mode', 'Training', 'Settings']);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(TITLE_ACTIONS)).toBe(true);
    expect(TITLE_ACTIONS.every(Object.isFrozen)).toBe(true);
  });

  it('starts on Story Mode and wraps around the entries', () => {
    const menu = createActionMenu(TITLE_ACTIONS);
    expect(getSelectedAction(menu)!.id).toBe('story');
    expect(getSelectedAction(moveSelection(menu, 1))!.id).toBe('warband');
    expect(getSelectedAction(moveSelection(menu, -1))!.id).toBe('settings');
    expect(getSelectedAction(moveSelection(menu, 4))!.id).toBe('story');
  });
});

describe('SETTINGS_ACTIONS', () => {
  it('offers the game configs', () => {
    expect(SETTINGS_ACTIONS.map((a) => a.id)).toEqual(['configs']);
    expect(SETTINGS_ACTIONS.map((a) => a.label)).toEqual(['Game Configs']);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(SETTINGS_ACTIONS)).toBe(true);
    expect(SETTINGS_ACTIONS.every(Object.isFrozen)).toBe(true);
  });
});

describe('getWarbandActions', () => {
  it('offers to continue the saved run at its stage, or start a new one', () => {
    const run = advanceStage(advanceStage(createRun(1, createStartingWarband())));
    const actions = getWarbandActions(run);
    expect(actions.map((a) => a.id)).toEqual(['continue-run', 'new-run']);
    expect(actions.map((a) => a.label)).toEqual(['Continue Run (Stage 3)', 'New Run']);
    expect(Object.isFrozen(actions)).toBe(true);
  });

  it('shows Continue Run disabled when no run is saved', () => {
    const actions = getWarbandActions(null);
    expect(actions.map((a) => a.id)).toEqual(['continue-run', 'new-run']);
    expect(actions.map((a) => a.label)).toEqual(['Continue Run', 'New Run']);
    expect(actions.map((a) => a.disabled ?? false)).toEqual([true, false]);
    expect(Object.isFrozen(actions)).toBe(true);
  });

  it('leaves Continue Run enabled with a run saved', () => {
    expect(getWarbandActions(createRun(1, createStartingWarband()))[0].disabled).toBeUndefined();
  });
});

describe('STARTING_CLASS_ACTIONS', () => {
  it('offers each starting class by its id, with its pitch', () => {
    expect(STARTING_CLASS_ACTIONS.map((a) => a.id)).toEqual(['villager', 'soldier', 'archer']);
    expect(STARTING_CLASS_ACTIONS.map((a) => a.label)).toEqual(['Villager', 'Soldier', 'Archer']);
    expect(STARTING_CLASS_ACTIONS.map((a) => a.description)).toEqual(STARTING_CLASSES.map((c) => c.description));
  });

  it('is frozen', () => {
    expect(Object.isFrozen(STARTING_CLASS_ACTIONS)).toBe(true);
    expect(STARTING_CLASS_ACTIONS.every(Object.isFrozen)).toBe(true);
  });
});

describe('getFirstEnabledIndex', () => {
  it('skips disabled entries', () => {
    expect(getFirstEnabledIndex(getWarbandActions(null))).toBe(1);
    expect(getFirstEnabledIndex(getWarbandActions(createRun(1, createStartingWarband())))).toBe(0);
  });

  it('falls back to the first entry when all are disabled or there are none', () => {
    expect(getFirstEnabledIndex([{ id: 'a', label: 'A', disabled: true }])).toBe(0);
    expect(getFirstEnabledIndex([])).toBe(0);
  });
});
