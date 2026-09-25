import { describe, expect, it } from 'vitest';
import { createActionMenu, getSelectedAction, moveSelection } from './actionMenu.js';
import { TITLE_ACTIONS } from './titleMenu.js';

describe('TITLE_ACTIONS', () => {
  it('lists Play then Settings', () => {
    expect(TITLE_ACTIONS.map((a) => a.id)).toEqual(['play', 'settings']);
    expect(TITLE_ACTIONS.map((a) => a.label)).toEqual(['Play', 'Settings']);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(TITLE_ACTIONS)).toBe(true);
    expect(TITLE_ACTIONS.every(Object.isFrozen)).toBe(true);
  });

  it('starts on Play and wraps between the two entries', () => {
    const menu = createActionMenu(TITLE_ACTIONS);
    expect(getSelectedAction(menu).id).toBe('play');
    expect(getSelectedAction(moveSelection(menu, 1)).id).toBe('settings');
    expect(getSelectedAction(moveSelection(menu, -1)).id).toBe('settings');
    expect(getSelectedAction(moveSelection(menu, 2)).id).toBe('play');
  });
});
