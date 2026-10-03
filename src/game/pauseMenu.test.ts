import { describe, expect, it } from 'vitest';
import { createActionMenu, getSelectedAction, moveSelection } from './actionMenu.ts';
import { PAUSE_ACTIONS } from './pauseMenu.ts';

describe('PAUSE_ACTIONS', () => {
  it('lists End Turn, Main Menu, then Settings', () => {
    expect(PAUSE_ACTIONS.map((a) => a.id)).toEqual(['end-turn', 'main-menu', 'settings']);
    expect(PAUSE_ACTIONS.map((a) => a.label)).toEqual(['End Turn', 'Main Menu', 'Settings']);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(PAUSE_ACTIONS)).toBe(true);
    expect(PAUSE_ACTIONS.every(Object.isFrozen)).toBe(true);
  });

  it('starts on End Turn and wraps around the entries', () => {
    const menu = createActionMenu(PAUSE_ACTIONS);
    expect(getSelectedAction(menu)!.id).toBe('end-turn');
    expect(getSelectedAction(moveSelection(menu, 1))!.id).toBe('main-menu');
    expect(getSelectedAction(moveSelection(menu, -1))!.id).toBe('settings');
  });
});
