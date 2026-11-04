// The equipment screen between Warband Mode stages, Tactics Ogre style:
// the units as tabs across the top, then the picked unit's gear slots
// (equipment.ts: a humanoid's main hand, off hand, head, body and
// accessory, or a monster's special slot and accessory), the gear that can
// go in the picked slot, and the unit's numbers. The unit only changes
// through its tabs (stepEquipmentUnit, pickEquipmentUnit), never by moving
// the cursor, so the mouse can't switch units by passing over them. Two
// columns, the cursor in one of them:
//   - slots: up and down pick a slot; confirm or right open the gear for
//     it; cancel closes the screen
//   - gear: "Remove" first while the slot holds something, then every
//     convoy item for that slot, then what teammates wear in it (one the
//     unit can't wear disabled, such as a shield beside a two-handed
//     weapon); confirm wears it (or takes the slot's gear off), whatever
//     it displaces going back to the convoy, and returns to the slots;
//     cancel or left go back to the slots without changing anything
// The camp menu offers the screen (see camp.ts). Everything here is pure:
// each function returns a new frozen state and leaves its input alone.

import {
  canEquip,
  GEAR_SLOTS,
  getGearLayout,
  getGearSlot,
  hasHandFree,
  isGear,
  type Gear,
  type GearSlot,
} from '../equipment.ts';
import type { Item } from '../items.ts';
import {
  canGiveFromConvoy,
  canCarry,
  canUnequip,
  getUnequipCost,
  getUnitEquipment,
  giveFromConvoy,
  lookUpItem,
  unequipToConvoy,
} from './convoy.ts';
import { RUN_ITEMS, type RunState, type UnitSnapshot } from './run.ts';

export type EquipmentColumn = 'slots' | 'gear';

export interface EquipmentScreenState {
  run: RunState;
  column: EquipmentColumn;
  // The picked unit, its picked slot and the highlighted gear choice. Each
  // stays in range of its list (0 when the list is empty).
  unitIndex: number;
  slotIndex: number;
  gearIndex: number;
}

// One choice in the gear column: take the slot's gear off, wear the convoy
// entry at `convoyIndex`, or take what the teammate `unitId` wears in the
// slot (it leaves them for this unit). `disabled` marks gear the unit
// can't wear, and a teammate's cursed gear, which sticks to them.
export type GearChoice =
  // Remove costs `cost` gold for cursed gear (getUnequipCost), and is
  // disabled when the run can't pay.
  | { kind: 'remove'; cost: number; disabled: boolean }
  | { kind: 'gear'; convoyIndex: number; item: Gear; disabled: boolean }
  | { kind: 'worn'; unitId: string; item: Gear; disabled: boolean };

// The screen opened on `run`, on its first unit's first slot.
export function openEquipmentScreen(run: RunState): EquipmentScreenState {
  return freeze({ run, column: 'slots', unitIndex: 0, slotIndex: 0, gearIndex: 0 });
}

// The unit the screen has picked, or null when the roster is empty.
export function getEquipmentUnit(state: EquipmentScreenState): UnitSnapshot | null {
  return state.run.roster[state.unitIndex] ?? null;
}

// The picked unit's slots, in paper-doll order.
export function getUnitSlots(unit: UnitSnapshot | null): readonly GearSlot[] {
  return unit ? GEAR_SLOTS[getGearLayout(unit.classId)] : [];
}

// The slot the screen has picked, or null with nobody on the roster.
export function getPickedSlot(state: EquipmentScreenState): GearSlot | null {
  return getUnitSlots(getEquipmentUnit(state))[state.slotIndex] ?? null;
}

// Whether the unit's off hand is locked: its main hand holds a two-handed
// weapon or a staff, so no shield can go on.
export function isOffHandLocked(unit: UnitSnapshot, items: readonly Item[] = RUN_ITEMS): boolean {
  return !hasHandFree(getUnitEquipment(unit, items));
}

