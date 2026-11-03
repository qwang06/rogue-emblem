import { describe, expect, it } from 'vitest';
import { Soldier } from '../Soldier.ts';
import type { Unit } from '../Unit.ts';
import { Villager } from '../Villager.ts';
import { createRun, type ItemSnapshot, type RunState } from './run.ts';
import {
  cancelRoster,
  confirmRoster,
  confirmsOnClick,
  getItemActions,
  getPickedUnit,
  moveRosterCursor,
  openRosterScreen,
  pointRosterCursor,
  type RosterScreenState,
} from './rosterScreen.ts';

// Alden the soldier wields an Iron Spear, Cato the villager a Wooden Sword;
// each carries [Health Potion, Mana Potion] in its bag.
function campRun(convoy: ItemSnapshot[] = []): RunState {
  const run = createRun(
    7,
    new Map<string, Unit>([
      ['alden', new Soldier({ name: 'Alden', team: 'player' })],
      ['cato', new Villager({ name: 'Cato', team: 'player' })],
    ]),
  );
  return { ...run, convoy };
}

function ids(state: RosterScreenState) {
  return getPickedUnit(state)!.items.map((entry) => entry.itemId);
}

describe('moving the cursor', () => {
  it('opens on the first unit', () => {
    const state = openRosterScreen(campRun());
    expect(state).toMatchObject({
      tab: 'stats',
      column: 'units',
      unitIndex: 0,
      itemIndex: 0,
      convoyIndex: 0,
      actions: null,
    });
    expect(getPickedUnit(state)!.id).toBe('alden');
  });

  it('wraps within a column', () => {
    const state = openRosterScreen(campRun());
    expect(moveRosterCursor(state, 0, 1).unitIndex).toBe(1);
    expect(moveRosterCursor(state, 0, -1).unitIndex).toBe(1);
    expect(moveRosterCursor(moveRosterCursor(state, 0, 1), 0, 1).unitIndex).toBe(0);
  });

  it('steps through the tabs, then the Items columns, stopping at the ends', () => {
    const state = openRosterScreen(campRun());
    expect(moveRosterCursor(state, -1, 0)).toBe(state);
    const skills = moveRosterCursor(state, 1, 0);
    expect(skills).toMatchObject({ tab: 'skills', column: 'units' });
    const itemsTab = moveRosterCursor(skills, 1, 0);
    expect(itemsTab).toMatchObject({ tab: 'items', column: 'units' });
    const items = moveRosterCursor(itemsTab, 1, 0);
    expect(items).toMatchObject({ tab: 'items', column: 'items' });
    const convoy = moveRosterCursor(items, 1, 0);
    expect(convoy.column).toBe('convoy');
    expect(moveRosterCursor(convoy, 1, 0)).toBe(convoy);
    expect(moveRosterCursor(itemsTab, -1, 0)).toMatchObject({ tab: 'skills', column: 'units' });
  });

  it('stays put in an empty column', () => {
    const atItems = confirmRoster(openRosterScreen(campRun()));
    const convoy = moveRosterCursor(atItems, 1, 0);
    expect(convoy.column).toBe('convoy');
    expect(moveRosterCursor(convoy, 0, 1)).toBe(convoy);
  });

  it('keeps the item cursor in range of a newly picked unit', () => {
    const run = campRun();
    const short = { ...run, roster: [run.roster[0], { ...run.roster[1], items: [run.roster[1].items[0]] }] };
    const atLastItem = pointRosterCursor(openRosterScreen(short), 'items', 1);
    expect(atLastItem.itemIndex).toBe(1);
    const moved = moveRosterCursor({ ...atLastItem, column: 'units' }, 0, 1);
    expect(moved.unitIndex).toBe(1);
    expect(moved.itemIndex).toBe(0);
  });
});

describe('tabs', () => {
  it('opens a tab, leaving the units picked', () => {
    const state = moveRosterCursor(openRosterScreen(campRun()), 0, 1);
    expect(pointRosterCursor(state, 'tabs', 1)).toMatchObject({ tab: 'skills', column: 'units', unitIndex: 1 });
    expect(pointRosterCursor(state, 'tabs', 0)).toBe(state);
    expect(pointRosterCursor(state, 'tabs', 3)).toBe(state);
  });

  it('puts the cursor back on the units, closing actions, when leaving Items', () => {
    const open = confirmRoster(pointRosterCursor(openRosterScreen(campRun()), 'items', 0));
    expect(open.actions).not.toBeNull();
    expect(pointRosterCursor(open, 'tabs', 0)).toMatchObject({ tab: 'stats', column: 'units', actions: null });
  });

  it('opens the Items tab when pointing at an item', () => {
    expect(pointRosterCursor(openRosterScreen(campRun()), 'items', 1)).toMatchObject({ tab: 'items', column: 'items' });
  });
});

