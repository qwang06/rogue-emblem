import { describe, expect, it } from 'vitest';
import { Soldier } from '../Soldier.ts';
import type { Unit } from '../Unit.ts';
import { FISTS, IRON_BOW, IRON_SPEAR, WOODEN_SPEAR, WOODEN_SWORD } from '../weapons.ts';
import { MERCHANT_STOCK } from './merchant.ts';
import {
  cancelMerchant,
  confirmMerchant,
  CONVOY_RECIPIENT,
  moveMerchantCursor,
  openMerchantScreen,
  pointMerchantCursor,
} from './merchantScreen.ts';
import { createRun, type ItemSnapshot, type RunState } from './run.ts';

function campRun(gold: number, convoy: ItemSnapshot[] = []): RunState {
  const run = createRun(7, new Map<string, Unit>([['alden', new Soldier({ name: 'Alden', team: 'player' })]]));
  return { ...run, gold, convoy };
}

describe('openMerchantScreen', () => {
  it('starts on the first stock item', () => {
    const state = openMerchantScreen(campRun(0));
    expect(state).toMatchObject({
      column: 'stock',
      stockIndex: 0,
      convoyIndex: 0,
      stock: MERCHANT_STOCK,
      recipients: null,
    });
  });
});

describe('moveMerchantCursor', () => {
  const convoy = [
    { itemId: IRON_SPEAR.id, quantity: 5 },
    { itemId: WOODEN_SWORD.id, quantity: 3 },
  ];

  it('moves between the columns, stopping at either end', () => {
    const state = openMerchantScreen(campRun(0, convoy));
    expect(moveMerchantCursor(state, -1, 0)).toBe(state);
    const right = moveMerchantCursor(state, 1, 0);
    expect(right.column).toBe('convoy');
    expect(moveMerchantCursor(right, 1, 0)).toBe(right);
  });

  it('wraps within a column', () => {
    const state = openMerchantScreen(campRun(0, convoy));
    expect(moveMerchantCursor(state, 0, -1).stockIndex).toBe(MERCHANT_STOCK.length - 1);
    const convoyState = moveMerchantCursor(state, 1, 0);
    expect(moveMerchantCursor(convoyState, 0, 2).convoyIndex).toBe(0);
  });

  it('does nothing in an empty convoy', () => {
    const state = moveMerchantCursor(openMerchantScreen(campRun(0)), 1, 0);
    expect(moveMerchantCursor(state, 0, 1)).toBe(state);
  });
});

describe('pointMerchantCursor', () => {
  it('jumps to an entry and ignores out-of-range ones', () => {
    const state = openMerchantScreen(campRun(0, [{ itemId: IRON_SPEAR.id, quantity: 5 }]));
    expect(pointMerchantCursor(state, 'convoy', 0)).toMatchObject({ column: 'convoy', convoyIndex: 0 });
    expect(pointMerchantCursor(state, 'stock', 3).stockIndex).toBe(3);
    expect(pointMerchantCursor(state, 'convoy', 1)).toBe(state);
    expect(pointMerchantCursor(state, 'stock', -1)).toBe(state);
  });
});

