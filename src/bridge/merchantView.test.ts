import { describe, expect, it } from 'vitest';
import { WOODEN_ARMOR } from '../game/items.ts';
import { Soldier } from '../game/Soldier.ts';
import type { Unit } from '../game/Unit.ts';
import { FISTS, WOODEN_SWORD } from '../game/weapons.ts';
import { openMerchantScreen, pointMerchantCursor } from '../game/warband/merchantScreen.ts';
import { createRun, type ItemSnapshot, type RunState } from '../game/warband/run.ts';
import { toMerchantScreenView } from './merchantView.ts';

function campRun(gold: number, convoy: ItemSnapshot[] = []): RunState {
  const run = createRun(7, new Map<string, Unit>([['alden', new Soldier({ name: 'Alden', team: 'player' })]]));
  return { ...run, gold, convoy };
}

describe('toMerchantScreenView', () => {
  it('lists the stock with prices, disabling what the warband can’t afford', () => {
    const view = toMerchantScreenView(openMerchantScreen(campRun(20)));
    expect(view.gold).toBe(20);
    expect(view.stock.map((item) => [item.label, item.price, item.disabled])).toEqual([
      ['Wooden Sword', 20, false],
      ['Wooden Spear', 20, false],
      ['Wooden Axe', 25, true],
      ['Wooden Shield', 15, false],
      ['Wooden Armor', 25, true],
    ]);
    expect(view.stock[0].quantity).toBe(20);
    expect(view.stock[4].quantity).toBeNull();
  });

  it('lists the convoy with what each sells for', () => {
    const view = toMerchantScreenView(
      openMerchantScreen(
        campRun(0, [
          { itemId: WOODEN_SWORD.id, quantity: 10 },
          { itemId: WOODEN_ARMOR.id, quantity: 1 },
          { itemId: FISTS.id, quantity: 1 },
        ]),
      ),
    );
    expect(view.convoy.map((item) => [item.label, item.quantity, item.price, item.disabled])).toEqual([
      ['Wooden Sword', 10, 5, false],
      ['Wooden Armor', null, 12, false],
      ['Fists', null, 0, true],
    ]);
  });

  it('describes the highlighted item, and nothing over an empty convoy', () => {
    const state = openMerchantScreen(campRun(0));
    expect(toMerchantScreenView(state).detail?.label).toBe('Wooden Sword');
    expect(toMerchantScreenView(pointMerchantCursor(state, 'convoy', 0)).detail?.label).toBe('Wooden Sword');
    expect(toMerchantScreenView({ ...state, column: 'convoy' }).detail).toBeNull();
  });
});
