import { describe, expect, it } from 'vitest';
import { HEAL_STAFF } from '../game/healing.ts';
import { HEALTH_POTION, MAX_INVENTORY_SLOTS, WOODEN_ARMOR, WOODEN_SHIELD } from '../game/items.ts';
import { Soldier } from '../game/Soldier.ts';
import type { Unit } from '../game/Unit.ts';
import { Villager } from '../game/Villager.ts';
import { FISTS, formatWeaponRange, IRON_AXE } from '../game/weapons.ts';
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
    const view = toRosterScreenView(openRosterScreen(campRun([{ itemId: 'iron-axe', quantity: 1 }])));
    expect(view.units.map((u) => [u.name, u.classLabel, u.level])).toEqual([
      ['Alden', 'Soldier', 1],
      ['Cato', 'Villager', 1],
    ]);
    expect(view.unitName).toBe('Alden');
    // The bag: worn gear is on the Equipment screen.
    expect(view.items.map((i) => [i.label, i.quantity, i.equipped])).toEqual([
      ['Health Potion', 1, false],
      ['Mana Potion', 1, false],
    ]);
    expect(view.slots).toBe(MAX_INVENTORY_SLOTS);
    expect(view.convoy).toEqual([
      {
        key: 'iron-axe@0',
        label: 'Iron Axe',
        icon: 'iron-axe',
        kind: 'weapon',
        quantity: null,
        equipped: false,
        disabled: false,
      },
    ]);
    expect(view.detail).toBeNull();
    expect(Object.isFrozen(view)).toBe(true);
  });

  it('carries the picked unit’s full status sheet', () => {
    const run = campRun();
    const shown = toRosterScreenView(pointRosterCursor(openRosterScreen(run), 'units', 1)).unit!;
    const cato = run.roster[1];
    expect(shown.name).toBe('Cato');
    expect(shown.classLabel).toBe('Villager');
    expect(shown.stats.map((stat) => stat.label)).toEqual(['STR', 'INT', 'SKL', 'SPD', 'LCK', 'DEF', 'RES']);
    expect(shown.stats.find((stat) => stat.label === 'STR')!.value).toBe(cato.strength);
    expect(shown.health).toBe(cato.health);
    expect(toRosterScreenView(openRosterScreen(run)).unit!.equippedWeapon?.label).toBe('Iron Spear');
    expect(Array.isArray(shown.skills)).toBe(true);
  });

  it('has no status sheet with nobody on the roster', () => {
    const run = { ...campRun(), roster: [] };
    expect(toRosterScreenView(openRosterScreen(run)).unit).toBeNull();
  });

  it('disables convoy items the picked unit has no use for', () => {
    const run = campRun([
      { itemId: 'master-seal', quantity: 1 },
      { itemId: 'iron-axe', quantity: 1 },
    ]);
    const convoy = toRosterScreenView(openRosterScreen(run)).convoy;
    expect(convoy.map((item) => item.disabled)).toEqual([true, false]);
  });

  it('describes the highlighted item and carries the open actions', () => {
    const state = confirmRoster(pointRosterCursor(openRosterScreen(campRun()), 'items', 0));
    const view = toRosterScreenView(state);
    expect(view.detail).toEqual({ label: 'Health Potion', description: 'Restores up to 5 HP.' });
    expect(view.actions!.actions.map((a) => a.id)).toEqual(['store']);
  });

  it('has nobody to show with an empty roster', () => {
    const view = toRosterScreenView(openRosterScreen({ ...campRun(), roster: [] }));
    expect(view).toMatchObject({ units: [], unitName: null, items: [] });
  });
});

describe('icons', () => {
  it('shows convoy gear with its icon and no count', () => {
    const run = campRun([
      { itemId: 'wooden-shield', quantity: 1 },
      { itemId: 'wooden-sword', quantity: 1 },
    ]);
    const view = toRosterScreenView(openRosterScreen(run));
    expect(view.convoy[0]).toMatchObject({ icon: 'wooden-shield', quantity: null });
    expect(view.convoy[1]).toMatchObject({ icon: 'wooden-sword', quantity: null });
  });
});

describe('describeItem', () => {
  it('describes weapons, staves and consumables', () => {
    expect(describeItem(IRON_AXE)).toEqual({
      label: IRON_AXE.label,
      description: 'Physical weapon · 1H',
      numbers: { power: 3, hit: 65, crit: 0, weight: 5, range: '1' },
    });
    expect(describeItem(FISTS).numbers?.range).toBe('1');
    expect(describeItem(HEAL_STAFF)).toMatchObject({
      description: 'Staff · 2H · Heals 2 + INT',
      numbers: { range: formatWeaponRange(HEAL_STAFF) },
    });
    expect(describeItem(WOODEN_SHIELD).numbers).toBeUndefined();
    expect(describeItem(WOODEN_SHIELD).description).toBe(
      'Shield · DEF +1 against physical hits · Wt 1 · With a 1H weapon only',
    );
    expect(describeItem(WOODEN_ARMOR).description).toMatch(/^Body armor · DEF \+1/);
    expect(describeItem(HEALTH_POTION)).toEqual({ label: 'Health Potion', description: 'Restores up to 5 HP.' });
  });
});
