// The roster screen between Warband Mode stages: pick a unit, then look
// over it or manage its items against the convoy (see convoy.ts). The
// units sit on the left; beside them one panel shows a tab of the picked
// unit: its stats, its skills, or its items (its inventory and the convoy,
// two more columns). The cursor is in one of the columns. Left and right
// walk one strip — Stats, Skills, Items on the units, then into the
// inventory and the convoy — stopping at either end; up and down move
// within a column (wrapping); confirm acts on what's under the cursor and
// cancel steps back:
//   - units: confirm opens the Items tab, in that unit's items; cancel
//     closes the screen
//   - items: confirm opens the item's actions (Equip for weapons and
//     armor, Store); cancel goes
//     back to the units
//   - convoy: confirm gives that item to the picked unit; cancel goes back
//     to the units
//   - actions: confirm takes the action; cancel closes them
// The camp menu shown after a stage's reward offers the screen (see
// camp.ts). Everything here is pure: each function returns a new
// frozen state and leaves its input alone.

import { createActionMenu, moveSelection, selectIndex, type Menu, type MenuAction } from '../actionMenu.ts';
import { UNIT_CLASSES, type UnitClass } from '../unitClasses.ts';
import { isArmor, type Item } from '../items.ts';
import { isWeapon } from '../weapons.ts';
import {
  canEquipInRoster,
  canGiveFromConvoy,
  canStoreInConvoy,
  equipInRoster,
  giveFromConvoy,
  lookUpItem,
  storeInConvoy,
} from './convoy.ts';
import { RUN_ITEMS, type RunState } from './run.ts';

export type RosterColumn = 'units' | 'items' | 'convoy';

// The tabs of the panel beside the units. Only Items has columns of its
// own; on the others the cursor is on the units.
export type RosterTab = 'stats' | 'skills' | 'items';

export const ROSTER_TABS: readonly RosterTab[] = Object.freeze(['stats', 'skills', 'items']);

// Where the pointer can point: a column, the open item actions, or a tab.
export type RosterTarget = RosterColumn | 'actions' | 'tabs';

export type RosterItemActionId = 'equip' | 'store';

export interface RosterItemAction extends MenuAction {
  id: RosterItemActionId;
}

export interface RosterScreenState {
  run: RunState;
  tab: RosterTab;
  // Items or convoy only on the Items tab.
  column: RosterColumn;
  // The picked unit, an item in its inventory, and an entry in the convoy.
  // Each stays in range of its list (0 when the list is empty).
  unitIndex: number;
  itemIndex: number;
  convoyIndex: number;
  // The highlighted item's actions while open, else null.
  actions: Menu<RosterItemAction> | null;
}

// The rules the screen checks against: the classes (for weapon types) and
// the items a run can name.
export interface RosterRules {
  classes: readonly UnitClass[];
  items: readonly Item[];
}

const DEFAULT_RULES: RosterRules = Object.freeze({ classes: UNIT_CLASSES, items: RUN_ITEMS });

// What left and right walk through, in order.
const STOPS: readonly { tab: RosterTab; column: RosterColumn }[] = Object.freeze([
  { tab: 'stats', column: 'units' },
  { tab: 'skills', column: 'units' },
  { tab: 'items', column: 'units' },
  { tab: 'items', column: 'items' },
  { tab: 'items', column: 'convoy' },
]);

// The screen opened on `run`, on its first unit's stats.
export function openRosterScreen(run: RunState): RosterScreenState {
  return freeze({ run, tab: 'stats', column: 'units', unitIndex: 0, itemIndex: 0, convoyIndex: 0, actions: null });
}

// The unit the screen has picked, or null when the roster is empty.
export function getPickedUnit(state: RosterScreenState) {
  return state.run.roster[state.unitIndex] ?? null;
}

// Moves the cursor: `dx` steps along the tabs and columns (stopping at
// either end), `dy` within the column or the open actions (wrapping).
export function moveRosterCursor(state: RosterScreenState, dx: number, dy: number): RosterScreenState {
  if (state.actions) {
    return dy === 0 ? state : freeze({ ...state, actions: moveSelection(state.actions, dy) });
  }
  if (dx !== 0) {
    const at = STOPS.findIndex((stop) => stop.tab === state.tab && stop.column === state.column);
    const stop = STOPS[Math.max(0, Math.min(STOPS.length - 1, at + Math.sign(dx)))];
    return stop === STOPS[at] ? state : freeze({ ...state, ...stop });
  }
  if (dy === 0) return state;
  const field = INDEX_FIELDS[state.column];
  const count = columnLength(state, state.column);
  if (count === 0) return state;
  const index = (((state[field] + dy) % count) + count) % count;
  return clampIndices(freeze({ ...state, [field]: index }));
}

