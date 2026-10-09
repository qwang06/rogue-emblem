import { describe, expect, it } from 'vitest';
import { createActionMenu, getSelectedAction, moveSelection } from './actionMenu.ts';
import { SETTINGS_ACTIONS, TITLE_ACTIONS } from './titleMenu.ts';

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
