import { describe, expect, it } from 'vitest';
import { createActionMenu, getSelectedAction, moveSelection } from './actionMenu.js';
import { PAUSE_ACTIONS } from './pauseMenu.js';

describe('PAUSE_ACTIONS', () => {
  it('lists Main Menu then Settings', () => {
    expect(PAUSE_ACTIONS.map((a) => a.id)).toEqual(['main-menu', 'settings']);
    expect(PAUSE_ACTIONS.map((a) => a.label)).toEqual(['Main Menu', 'Settings']);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(PAUSE_ACTIONS)).toBe(true);
    expect(PAUSE_ACTIONS.every(Object.isFrozen)).toBe(true);
  });

  it('starts on Main Menu and wraps between the two entries', () => {
    const menu = createActionMenu(PAUSE_ACTIONS);
    expect(getSelectedAction(menu).id).toBe('main-menu');
    expect(getSelectedAction(moveSelection(menu, 1)).id).toBe('settings');
    expect(getSelectedAction(moveSelection(menu, -1)).id).toBe('settings');
  });
});
