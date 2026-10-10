// Snapshot of Warband Mode's roster screen (src/game/warband/rosterScreen.ts)
// for React: the units, the picked unit's inventory slots, the convoy, the
// cursor, the open item actions and what the highlighted item does. Plain
// frozen data, built fresh from the screen's state.

import type { Menu } from '../game/actionMenu.ts';
import { MAX_INVENTORY_SLOTS, type Item } from '../game/items.ts';
import { getUnitSprite } from '../game/tileset.ts';
import { UNIT_CLASSES, type UnitClass } from '../game/unitClasses.ts';
import { formatWeaponRange } from '../game/weapons.ts';
import { canGiveFromConvoy, getEquippedIndex, lookUpItem } from '../game/warband/convoy.ts';
import { RUN_ITEMS, type ItemSnapshot } from '../game/warband/run.ts';
import {
  getPickedUnit,
  type RosterColumn,
  type RosterItemAction,
  type RosterScreenState,
} from '../game/warband/rosterScreen.ts';

export interface RosterUnitView {
  id: string;
  name: string;
  classLabel: string;
  level: number;
  health: number;
  maxHealth: number;
  sprite: string;
}

// An item in a unit's inventory or the convoy. `quantity` is how many (a
// weapon's or staff's uses left), or null for a weapon that never breaks;
// `equipped` marks the weapon the unit fights with; `disabled` marks a
// convoy item the picked unit has no room for.
export interface RosterItemView {
  key: string;
  label: string;
  kind: string;
  quantity: number | null;
  equipped: boolean;
  disabled: boolean;
}

export interface RosterScreenView {
  column: RosterColumn;
  unitIndex: number;
  itemIndex: number;
  convoyIndex: number;
  units: readonly RosterUnitView[];
  // The picked unit's name, or null with nobody on the roster.
  unitName: string | null;
  items: readonly RosterItemView[];
  // How many slots an inventory has, so empty ones can be drawn.
  slots: number;
  convoy: readonly RosterItemView[];
  actions: Menu<RosterItemAction> | null;
  // The highlighted item (in the items or convoy column): its name and
  // what it does. Null over the units or an empty list.
  detail: { label: string; description: string } | null;
}

export function toRosterScreenView(
  state: RosterScreenState,
  classes: readonly UnitClass[] = UNIT_CLASSES,
  items: readonly Item[] = RUN_ITEMS,
): RosterScreenView {
  const unit = getPickedUnit(state);
  const equipped = unit ? getEquippedIndex(state.run, unit.id, classes, items) : null;
  const toItem = (entry: ItemSnapshot, index: number, extra: Partial<RosterItemView>): RosterItemView => {
    const item = lookUpItem(entry.itemId, items);
    const neverBreaks = item.kind === 'weapon' && item.uses === null;
    return Object.freeze({
      key: `${entry.itemId}@${index}`,
      label: item.label,
      kind: item.kind,
      quantity: neverBreaks ? null : entry.quantity,
      equipped: false,
      disabled: false,
      ...extra,
    });
  };
  const unitItems = (unit?.items ?? []).map((entry, index) => toItem(entry, index, { equipped: index === equipped }));
  const convoy = state.run.convoy.map((entry, index) =>
    toItem(entry, index, { disabled: !unit || !canGiveFromConvoy(state.run, unit.id, index, items) }),
  );
  const highlighted =
    state.column === 'items'
      ? unit?.items[state.itemIndex]
      : state.column === 'convoy'
        ? state.run.convoy[state.convoyIndex]
        : undefined;
  const detail = highlighted ? describeItem(lookUpItem(highlighted.itemId, items)) : null;

  return Object.freeze({
    column: state.column,
    unitIndex: state.unitIndex,
    itemIndex: state.itemIndex,
    convoyIndex: state.convoyIndex,
    units: Object.freeze(
      state.run.roster.map((snapshot) =>
        Object.freeze({
          id: snapshot.id,
          name: snapshot.name,
          classLabel: classes.find((c) => c.id === snapshot.classId)?.label ?? snapshot.classId,
          level: snapshot.level,
          health: snapshot.health,
          maxHealth: snapshot.maxHealth,
          sprite: getUnitSprite(snapshot.classId),
        }),
      ),
    ),
    unitName: unit?.name ?? null,
    items: Object.freeze(unitItems),
    slots: MAX_INVENTORY_SLOTS,
    convoy: Object.freeze(convoy),
    actions: state.actions,
    detail,
  });
}

// An item's name and a line on what it does: a weapon's numbers, a staff's
// healing, a consumable's recovery. Gear the screen doesn't know yet gets
// just its name.
export function describeItem(item: Item): { label: string; description: string } {
  const describe = (description: string) => Object.freeze({ label: item.label, description });
  if (item.kind === 'weapon') {
    const kind = item.type[0].toUpperCase() + item.type.slice(1);
    const uses = item.uses === null ? 'never breaks' : `${item.uses} uses`;
    return describe(
      `${kind} weapon · Mt ${item.might} · Hit ${item.hit} · Crt ${item.crit} · Wt ${item.weight} · Rng ${formatWeaponRange(item)} · ${uses}`,
    );
  }
  if (item.kind === 'staff') {
    return describe(`Staff · Heals ${item.power} + MAG · Rng ${formatWeaponRange(item)} · ${item.uses} uses`);
  }
  if (item.kind === 'consumable') {
    return describe(`Restores up to ${item.amount} ${item.stat === 'health' ? 'HP' : 'mana'}.`);
  }
  return describe('');
}
