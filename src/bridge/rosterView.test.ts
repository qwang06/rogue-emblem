import { describe, expect, it } from 'vitest';
import { HEAL_STAFF } from '../game/healing.ts';
import { HEALTH_POTION } from '../game/items.ts';
import { Soldier } from '../game/Soldier.ts';
import type { Unit } from '../game/Unit.ts';
import { Villager } from '../game/Villager.ts';
import { FISTS, IRON_AXE } from '../game/weapons.ts';
import { createRun, type ItemSnapshot, type RunState } from '../game/warband/run.ts';
import { confirmRoster, openRosterScreen, pointRosterCursor } from '../game/warband/rosterScreen.ts';
import { describeItem, toRosterScreenView } from './rosterView.ts';

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

describe('toRosterScreenView', () => {
  it('lists the units, the picked unit’s items and the convoy', () => {
    const view = toRosterScreenView(openRosterScreen(campRun([{ itemId: 'iron-axe', quantity: 12 }])));
    expect(view.units.map((u) => [u.name, u.classLabel, u.level])).toEqual([
      ['Alden', 'Soldier', 1],
      ['Cato', 'Villager', 1],
    ]);
    expect(view.unitName).toBe('Alden');
    expect(view.items.map((i) => [i.label, i.quantity, i.equipped])).toEqual([
      ['Iron Spear', 40, true],
      ['Health Potion', 1, false],
      ['Mana Potion', 1, false],
    ]);
    expect(view.slots).toBe(6);
    expect(view.convoy).toEqual([
      { key: 'iron-axe@0', label: 'Iron Axe', kind: 'weapon', quantity: 12, equipped: false, disabled: false },
    ]);
    expect(view.detail).toBeNull();
    expect(Object.isFrozen(view)).toBe(true);
  });

  it('shows a weapon that never breaks without a count', () => {
    const state = pointRosterCursor(openRosterScreen(campRun()), 'units', 1);
    expect(toRosterScreenView(state).items[0]).toMatchObject({ label: 'Fists', quantity: null, equipped: true });
  });

  it('disables convoy items the picked unit has no room for', () => {
    const run = campRun([{ itemId: 'iron-axe', quantity: 40 }]);
    const full = Array.from({ length: 6 }, () => ({ itemId: 'iron-bow', quantity: 40 }));
    const packed = { ...run, roster: [{ ...run.roster[0], items: full }] };
    expect(toRosterScreenView(openRosterScreen(packed)).convoy[0].disabled).toBe(true);
  });

  it('describes the highlighted item and carries the open actions', () => {
    const state = confirmRoster(pointRosterCursor(openRosterScreen(campRun()), 'items', 1));
    const view = toRosterScreenView(state);
    expect(view.detail).toEqual({ label: 'Health Potion', description: 'Restores up to 5 HP.' });
    expect(view.actions!.actions.map((a) => a.id)).toEqual(['store']);
  });

  it('has nobody to show with an empty roster', () => {
    const view = toRosterScreenView(openRosterScreen({ ...campRun(), roster: [] }));
    expect(view).toMatchObject({ units: [], unitName: null, items: [] });
  });
});

describe('describeItem', () => {
  it('describes weapons, staves and consumables', () => {
    expect(describeItem(IRON_AXE).description).toBe('Physical weapon · Mt 3 · Hit 65 · Crt 0 · Wt 5 · Rng 1 · 40 uses');
    expect(describeItem(FISTS).description).toMatch(/never breaks$/);
    expect(describeItem(HEAL_STAFF).description).toMatch(/^Staff · Heals 2 \+ MAG/);
    expect(describeItem(HEALTH_POTION)).toEqual({ label: 'Health Potion', description: 'Restores up to 5 HP.' });
  });
});
