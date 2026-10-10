// Snapshot of the camp's merchant screen (src/game/warband/merchantScreen.ts)
// for React: the warband's gold, the stock with its prices, the convoy with
// what each entry sells for, the cursor and what the highlighted item does.
// Plain frozen data, built fresh from the screen's state.

import { getItemSprite } from '../game/tileset.ts';
import type { Item } from '../game/items.ts';
import { lookUpItem } from '../game/warband/convoy.ts';
import { canBuy, canSell, getItemPrice, getPurchaseQuantity, getSellPrice } from '../game/warband/merchant.ts';
import type { MerchantColumn, MerchantScreenState } from '../game/warband/merchantScreen.ts';
import { RUN_ITEMS } from '../game/warband/run.ts';
import { describeItem } from './rosterView.ts';

// A stock or convoy entry. `quantity` is how many (a weapon's or staff's
// uses), or null for a weapon that never breaks or armor; `price` is what
// it costs (stock) or sells for (convoy); `disabled` marks stock the
// warband can't afford and convoy items that can't be sold.
export interface MerchantItemView {
  key: string;
  label: string;
  icon: string | null;
  kind: string;
  quantity: number | null;
  price: number;
  disabled: boolean;
}

export interface MerchantScreenView {
  gold: number;
  column: MerchantColumn;
  stockIndex: number;
  convoyIndex: number;
  stock: readonly MerchantItemView[];
  convoy: readonly MerchantItemView[];
  // The highlighted item: its name and what it does. Null over an empty
  // convoy.
  detail: { label: string; description: string } | null;
}

export function toMerchantScreenView(
  state: MerchantScreenState,
  items: readonly Item[] = RUN_ITEMS,
): MerchantScreenView {
  const { run } = state;
  const toItem = (item: Item, key: string, quantity: number, price: number, disabled: boolean) => {
    const uncounted = (item.kind === 'weapon' && item.uses === null) || item.kind === 'armor';
    return Object.freeze<MerchantItemView>({
      key,
      label: item.label,
      icon: getItemSprite(item.id),
      kind: item.kind,
      quantity: uncounted ? null : quantity,
      price,
      disabled,
    });
  };
  const stock = state.stock.map((itemId) => {
    const item = lookUpItem(itemId, items);
    return toItem(
      item,
      itemId,
      getPurchaseQuantity(item),
      getItemPrice(item),
      !canBuy(run, itemId, state.stock, items),
    );
  });
  const convoy = run.convoy.map((entry, index) =>
    toItem(
      lookUpItem(entry.itemId, items),
      `${entry.itemId}@${index}`,
      entry.quantity,
      getSellPrice(entry, items),
      !canSell(run, index, items),
    ),
  );
  const highlighted = state.column === 'stock' ? state.stock[state.stockIndex] : run.convoy[state.convoyIndex]?.itemId;

  return Object.freeze({
    gold: run.gold,
    column: state.column,
    stockIndex: state.stockIndex,
    convoyIndex: state.convoyIndex,
    stock: Object.freeze(stock),
    convoy: Object.freeze(convoy),
    detail: highlighted ? describeItem(lookUpItem(highlighted, items)) : null,
  });
}
