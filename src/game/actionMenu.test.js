import { describe, expect, it } from 'vitest';
import {
  UNIT_ACTIONS,
  createActionMenu,
  getSelectedAction,
  moveSelection,
  selectIndex,
} from './actionMenu.js';

describe('UNIT_ACTIONS', () => {
  it('lists Move, Attack, Item, Wait in order', () => {
    expect(UNIT_ACTIONS.map((a) => a.label)).toEqual(['Move', 'Attack', 'Item', 'Wait']);
  });
});

describe('createActionMenu', () => {
  it('defaults to the unit actions with the first one selected', () => {
    const menu = createActionMenu();
    expect(menu.actions).toBe(UNIT_ACTIONS);
    expect(menu.selectedIndex).toBe(0);
  });

  it('accepts a custom action list', () => {
    const actions = [{ id: 'wait', label: 'Wait' }];
    expect(createActionMenu(actions).actions).toBe(actions);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(createActionMenu())).toBe(true);
  });
});

describe('moveSelection', () => {
  it('moves the selection down and up', () => {
    const menu = createActionMenu();
    expect(moveSelection(menu, 1).selectedIndex).toBe(1);
    expect(moveSelection(moveSelection(menu, 2), -1).selectedIndex).toBe(1);
  });

  it('wraps from the last item to the first', () => {
    const last = moveSelection(createActionMenu(), 3);
    expect(last.selectedIndex).toBe(3);
    expect(moveSelection(last, 1).selectedIndex).toBe(0);
  });

  it('wraps from the first item to the last', () => {
    expect(moveSelection(createActionMenu(), -1).selectedIndex).toBe(3);
  });

  it('handles deltas larger than the list', () => {
    expect(moveSelection(createActionMenu(), 9).selectedIndex).toBe(1);
    expect(moveSelection(createActionMenu(), -9).selectedIndex).toBe(3);
  });

  it('does not mutate the input menu', () => {
    const menu = createActionMenu();
    moveSelection(menu, 1);
    expect(menu.selectedIndex).toBe(0);
  });

  it('returns the same menu when the selection does not change', () => {
    const menu = createActionMenu();
    expect(moveSelection(menu, 0)).toBe(menu);
    expect(moveSelection(menu, 4)).toBe(menu);
  });

  it('returns the same menu when there are no actions', () => {
    const menu = createActionMenu([]);
    expect(moveSelection(menu, 1)).toBe(menu);
  });
});

describe('selectIndex', () => {
  it('jumps to the given index', () => {
    expect(selectIndex(createActionMenu(), 2).selectedIndex).toBe(2);
  });

  it('does not mutate the input menu and returns a frozen menu', () => {
    const menu = createActionMenu();
    const next = selectIndex(menu, 3);
    expect(menu.selectedIndex).toBe(0);
    expect(Object.isFrozen(next)).toBe(true);
  });

  it('returns the same menu when the index is already selected', () => {
    const menu = createActionMenu();
    expect(selectIndex(menu, 0)).toBe(menu);
  });

  it('ignores out-of-range and non-integer indices', () => {
    const menu = createActionMenu();
    expect(selectIndex(menu, -1)).toBe(menu);
    expect(selectIndex(menu, 4)).toBe(menu);
    expect(selectIndex(menu, 1.5)).toBe(menu);
  });

  it('returns the same menu when there are no actions', () => {
    const empty = createActionMenu([]);
    expect(selectIndex(empty, 0)).toBe(empty);
  });
});

describe('getSelectedAction', () => {
  it('returns the highlighted action', () => {
    const menu = moveSelection(createActionMenu(), 1);
    expect(getSelectedAction(menu)).toEqual({ id: 'attack', label: 'Attack' });
  });

  it('returns null for an empty menu', () => {
    expect(getSelectedAction(createActionMenu([]))).toBeNull();
  });
});
