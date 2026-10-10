import { describe, expect, it } from 'vitest';
import { Soldier } from '../Soldier.ts';
import type { Unit } from '../Unit.ts';
import { FISTS, IRON_SPEAR, WOODEN_SWORD } from '../weapons.ts';
import { MERCHANT_STOCK } from './merchant.ts';
import { confirmMerchant, moveMerchantCursor, openMerchantScreen, pointMerchantCursor } from './merchantScreen.ts';
import { createRun, type ItemSnapshot, type RunState } from './run.ts';

function campRun(gold: number, convoy: ItemSnapshot[] = []): RunState {
  const run = createRun(7, new Map<string, Unit>([['alden', new Soldier({ name: 'Alden', team: 'player' })]]));
  return { ...run, gold, convoy };
}

describe('openMerchantScreen', () => {
  it('starts on the first stock item', () => {
    const state = openMerchantScreen(campRun(0));
    expect(state).toMatchObject({ column: 'stock', stockIndex: 0, convoyIndex: 0, stock: MERCHANT_STOCK });
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
  it('buys the highlighted stock item into the convoy', () => {
    const after = confirmMerchant(openMerchantScreen(campRun(25)));
    expect(after.run.gold).toBe(5);
    expect(after.run.convoy).toEqual([{ itemId: WOODEN_SWORD.id, quantity: 20 }]);
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