// Points the cursor at entry `index` of `target` (e.g. on mouse hover),
// or opens tab `index` of ROSTER_TABS. Pointing at a column or a tab
// closes any open actions; leaving the Items tab puts the cursor back on
// the units. Out-of-range indices change nothing.
export function pointRosterCursor(state: RosterScreenState, target: RosterTarget, index: number): RosterScreenState {
  if (target === 'actions') {
    return state.actions ? freeze({ ...state, actions: selectIndex(state.actions, index) }) : state;
  }
  if (target === 'tabs') {
    const tab = ROSTER_TABS[index];
    if (!tab || tab === state.tab) return state;
    return freeze({ ...state, tab, column: tab === 'items' ? state.column : 'units', actions: null });
  }
  if (!Number.isInteger(index) || index < 0 || index >= columnLength(state, target)) return state;
  const tab = target === 'units' ? state.tab : 'items';
  return clampIndices(freeze({ ...state, tab, column: target, [INDEX_FIELDS[target]]: index, actions: null }));
}

// Confirm on whatever's under the cursor (see the top of this file).
// Disabled actions and convoy items the unit has no room for do nothing.
export function confirmRoster(state: RosterScreenState, rules: RosterRules = DEFAULT_RULES): RosterScreenState {
  const unit = getPickedUnit(state);
  if (!unit) return state;
  if (state.actions) {
    const action = state.actions.actions[state.actions.selectedIndex];
    if (!action || action.disabled) return state;
    const run =
      action.id === 'equip'
        ? equipInRoster(state.run, unit.id, state.itemIndex, rules.classes, rules.items)
        : storeInConvoy(state.run, unit.id, state.itemIndex, rules.items);
    // Equipping moves the weapon to the front, so the cursor follows it.
    const itemIndex = action.id === 'equip' ? 0 : state.itemIndex;
    return clampIndices(freeze({ ...state, run, itemIndex, actions: null }));
  }
  switch (state.column) {
    case 'units':
      return freeze({ ...state, tab: 'items', column: 'items' });
    case 'items': {
      const actions = getItemActions(state, rules);
      return actions.length === 0 ? state : freeze({ ...state, actions: createActionMenu(actions) });
    }
    case 'convoy': {
      if (!canGiveFromConvoy(state.run, unit.id, state.convoyIndex, rules.items)) return state;
      const run = giveFromConvoy(state.run, unit.id, state.convoyIndex, rules.items);
      return clampIndices(freeze({ ...state, run }));
    }
  }
}

// Cancel: closes the open actions, steps back to the units, or — from the
// units — returns null to close the screen.
export function cancelRoster(state: RosterScreenState): RosterScreenState | null {
  if (state.actions) return freeze({ ...state, actions: null });
  if (state.column !== 'units') return freeze({ ...state, column: 'units' });
  return null;
}

// The actions for the picked unit's highlighted item: Equip for a weapon
// or armor (disabled when its class can't wield the weapon or it's already
// equipped or worn), and
// Store (disabled for a natural weapon). None when there's no item there.
export function getItemActions(state: RosterScreenState, rules: RosterRules = DEFAULT_RULES): RosterItemAction[] {
  const unit = getPickedUnit(state);
  const entry = unit?.items[state.itemIndex];
  if (!unit || !entry) return [];
  const item = lookUpItem(entry.itemId, rules.items);
  const actions: RosterItemAction[] = [];
  if (isWeapon(item) || isArmor(item)) {
    actions.push({
      id: 'equip',
      label: 'Equip',
      disabled: !canEquipInRoster(state.run, unit.id, state.itemIndex, rules.classes, rules.items),
    });
  }
  actions.push({
    id: 'store',
    label: 'Store',
    disabled: !canStoreInConvoy(state.run, unit.id, state.itemIndex, rules.items),
  });
  return actions.map((action) => Object.freeze(action));
}

const INDEX_FIELDS = Object.freeze({ units: 'unitIndex', items: 'itemIndex', convoy: 'convoyIndex' } as const);

function columnLength(state: RosterScreenState, column: RosterColumn): number {
  if (column === 'units') return state.run.roster.length;
  if (column === 'items') return getPickedUnit(state)?.items.length ?? 0;
  return state.run.convoy.length;
}

// Each index pulled back into its list, after the lists change (or the
// picked unit does).
function clampIndices(state: RosterScreenState): RosterScreenState {
  const clamp = (index: number, count: number) => Math.max(0, Math.min(index, count - 1));
  const unitIndex = clamp(state.unitIndex, columnLength(state, 'units'));
  const next = { ...state, unitIndex };
  return freeze({
    ...next,
    itemIndex: clamp(state.itemIndex, columnLength(next, 'items')),
    convoyIndex: clamp(state.convoyIndex, columnLength(next, 'convoy')),
  });
}

function freeze(state: RosterScreenState): RosterScreenState {
  return Object.freeze(state);
}