describe('confirmMerchant', () => {
  it('asks who a stock item is for, opening on the convoy when it suits no unit', () => {
    const bow = pointMerchantCursor(openMerchantScreen(campRun(45)), 'stock', MERCHANT_STOCK.indexOf(IRON_BOW.id));
    const asking = confirmMerchant(bow);
    expect(asking.run.gold).toBe(45);
    expect(asking.recipients!.actions.map((action) => action.id)).toEqual(['alden', CONVOY_RECIPIENT]);
    expect(asking.recipients!.selectedIndex).toBe(1);
    const after = confirmMerchant(asking);
    expect(after.recipients).toBeNull();
    expect(after.run.gold).toBe(0);
    expect(after.run.convoy).toEqual([{ itemId: IRON_BOW.id, quantity: 40 }]);
  });

  it('opens on a unit the item suits, and buys it straight into its inventory', () => {
    const asking = confirmMerchant(openMerchantScreen(campRun(25)));
    expect(asking.recipients!.selectedIndex).toBe(0);
    const after = confirmMerchant(asking);
    expect(after.run.gold).toBe(5);
    expect(after.run.convoy).toEqual([]);
    expect(after.run.roster[0].items.at(-1)).toEqual({ itemId: WOODEN_SWORD.id, quantity: 20 });
  });

  it('opens a weapon on the suited unit whose own weapon has the fewest uses left', () => {
    const run = createRun(
      7,
      new Map<string, Unit>([
        ['alden', new Soldier({ name: 'Alden', team: 'player' })],
        ['bram', new Soldier({ name: 'Bram', team: 'player' })],
      ]),
    );
    const worn = {
      ...run,
      gold: 25,
      roster: run.roster.map((unit) =>
        unit.id === 'bram'
          ? { ...unit, items: unit.items.map((entry, i) => (i === 0 ? { ...entry, quantity: 2 } : entry)) }
          : unit,
      ),
    };
    const asking = confirmMerchant(openMerchantScreen(worn));
    expect(asking.recipients!.actions[asking.recipients!.selectedIndex].id).toBe('bram');
  });

  it('moves and points within the question, and cancel backs out of it before closing', () => {
    const asking = confirmMerchant(openMerchantScreen(campRun(25)));
    expect(moveMerchantCursor(asking, 0, 1).recipients!.selectedIndex).toBe(1);
    expect(moveMerchantCursor(asking, 1, 0)).toBe(asking);
    expect(pointMerchantCursor(asking, 'recipients', 1).recipients!.selectedIndex).toBe(1);
    expect(pointMerchantCursor(asking, 'convoy', 0)).toBe(asking);
    const backedOut = cancelMerchant(asking)!;
    expect(backedOut.recipients).toBeNull();
    expect(backedOut.run).toBe(asking.run);
    expect(cancelMerchant(backedOut)).toBeNull();
  });

  it("won't buy for a unit with no room", () => {
    const run = campRun(25);
    const full = {
      ...run,
      roster: run.roster.map((unit) => ({
        ...unit,
        items: Array.from({ length: 6 }, () => ({ itemId: IRON_SPEAR.id, quantity: 1 })),
      })),
    };
    const spear = pointMerchantCursor(openMerchantScreen(full), 'stock', MERCHANT_STOCK.indexOf(WOODEN_SPEAR.id));
    const asking = confirmMerchant(spear);
    expect(asking.recipients!.actions[0].disabled).toBe(true);
    expect(asking.recipients!.selectedIndex).toBe(1);
    const onUnit = pointMerchantCursor(asking, 'recipients', 0);
    expect(confirmMerchant(onUnit)).toBe(onUnit);
  });

  it("does nothing when the warband can't afford it", () => {
    const state = openMerchantScreen(campRun(19));
    expect(confirmMerchant(state)).toBe(state);
  });

  it('sells the highlighted convoy item and keeps the cursor in range', () => {
    const convoy = [
      { itemId: IRON_SPEAR.id, quantity: 5 },
      { itemId: WOODEN_SWORD.id, quantity: 20 },
    ];
    const state = pointMerchantCursor(openMerchantScreen(campRun(0, convoy)), 'convoy', 1);
    const after = confirmMerchant(state);
    expect(after.run.gold).toBe(10);
    expect(after.run.convoy).toEqual([{ itemId: IRON_SPEAR.id, quantity: 5 }]);
    expect(after.convoyIndex).toBe(0);
  });

  it("does nothing on an empty convoy or something that can't be sold", () => {
    const empty = moveMerchantCursor(openMerchantScreen(campRun(0)), 1, 0);
    expect(confirmMerchant(empty)).toBe(empty);
    const fists = pointMerchantCursor(openMerchantScreen(campRun(0, [{ itemId: FISTS.id, quantity: 1 }])), 'convoy', 0);
    expect(confirmMerchant(fists)).toBe(fists);
  });
});