describe('clicking', () => {
  it('only picks a unit or opens a tab, keeping the open tab', () => {
    expect(confirmsOnClick('units')).toBe(false);
    expect(confirmsOnClick('tabs')).toBe(false);
  });

  it('acts on an item, a convoy entry or an action', () => {
    expect(confirmsOnClick('items')).toBe(true);
    expect(confirmsOnClick('convoy')).toBe(true);
    expect(confirmsOnClick('actions')).toBe(true);
  });
});

describe('pointing', () => {
  it('moves the cursor to the pointed entry and column', () => {
    const state = pointRosterCursor(openRosterScreen(campRun([{ itemId: 'iron-axe', quantity: 40 }])), 'convoy', 0);
    expect(state).toMatchObject({ column: 'convoy', convoyIndex: 0 });
  });

  it('ignores out-of-range entries', () => {
    const state = openRosterScreen(campRun());
    expect(pointRosterCursor(state, 'convoy', 0)).toBe(state);
    expect(pointRosterCursor(state, 'units', 5)).toBe(state);
    expect(pointRosterCursor(state, 'actions', 0)).toBe(state);
  });

  it('highlights an open action', () => {
    const open = confirmRoster(pointRosterCursor(openRosterScreen(campRun()), 'items', 0));
    expect(pointRosterCursor(open, 'actions', 0).actions!.selectedIndex).toBe(0);
  });
});

describe('item actions', () => {
  it('offers Store for a bag item', () => {
    const state = pointRosterCursor(openRosterScreen(campRun()), 'items', 0);
    expect(getItemActions(state)).toEqual([{ id: 'store', label: 'Store', disabled: false }]);
  });

  it('offers nothing for an empty inventory', () => {
    const run = campRun();
    const bare = { ...run, roster: [{ ...run.roster[0], items: [] }] };
    const state = confirmRoster(openRosterScreen(bare));
    expect(state.column).toBe('items');
    expect(getItemActions(state)).toEqual([]);
    expect(confirmRoster(state)).toBe(state);
  });
});

describe('confirming', () => {
  it('moves from a unit into its items', () => {
    expect(confirmRoster(openRosterScreen(campRun()))).toMatchObject({ tab: 'items', column: 'items' });
  });

  it('stores an item through its actions', () => {
    const items = pointRosterCursor(openRosterScreen(campRun()), 'items', 1);
    const open = confirmRoster(items);
    expect(open.actions!.actions.map((a) => a.id)).toEqual(['store']);
    const stored = confirmRoster(open);
    expect(stored.actions).toBeNull();
    expect(ids(stored)).toEqual(['health-potion']);
    expect(stored.run.convoy).toEqual([{ itemId: 'mana-potion', quantity: 1 }]);
    // The cursor falls back onto the last item left.
    expect(stored.itemIndex).toBe(0);
  });

  it('gives a convoy consumable into the bag', () => {
    const run = campRun([{ itemId: 'health-potion', quantity: 2 }]);
    const after = confirmRoster(pointRosterCursor(openRosterScreen(run), 'convoy', 0));
    expect(getPickedUnit(after)!.items[0]).toEqual({ itemId: 'health-potion', quantity: 2 });
    expect(after.run.convoy).toEqual([{ itemId: 'health-potion', quantity: 1 }]);
  });

  it('equips convoy gear, sending what it displaces back, keeping the cursor in range', () => {
    const run = campRun([{ itemId: 'iron-axe', quantity: 1 }]);
    const state = pointRosterCursor(moveRosterCursor(openRosterScreen(run), 0, 1), 'convoy', 0);
    const after = confirmRoster(state);
    expect(getPickedUnit(after)!.id).toBe('cato');
    expect(getPickedUnit(after)!.equipment).toEqual({ main: 'iron-axe' });
    expect(after.run.convoy).toEqual([{ itemId: 'wooden-sword', quantity: 1 }]);
    expect(after.convoyIndex).toBe(0);
  });

  it('does nothing when the unit has no room', () => {
    const run = campRun([{ itemId: 'master-seal', quantity: 1 }]);
    const state = pointRosterCursor(openRosterScreen(run), 'convoy', 0);
    expect(confirmRoster(state)).toBe(state);
  });

  it('does nothing with an empty roster', () => {
    const state = openRosterScreen({ ...campRun(), roster: [] });
    expect(confirmRoster(state)).toBe(state);
  });
});

describe('cancelling', () => {
  it('closes the actions, then steps back to the units, then closes the screen', () => {
    const open = confirmRoster(confirmRoster(openRosterScreen(campRun())));
    expect(open.actions).not.toBeNull();
    const closed = cancelRoster(open)!;
    expect(closed).toMatchObject({ column: 'items', actions: null });
    const units = cancelRoster(closed)!;
    expect(units.column).toBe('units');
    expect(cancelRoster(units)).toBeNull();
  });
});
