import { describe, expect, it } from 'vitest';
import { Soldier } from '../Soldier.ts';
import type { Unit } from '../Unit.ts';
import { Villager } from '../Villager.ts';
import { createRun, type ItemSnapshot, type RunState } from './run.ts';
import {
  cancelRoster,
  confirmRoster,
  getItemActions,
  getPickedUnit,
  moveRosterCursor,
  openRosterScreen,
  pointRosterCursor,
  type RosterScreenState,
} from './rosterScreen.ts';

// Alden the soldier carries [Iron Spear, Health Potion, Mana Potion]; Cato
// the villager [Fists, Health Potion, Mana Potion].
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
    expect(state).toMatchObject({ column: 'units', unitIndex: 0, itemIndex: 0, convoyIndex: 0, actions: null });
    expect(getPickedUnit(state)!.id).toBe('alden');
  });

  it('wraps within a column', () => {
    const state = openRosterScreen(campRun());
    expect(moveRosterCursor(state, 0, 1).unitIndex).toBe(1);
    expect(moveRosterCursor(state, 0, -1).unitIndex).toBe(1);
    expect(moveRosterCursor(moveRosterCursor(state, 0, 1), 0, 1).unitIndex).toBe(0);
  });

  it('steps between columns, stopping at the ends', () => {
    const state = openRosterScreen(campRun());
    expect(moveRosterCursor(state, -1, 0)).toBe(state);
    const items = moveRosterCursor(state, 1, 0);
    expect(items.column).toBe('items');
    const convoy = moveRosterCursor(items, 1, 0);
    expect(convoy.column).toBe('convoy');
    expect(moveRosterCursor(convoy, 1, 0)).toBe(convoy);
  });

  it('stays put in an empty column', () => {
    const convoy = moveRosterCursor(moveRosterCursor(openRosterScreen(campRun()), 1, 0), 1, 0);
    expect(moveRosterCursor(convoy, 0, 1)).toBe(convoy);
  });

  it('keeps the item cursor in range of a newly picked unit', () => {
    const run = campRun();
    const short = { ...run, roster: [run.roster[0], { ...run.roster[1], items: [run.roster[1].items[0]] }] };
    const atLastItem = pointRosterCursor(openRosterScreen(short), 'items', 2);
    expect(atLastItem.itemIndex).toBe(2);
    const moved = moveRosterCursor({ ...atLastItem, column: 'units' }, 0, 1);
    expect(moved.unitIndex).toBe(1);
    expect(moved.itemIndex).toBe(0);
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
    expect(pointRosterCursor(open, 'actions', 1).actions!.selectedIndex).toBe(1);
  });
});

describe('item actions', () => {
  it('offers Equip and Store for a weapon, Store for anything else', () => {
    const state = pointRosterCursor(openRosterScreen(campRun()), 'items', 0);
    expect(getItemActions(state).map((a) => [a.id, a.disabled])).toEqual([
      ['equip', true], // already equipped
      ['store', false],
    ]);
    expect(getItemActions(pointRosterCursor(state, 'items', 1)).map((a) => a.id)).toEqual(['store']);
  });

  it('offers Equip for armor', () => {
    const run = campRun([{ itemId: 'wooden-shield', quantity: 1 }]);
    const given = confirmRoster(pointRosterCursor(openRosterScreen(run), 'convoy', 0));
    const state = pointRosterCursor(given, 'items', 3);
    // Already worn: it's the only shield it carries.
    expect(getItemActions(state).map((a) => [a.id, a.disabled])).toEqual([
      ['equip', true],
      ['store', false],
    ]);
  });

  it('cannot store a natural weapon', () => {
    const state = pointRosterCursor(moveRosterCursor(openRosterScreen(campRun()), 0, 1), 'items', 0);
    expect(getItemActions(state)).toEqual([
      { id: 'equip', label: 'Equip', disabled: true },
      { id: 'store', label: 'Store', disabled: true },
    ]);
  });

  it('offers nothing for an empty inventory', () => {
    const run = campRun();
    const bare = { ...run, roster: [{ ...run.roster[0], items: [] }] };
    const state = moveRosterCursor(openRosterScreen(bare), 1, 0);
    expect(getItemActions(state)).toEqual([]);
    expect(confirmRoster(state)).toBe(state);
  });
});

describe('confirming', () => {
  it('moves from a unit into its items', () => {
    expect(confirmRoster(openRosterScreen(campRun())).column).toBe('items');
  });

  it('stores an item through its actions', () => {
    const items = pointRosterCursor(openRosterScreen(campRun()), 'items', 2);
    const open = confirmRoster(items);
    expect(open.actions!.actions.map((a) => a.id)).toEqual(['store']);
    const stored = confirmRoster(open);
    expect(stored.actions).toBeNull();
    expect(ids(stored)).toEqual(['iron-spear', 'health-potion']);
    expect(stored.run.convoy).toEqual([{ itemId: 'mana-potion', quantity: 1 }]);
    // The cursor falls back onto the last item left.
    expect(stored.itemIndex).toBe(1);
  });

  it('equips a weapon and follows it to the front', () => {
    const run = campRun([{ itemId: 'iron-bow', quantity: 40 }]);
    const given = confirmRoster(pointRosterCursor(openRosterScreen(run), 'convoy', 0));
    expect(ids(given)).toEqual(['iron-spear', 'health-potion', 'mana-potion', 'iron-bow']);
    const open = confirmRoster(pointRosterCursor(given, 'items', 3));
    expect(open.actions!.actions[0]).toMatchObject({ id: 'equip', disabled: false });
    const equipped = confirmRoster(open);
    expect(ids(equipped)).toEqual(['iron-bow', 'iron-spear', 'health-potion', 'mana-potion']);
    expect(equipped.itemIndex).toBe(0);
  });

  it('ignores a disabled action', () => {
    const open = confirmRoster(pointRosterCursor(openRosterScreen(campRun()), 'items', 0));
    expect(open.actions!.selectedIndex).toBe(0);
    expect(confirmRoster(open)).toBe(open);
  });

  it('gives a convoy item to the picked unit, keeping the cursor in range', () => {
    const run = campRun([{ itemId: 'iron-axe', quantity: 40 }]);
    const state = pointRosterCursor(moveRosterCursor(openRosterScreen(run), 0, 1), 'convoy', 0);
    const after = confirmRoster(state);
    expect(getPickedUnit(after)!.id).toBe('cato');
    expect(ids(after).at(-1)).toBe('iron-axe');
    expect(after.run.convoy).toEqual([]);
    expect(after.convoyIndex).toBe(0);
  });

  it('does nothing when the unit has no room', () => {
    const run = campRun([{ itemId: 'iron-axe', quantity: 40 }]);
    const full = Array.from({ length: 6 }, () => ({ itemId: 'iron-bow', quantity: 40 }));
    const packed = { ...run, roster: [{ ...run.roster[0], items: full }] };
    const state = pointRosterCursor(openRosterScreen(packed), 'convoy', 0);
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
