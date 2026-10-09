import { describe, expect, it } from 'vitest';
import {
  HEAL_ACTION,
  UNIT_ACTIONS,
  createActionMenu,
  getSelectedAction,
  getUnitActions,
  moveSelection,
  selectIndex,
} from './actionMenu.ts';

describe('UNIT_ACTIONS', () => {
  it('lists Attack, Skill, Item, Wait in order', () => {
    expect(UNIT_ACTIONS.map((a) => a.label)).toEqual(['Attack', 'Skill', 'Item', 'Wait']);
  });
});

describe('getUnitActions', () => {
  it('disables Skill when the unit has no skills', () => {
    const actions = getUnitActions({ hasSkills: false });
    expect(actions.find((a) => a.id === 'skill')!.disabled).toBe(true);
    expect(actions.filter((a) => a.disabled).map((a) => a.id)).toEqual(['skill']);
  });

  it('enables Skill when the unit has skills', () => {
    const actions = getUnitActions({ hasSkills: true });
    expect(actions.some((a) => a.disabled)).toBe(false);
  });

  it('disables Attack when the unit has no weapon it can wield', () => {
    const actions = getUnitActions({ hasSkills: true, hasWeapons: false });
    expect(actions.filter((a) => a.disabled).map((a) => a.id)).toEqual(['attack']);
  });

  it('can disable Skill and Item together', () => {
    const actions = getUnitActions({ hasSkills: false, hasItems: false });
    expect(actions.filter((a) => a.disabled).map((a) => a.id)).toEqual(['skill', 'item']);
  });

  it('disables Item when the unit carries no items', () => {
    const actions = getUnitActions({ hasSkills: true, hasItems: false });
    expect(actions.filter((a) => a.disabled).map((a) => a.id)).toEqual(['item']);
  });

  it('keeps the unit action order', () => {
    expect(getUnitActions({ hasSkills: false }).map((a) => a.id)).toEqual(UNIT_ACTIONS.map((a) => a.id));
  });

  it('offers no Heal to a unit without a staff', () => {
    expect(getUnitActions({ hasSkills: true }).some((a) => a.id === 'heal')).toBe(false);
  });

  it('offers Heal right after Attack to a unit with a staff', () => {
    const actions = getUnitActions({ hasSkills: true, hasWeapons: false, canHeal: true });
    expect(actions.map((a) => a.id)).toEqual(['attack', 'heal', 'skill', 'item', 'wait']);
    expect(actions.filter((a) => a.disabled).map((a) => a.id)).toEqual(['attack']);
  });

  it('disables Heal when no wounded ally is in reach', () => {
    const actions = getUnitActions({ hasSkills: true, canHeal: false });
    expect(actions.filter((a) => a.disabled).map((a) => a.id)).toEqual(['heal']);
  });

  it('returns frozen entries without touching UNIT_ACTIONS', () => {
    const actions = getUnitActions({ hasSkills: false });
    expect(Object.isFrozen(actions)).toBe(true);
    expect(actions.every(Object.isFrozen)).toBe(true);
    expect(UNIT_ACTIONS.find((a) => a.id === 'skill')!.disabled).toBeUndefined();
    getUnitActions({ hasSkills: true, canHeal: false });
    expect(HEAL_ACTION.disabled).toBeUndefined();
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
  const count = UNIT_ACTIONS.length;
  const lastIndex = count - 1;

  it('moves the selection down and up', () => {
    const menu = createActionMenu();
    expect(moveSelection(menu, 1).selectedIndex).toBe(1);
    expect(moveSelection(moveSelection(menu, 2), -1).selectedIndex).toBe(1);
  });

  it('wraps from the last item to the first', () => {
    const last = moveSelection(createActionMenu(), lastIndex);
    expect(last.selectedIndex).toBe(lastIndex);
    expect(moveSelection(last, 1).selectedIndex).toBe(0);
  });

  it('wraps from the first item to the last', () => {
    expect(moveSelection(createActionMenu(), -1).selectedIndex).toBe(lastIndex);
  });

  it('handles deltas larger than the list', () => {
    expect(moveSelection(createActionMenu(), 2 * count + 1).selectedIndex).toBe(1);
    expect(moveSelection(createActionMenu(), -(2 * count + 1)).selectedIndex).toBe(lastIndex);
  });

  it('does not mutate the input menu', () => {
    const menu = createActionMenu();
    moveSelection(menu, 1);
    expect(menu.selectedIndex).toBe(0);
  });

  it('returns the same menu when the selection does not change', () => {
    const menu = createActionMenu();
    expect(moveSelection(menu, 0)).toBe(menu);
    expect(moveSelection(menu, count)).toBe(menu);
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
    expect(selectIndex(menu, UNIT_ACTIONS.length)).toBe(menu);
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
    expect(getSelectedAction(menu)).toEqual({ id: 'skill', label: 'Skill' });
  });

  it('returns null for an empty menu', () => {
    expect(getSelectedAction(createActionMenu([]))).toBeNull();
  });
});
