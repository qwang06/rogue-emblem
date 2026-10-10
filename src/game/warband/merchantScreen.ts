// The merchant screen at camp (see merchant.ts): two columns side by side,
// the merchant's stock and the warband's convoy, and the cursor is in one
// of them. Left and right move between the columns, up and down within
// one (wrapping), confirm buys the highlighted stock item or sells the
// highlighted convoy item, and cancel closes the screen. Buying something
// the warband can't afford, or selling something that can't be sold, does
// nothing. Everything here is pure: each function returns a new frozen
// state and leaves its input alone.

import type { Item } from '../items.ts';
import { buyItem, canBuy, canSell, MERCHANT_STOCK, sellItem } from './merchant.ts';
import { RUN_ITEMS, type RunState } from './run.ts';

export type MerchantColumn = 'stock' | 'convoy';

export interface MerchantScreenState {
  run: RunState;
  // What the merchant sells, by item id.
  stock: readonly string[];
  column: MerchantColumn;
  // The highlighted entry of each column; each stays in range of its list
  // (0 when the list is empty).
  stockIndex: number;
  convoyIndex: number;
}

const COLUMNS: readonly MerchantColumn[] = Object.freeze(['stock', 'convoy']);

// The screen opened on `run`, on the first stock item.
export function openMerchantScreen(run: RunState, stock: readonly string[] = MERCHANT_STOCK): MerchantScreenState {
  return freeze({ run, stock, column: 'stock', stockIndex: 0, convoyIndex: 0 });
}

// Moves the cursor: `dx` between the columns (stopping at either end), `dy`
// within the column (wrapping).
export function moveMerchantCursor(state: MerchantScreenState, dx: number, dy: number): MerchantScreenState {
  if (dx !== 0) {
    const at = COLUMNS.indexOf(state.column);
    const column = COLUMNS[Math.max(0, Math.min(COLUMNS.length - 1, at + Math.sign(dx)))];
    return column === state.column ? state : freeze({ ...state, column });
  }
  const count = columnLength(state, state.column);
  if (dy === 0 || count === 0) return state;
  const field = INDEX_FIELDS[state.column];
  return freeze({ ...state, [field]: (((state[field] + dy) % count) + count) % count });
}

// Points the cursor at entry `index` of `column` (e.g. on mouse hover).
// Out-of-range indices change nothing.
export function pointMerchantCursor(
  state: MerchantScreenState,
  column: MerchantColumn,
  index: number,
): MerchantScreenState {
  if (!Number.isInteger(index) || index < 0 || index >= columnLength(state, column)) return state;
  if (column === state.column && state[INDEX_FIELDS[column]] === index) return state;
  return freeze({ ...state, column, [INDEX_FIELDS[column]]: index });
}

// Confirm: buys the highlighted stock item or sells the highlighted convoy
// item, when it can.
export function confirmMerchant(state: MerchantScreenState, items: readonly Item[] = RUN_ITEMS): MerchantScreenState {
  if (state.column === 'stock') {
    const itemId = state.stock[state.stockIndex];
    if (itemId === undefined || !canBuy(state.run, itemId, state.stock, items)) return state;
    return clampIndices(freeze({ ...state, run: buyItem(state.run, itemId, state.stock, items) }));
  }
  if (!canSell(state.run, state.convoyIndex, items)) return state;
  return clampIndices(freeze({ ...state, run: sellItem(state.run, state.convoyIndex, items) }));
}

const INDEX_FIELDS = Object.freeze({ stock: 'stockIndex', convoy: 'convoyIndex' } as const);

function columnLength(state: MerchantScreenState, column: MerchantColumn): number {
  return column === 'stock' ? state.stock.length : state.run.convoy.length;
}

// The convoy index pulled back into range after a sale shrinks it.
function clampIndices(state: MerchantScreenState): MerchantScreenState {
  const count = columnLength(state, 'convoy');
  const convoyIndex = Math.max(0, Math.min(state.convoyIndex, count - 1));
  return convoyIndex === state.convoyIndex ? state : freeze({ ...state, convoyIndex });
}

function freeze(state: MerchantScreenState): MerchantScreenState {
  return Object.freeze(state);
}
