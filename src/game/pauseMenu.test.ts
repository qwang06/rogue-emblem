import { describe, expect, it } from 'vitest';
import { createActionMenu, getSelectedAction, moveSelection } from './actionMenu.ts';
import { getPauseActions } from './pauseMenu.ts';

describe('getPauseActions', () => {
  it('lists End Turn, Undo, Main Menu, then Settings', () => {
    const actions = getPauseActions({ canUndo: true });
    expect(actions.map((a) => a.id)).toEqual(['end-turn', 'undo', 'main-menu', 'settings']);
    expect(actions.map((a) => a.label)).toEqual(['End Turn', 'Undo', 'Main Menu', 'Settings']);
  });

  it('greys out Undo when there is nothing to undo', () => {
    expect(getPauseActions({ canUndo: false }).find((a) => a.id === 'undo')!.disabled).toBe(true);
    expect(getPauseActions({ canUndo: true }).find((a) => a.id === 'undo')!.disabled).toBe(false);
  });

  it('is frozen', () => {
    const actions = getPauseActions({ canUndo: true });
    expect(Object.isFrozen(actions)).toBe(true);
    expect(actions.every(Object.isFrozen)).toBe(true);
  });

  it('starts on End Turn and wraps around the entries', () => {
    const menu = createActionMenu(getPauseActions({ canUndo: true }));
    expect(getSelectedAction(menu)!.id).toBe('end-turn');
    expect(getSelectedAction(moveSelection(menu, 1))!.id).toBe('undo');
    expect(getSelectedAction(moveSelection(menu, -1))!.id).toBe('settings');
  });
});