// What the gear column offers for the picked slot: Remove while it holds
// something, then each convoy entry that goes in that slot (special gear
// only when it's made for the unit's class), in convoy order, then what
// each teammate wears there, in roster order.
export function getGearChoices(state: EquipmentScreenState, items: readonly Item[] = RUN_ITEMS): GearChoice[] {
  const unit = getEquipmentUnit(state);
  const slot = getPickedSlot(state);
  if (!unit || !slot) return [];
  const equipment = getUnitEquipment(unit, items);
  const layout = getGearLayout(unit.classId);
  const choices: GearChoice[] = [];
  if (equipment[slot]) {
    const cost = getUnequipCost(state.run, unit.id, slot, items);
    choices.push(Object.freeze({ kind: 'remove', cost, disabled: !canUnequip(state.run, unit.id, slot, items) }));
  }
  state.run.convoy.forEach((entry, convoyIndex) => {
    const item = lookUpItem(entry.itemId, items);
    if (!isGear(item) || getGearSlot(item) !== slot) return;
    if (slot === 'special' && (item.kind !== 'armor' || item.forClass !== unit.classId)) return;
    const disabled = !canEquip(equipment, item, layout, unit.classId) || !canCarry(state.run, unit.id, item.id, items);
    choices.push(Object.freeze({ kind: 'gear', convoyIndex, item, disabled }));
  });
  for (const other of state.run.roster) {
    if (other.id === unit.id) continue;
    const item = getUnitEquipment(other, items)[slot];
    if (!item || getGearSlot(item) !== slot) continue;
    if (slot === 'special' && (item.kind !== 'armor' || item.forClass !== unit.classId)) continue;
    const disabled =
      getUnequipCost(state.run, other.id, slot, items) > 0 ||
      !canEquip(equipment, item, layout, unit.classId) ||
      !canCarry(state.run, unit.id, item.id, items);
    choices.push(Object.freeze({ kind: 'worn', unitId: other.id, item, disabled }));
  }
  return choices;
}

// The run as it would be once the highlighted gear choice is taken, or
// null when the cursor isn't on an enabled one. The screen previews the
// unit's numbers with it.
export function previewGearChoice(state: EquipmentScreenState, items: readonly Item[] = RUN_ITEMS): RunState | null {
  if (state.column !== 'gear') return null;
  const choice = getGearChoices(state, items)[state.gearIndex];
  if (!choice || choice.disabled) return null;
  return applyChoice(state, choice, items);
}

// Moves the cursor: `dx` steps between the slots and the gear (only into
// the gear with a unit to dress), `dy` within the column (wrapping).
export function moveEquipmentCursor(state: EquipmentScreenState, dx: number, dy: number): EquipmentScreenState {
  if (dx !== 0) return dx > 0 ? openGear(state) : closeGear(state);
  if (dy === 0) return state;
  const count = columnLength(state, state.column);
  if (count === 0) return state;
  const field = INDEX_FIELDS[state.column];
  const index = (((state[field] + dy) % count) + count) % count;
  return clampIndices(freeze({ ...state, [field]: index, ...(field !== 'gearIndex' && { gearIndex: 0 }) }));
}

// Points the cursor at entry `index` of `column` (e.g. on mouse hover).
// Out-of-range indices change nothing.
export function pointEquipmentCursor(
  state: EquipmentScreenState,
  column: EquipmentColumn,
  index: number,
  items: readonly Item[] = RUN_ITEMS,
): EquipmentScreenState {
  if (!Number.isInteger(index) || index < 0 || index >= columnLength(state, column, items)) return state;
  const field = INDEX_FIELDS[column];
  if (state.column === column && state[field] === index) return state;
  const reset = column === 'slots' && state.slotIndex !== index ? { gearIndex: 0 } : {};
  return clampIndices(freeze({ ...state, column, [field]: index, ...reset }));
}

