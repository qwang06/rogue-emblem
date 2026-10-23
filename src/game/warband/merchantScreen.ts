// The merchant screen at camp (see merchant.ts): two columns side by side,
// the merchant's stock and the warband's convoy, and the cursor is in one
// of them. Left and right move between the columns, up and down within
// one (wrapping). Confirm on a stock item asks who it's for — a unit,
// straight into its inventory, or the convoy — opening on the unit it
// suits (isSuitedTo), and confirm there buys it; cancel backs out of that
// question. Confirm on a convoy item sells it, and cancel closes the
// screen. Buying something the warband can't afford, or selling something
// that can't be sold, does nothing. Everything here is pure: each function
// returns a new frozen state and leaves its input alone.

import { createActionMenu, moveSelection, selectIndex, type Menu, type MenuAction } from '../actionMenu.ts';
import type { Item } from '../items.ts';
import { UNIT_CLASSES, type UnitClass } from '../unitClasses.ts';
import { isWeapon } from '../weapons.ts';
import { canCarry, getEquippedUses, isSuitedTo, lookUpItem } from './convoy.ts';
import { buyItemFor, canBuy, canBuyFor, canSell, MERCHANT_STOCK, sellItem } from './merchant.ts';
import { RUN_ITEMS, type RunState } from './run.ts';

export type MerchantColumn = 'stock' | 'convoy';

// Where the pointer can point: a column, or the open "who is it for" menu.
export type MerchantTarget = MerchantColumn | 'recipients';

// The recipient id that means the convoy rather than a unit.
export const CONVOY_RECIPIENT = '@convoy';

// An entry of the "who is it for" menu: a unit by its id (disabled when it
// has no room), or the convoy (CONVOY_RECIPIENT). `suited` marks a unit
// the item suits (isSuitedTo).
export interface MerchantRecipient extends MenuAction {
  suited: boolean;
}

export interface MerchantScreenState {
  run: RunState;
  // What the merchant sells, by item id.
  stock: readonly string[];
  column: MerchantColumn;
  // The highlighted entry of each column; each stays in range of its list
  // (0 when the list is empty).
  stockIndex: number;
  convoyIndex: number;
  // Who the highlighted stock item is for, while that's being asked, else
  // null.
  recipients: Menu<MerchantRecipient> | null;
}

// The rules the screen checks against: the classes (for weapon types) and
// the items a run can name.
export interface MerchantRules {
  classes: readonly UnitClass[];
  items: readonly Item[];
}

const DEFAULT_RULES: MerchantRules = Object.freeze({ classes: UNIT_CLASSES, items: RUN_ITEMS });

const COLUMNS: readonly MerchantColumn[] = Object.freeze(['stock', 'convoy']);

// The screen opened on `run`, on the first stock item.
export function openMerchantScreen(run: RunState, stock: readonly string[] = MERCHANT_STOCK): MerchantScreenState {
  return freeze({ run, stock, column: 'stock', stockIndex: 0, convoyIndex: 0, recipients: null });
}

// Moves the cursor: `dx` between the columns (stopping at either end), `dy`
// within the column (wrapping).
export function moveMerchantCursor(state: MerchantScreenState, dx: number, dy: number): MerchantScreenState {
  if (state.recipients) {
    const recipients = moveSelection(state.recipients, dy);
    return recipients === state.recipients ? state : freeze({ ...state, recipients });
  }
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
  column: MerchantTarget,
  index: number,
): MerchantScreenState {
  if (column === 'recipients' || state.recipients) {
    if (column !== 'recipients' || !state.recipients) return state;
    const recipients = selectIndex(state.recipients, index);
    return recipients === state.recipients ? state : freeze({ ...state, recipients });
  }
  if (!Number.isInteger(index) || index < 0 || index >= columnLength(state, column)) return state;
  if (column === state.column && state[INDEX_FIELDS[column]] === index) return state;
  return freeze({ ...state, column, [INDEX_FIELDS[column]]: index });
}

// Confirm: asks who the highlighted stock item is for, buys it for the
// highlighted recipient while that's being asked, or sells the highlighted
// convoy item, when it can.
export function confirmMerchant(state: MerchantScreenState, rules: MerchantRules = DEFAULT_RULES): MerchantScreenState {
  const { items } = rules;
  if (state.recipients) {
    const itemId = state.stock[state.stockIndex];
    const recipient = state.recipients.actions[state.recipients.selectedIndex];
    const unitId = recipient.id === CONVOY_RECIPIENT ? null : recipient.id;
    if (recipient.disabled || !canBuyFor(state.run, itemId, unitId, state.stock, items)) return state;
    const run = buyItemFor(state.run, itemId, unitId, state.stock, items);
    return clampIndices(freeze({ ...state, run, recipients: null }));
  }
  if (state.column === 'stock') {
    const itemId = state.stock[state.stockIndex];
    if (itemId === undefined || !canBuy(state.run, itemId, state.stock, items)) return state;
    return freeze({ ...state, recipients: getRecipients(state.run, itemId, rules) });
  }
  if (!canSell(state.run, state.convoyIndex, items)) return state;
  return clampIndices(freeze({ ...state, run: sellItem(state.run, state.convoyIndex, items) }));
}

// Cancel: backs out of asking who an item is for, else closes the screen
// (null).
export function cancelMerchant(state: MerchantScreenState): MerchantScreenState | null {
  return state.recipients ? freeze({ ...state, recipients: null }) : null;
}

// The "who is it for" menu for `itemId`: every unit, in roster order (one
// without room disabled), then the convoy. It opens on a unit with room
// that the item suits (isSuitedTo) — for a weapon, the one whose own has
// the fewest uses left (getEquippedUses) — else on the convoy.
export function getRecipients(
  run: RunState,
  itemId: string,
  { classes, items }: MerchantRules = DEFAULT_RULES,
): Menu<MerchantRecipient> {
  const units = run.roster.map((unit) =>
    Object.freeze<MerchantRecipient>({
      id: unit.id,
      label: unit.name,
      disabled: !canCarry(run, unit.id, itemId, items),
      suited: isSuitedTo(run, unit.id, itemId, classes, items),
    }),
  );
  const convoy = Object.freeze<MerchantRecipient>({ id: CONVOY_RECIPIENT, label: 'Convoy', suited: false });
  const actions = Object.freeze([...units, convoy]);
  const isWeaponItem = isWeapon(lookUpItem(itemId, items));
  // Unbreakable counts as plenty; a weapon is wanted most where uses are fewest.
  const need = (unitId: string) => (isWeaponItem ? (getEquippedUses(run, unitId, classes, items) ?? Infinity) : 0);
  let best = units.length;
  units.forEach((unit, index) => {
    if (!unit.suited || unit.disabled) return;
    if (best === units.length || need(unit.id) < need(units[best].id)) best = index;
  });
  return selectIndex(createActionMenu(actions), best);
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
