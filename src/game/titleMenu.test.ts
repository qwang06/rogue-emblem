import { describe, expect, it } from 'vitest';
import { createActionMenu, getSelectedAction, moveSelection } from './actionMenu.ts';
import {
  getFirstEnabledIndex,
  getWarbandActions,
  getSettingsActions,
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

describe('getSettingsActions', () => {
  it('offers sound, volume and the game configs', () => {
    const actions = getSettingsActions({ muted: false, volume: 0.6 });
    expect(actions.map((a) => a.id)).toEqual(['sound', 'volume', 'configs']);
    expect(actions.map((a) => a.label)).toEqual(['Sound: On', 'Volume: 60%', 'Game Configs']);
  });

  it('shows sound off and the volume at its ends', () => {
    expect(getSettingsActions({ muted: true, volume: 1 }).map((a) => a.label)).toEqual([
      'Sound: Off',
      'Volume: 100%',
      'Game Configs',
    ]);
    expect(getSettingsActions({ muted: false, volume: 0 })[1].label).toBe('Volume: 0%');
  });

  it('is frozen', () => {
    const actions = getSettingsActions({ muted: false, volume: 0.6 });
    expect(Object.isFrozen(actions)).toBe(true);
    expect(actions.every(Object.isFrozen)).toBe(true);
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
    expect(STARTING_CLASS_ACTIONS.map((a) => a.id)).toEqual(['warrior', 'soldier', 'archer']);
    expect(STARTING_CLASS_ACTIONS.map((a) => a.label)).toEqual(['Warrior', 'Soldier', 'Archer']);
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