// Steps the picked unit `delta` tabs along the roster (wrapping), keeping
// the column and, where the new unit has it, the slot.
export function stepEquipmentUnit(state: EquipmentScreenState, delta: number): EquipmentScreenState {
  const count = state.run.roster.length;
  if (count === 0 || delta === 0) return state;
  return pickEquipmentUnit(state, (((state.unitIndex + delta) % count) + count) % count);
}

// Picks the unit at roster `index` (its tab was clicked). Out-of-range
// indices, or the unit already picked, change nothing.
export function pickEquipmentUnit(state: EquipmentScreenState, index: number): EquipmentScreenState {
  if (!Number.isInteger(index) || index < 0 || index >= state.run.roster.length) return state;
  if (index === state.unitIndex) return state;
  return clampIndices(freeze({ ...state, unitIndex: index, gearIndex: 0 }));
}

// Confirm on whatever's under the cursor (see the top of this file). A
// disabled gear choice does nothing.
export function confirmEquipment(
  state: EquipmentScreenState,
  items: readonly Item[] = RUN_ITEMS,
): EquipmentScreenState {
  if (!getEquipmentUnit(state)) return state;
  if (state.column !== 'gear') return openGear(state);
  const choice = getGearChoices(state, items)[state.gearIndex];
  if (!choice || choice.disabled) return state;
  return clampIndices(freeze({ ...state, run: applyChoice(state, choice, items), column: 'slots', gearIndex: 0 }));
}

// Cancel: back from the gear to the slots, or — from the slots — null to
// close the screen.
export function cancelEquipment(state: EquipmentScreenState): EquipmentScreenState | null {
  if (state.column === 'slots') return null;
  return closeGear(state);
}

function applyChoice(state: EquipmentScreenState, choice: GearChoice, items: readonly Item[]): RunState {
  const unit = getEquipmentUnit(state)!;
  if (choice.kind === 'remove') return unequipToConvoy(state.run, unit.id, getPickedSlot(state)!, items);
  if (choice.kind === 'worn') {
    // Off the teammate into the convoy (at its end), then onto this unit.
    const freed = unequipToConvoy(state.run, choice.unitId, getPickedSlot(state)!, items);
    return giveFromConvoy(freed, unit.id, freed.convoy.length - 1, items);
  }
  if (!canGiveFromConvoy(state.run, unit.id, choice.convoyIndex, items)) return state.run;
  return giveFromConvoy(state.run, unit.id, choice.convoyIndex, items);
}

function openGear(state: EquipmentScreenState): EquipmentScreenState {
  if (state.column === 'gear' || columnLength(state, 'units') === 0) return state;
  return freeze({ ...state, column: 'gear', gearIndex: 0 });
}

function closeGear(state: EquipmentScreenState): EquipmentScreenState {
  return state.column === 'slots' ? state : freeze({ ...state, column: 'slots', gearIndex: 0 });
}

const INDEX_FIELDS = Object.freeze({ slots: 'slotIndex', gear: 'gearIndex' } as const);

function columnLength(
  state: EquipmentScreenState,
  column: EquipmentColumn | 'units',
  items: readonly Item[] = RUN_ITEMS,
) {
  if (column === 'units') return state.run.roster.length;
  if (column === 'slots') return getUnitSlots(getEquipmentUnit(state)).length;
  return getGearChoices(state, items).length;
}

// Each index pulled back into its list, after the lists change (or the
// picked unit does: a monster has fewer slots than a humanoid).
function clampIndices(state: EquipmentScreenState): EquipmentScreenState {
  const clamp = (index: number, count: number) => Math.max(0, Math.min(index, count - 1));
  const unitIndex = clamp(state.unitIndex, columnLength(state, 'units'));
  const withUnit = { ...state, unitIndex };
  const slotIndex = clamp(state.slotIndex, columnLength(withUnit, 'slots'));
  const withSlot = { ...withUnit, slotIndex };
  return freeze({ ...withSlot, gearIndex: clamp(state.gearIndex, columnLength(withSlot, 'gear')) });
}

function freeze(state: EquipmentScreenState): EquipmentScreenState {
  return Object.freeze(state);
}
