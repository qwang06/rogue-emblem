// Snapshot of Warband Mode's equipment screen
// (src/game/warband/equipmentScreen.ts) for React: the units, the picked
// unit's slots with what each holds, the gear the convoy offers for the
// picked slot, the unit's numbers before and after the highlighted choice,
// and what the highlighted item does. Plain frozen data, built fresh from
// the screen's state.

import { GEAR_SLOT_LABELS, GEAR_SLOTS, type GearSlot } from '../game/equipment.ts';
import { ARMOR_WEIGHT_LABELS, type Item } from '../game/items.ts';
import { isTrained, WEAPON_TYPE_LABELS } from '../game/weapons.ts';
import { getItemSprite, getUnitSprite } from '../game/tileset.ts';
import { UNIT_CLASSES, type UnitClass } from '../game/unitClasses.ts';
import { getUnitEquipment, lookUpItem } from '../game/warband/convoy.ts';
import {
  getEquipmentUnit,
  getGearChoices,
  getPickedSlot,
  getUnitSlots,
  isOffHandLocked,
  previewGearChoice,
  type EquipmentColumn,
  type EquipmentScreenState,
} from '../game/warband/equipmentScreen.ts';
import { restoreUnit, RUN_ITEMS, type RunState } from '../game/warband/run.ts';
import { describeItem, type ItemDetail } from './rosterView.ts';
import { toUnitDetailView, type UnitDetailView } from './views.ts';

export interface EquipmentUnitView {
  id: string;
  name: string;
  classLabel: string;
  level: number;
  sprite: string;
}

// A slot on the paper doll: its name, what it holds (null when empty), and
// whether it's locked (the off hand beside a two-handed weapon).
export interface EquipmentSlotView {
  slot: GearSlot;
  label: string;
  item: { label: string; icon: string | null } | null;
  locked: boolean;
}

// A choice in the gear column: Remove, or a convoy item for the slot.
// `tag` names a weapon's family or an armor piece's weight (null for
// Remove and anything else); `untrained` marks a weapon of a family the
// unit isn't trained in, which fights without the proficiency bonus.
export interface GearChoiceView {
  key: string;
  label: string;
  icon: string | null;
  remove: boolean;
  disabled: boolean;
  tag: string | null;
  untrained: boolean;
}

// One of the unit's numbers, now and with the highlighted choice (`after`
// is the same as `before` when nothing is highlighted).
export interface EquipmentStatView {
  id: EquipmentStatId;
  label: string;
  before: number;
  after: number;
}

export type EquipmentStatId =
  'attack' | 'hit' | 'crit' | 'attackSpeed' | 'avoid' | 'defense' | 'resistance' | 'movement';

const STATS: readonly [EquipmentStatId, string][] = Object.freeze([
  ['attack', 'ATK'],
  ['hit', 'HIT'],
  ['crit', 'CRIT'],
  ['attackSpeed', 'AS'],
  ['avoid', 'AVO'],
  ['defense', 'DEF'],
  ['resistance', 'RES'],
  ['movement', 'MOV'],
]);

export interface EquipmentScreenView {
  column: EquipmentColumn;
  unitIndex: number;
  slotIndex: number;
  gearIndex: number;
  units: readonly EquipmentUnitView[];
  // The picked unit's name, or null with nobody on the roster.
  unitName: string | null;
  slots: readonly EquipmentSlotView[];
  // How many slots the largest paper doll has, so a monster's two leave
  // the rest of the column blank rather than shrinking it.
  maxSlots: number;
  // The picked slot's name, for the gear column's heading.
  slotLabel: string | null;
  gear: readonly GearChoiceView[];
  stats: readonly EquipmentStatView[];
  // The highlighted item (a gear choice, else the picked slot's gear): its
  // name and what it does. Null over an empty slot or Remove.
  detail: ItemDetail | null;
}

export function toEquipmentScreenView(
  state: EquipmentScreenState,
  classes: readonly UnitClass[] = UNIT_CLASSES,
  items: readonly Item[] = RUN_ITEMS,
): EquipmentScreenView {
  const unit = getEquipmentUnit(state);
  const slot = getPickedSlot(state);
  const equipment = unit ? getUnitEquipment(unit, items) : {};
  const locked = unit ? isOffHandLocked(unit, items) : false;
  const slots = getUnitSlots(unit).map((each) => {
    const gear = equipment[each];
    return Object.freeze<EquipmentSlotView>({
      slot: each,
      label: GEAR_SLOT_LABELS[each],
      item: gear ? Object.freeze({ label: gear.label, icon: getItemSprite(gear.id) }) : null,
      locked: each === 'off' && locked,
    });
  });
  const choices = getGearChoices(state, items);
  const trained = unit ? restoreUnit(unit, classes, items).weaponTypes : [];
  const gear = choices.map((choice) =>
    Object.freeze<GearChoiceView>(
      choice.kind === 'remove'
        ? { key: 'remove', label: 'Remove', icon: null, remove: true, disabled: false, tag: null, untrained: false }
        : {
            key: `${choice.item.id}@${choice.convoyIndex}`,
            label: choice.item.label,
            icon: getItemSprite(choice.item.id),
            remove: false,
            disabled: choice.disabled,
            tag: getGearTag(choice.item),
            untrained: choice.item.kind === 'weapon' && !isTrained(trained, choice.item),
          },
    ),
  );
  const highlighted = state.column === 'gear' ? choices[state.gearIndex] : undefined;
  const shown =
    highlighted?.kind === 'gear' ? highlighted.item : state.column !== 'gear' && slot ? equipment[slot] : undefined;

  const before = unit ? toNumbers(state.run, unit.id, classes, items) : null;
  const preview = previewGearChoice(state, items);
  const after = unit && preview ? toNumbers(preview, unit.id, classes, items) : before;

  return Object.freeze({
    column: state.column,
    unitIndex: state.unitIndex,
    slotIndex: state.slotIndex,
    gearIndex: state.gearIndex,
    units: Object.freeze(
      state.run.roster.map((snapshot) =>
        Object.freeze({
          id: snapshot.id,
          name: snapshot.name,
          classLabel: classes.find((c) => c.id === snapshot.classId)?.label ?? snapshot.classId,
          level: snapshot.level,
          sprite: getUnitSprite(snapshot.classId),
        }),
      ),
    ),
    unitName: unit?.name ?? null,
    slots: Object.freeze(slots),
    maxSlots: GEAR_SLOTS.humanoid.length,
    slotLabel: slot ? GEAR_SLOT_LABELS[slot] : null,
    gear: Object.freeze(gear),
    stats: Object.freeze(
      before && after
        ? STATS.map(([id, label]) => Object.freeze({ id, label, before: before[id], after: after[id] }))
        : [],
    ),
    detail: shown ? describeItem(lookUpItem(shown.id, items)) : null,
  });
}

// What kind of gear `item` is, for its row: a weapon's family, an armor
// piece's weight, or null.
function getGearTag(item: Item): string | null {
  if (item.kind === 'weapon') return WEAPON_TYPE_LABELS[item.type];
  if (item.kind === 'armor' && item.weightClass) return ARMOR_WEIGHT_LABELS[item.weightClass];
  return null;
}

// The unit `unitId`'s numbers in `run`, as its stat sheet works them out.
function toNumbers(
  run: RunState,
  unitId: string,
  classes: readonly UnitClass[],
  items: readonly Item[],
): UnitDetailView | null {
  const snapshot = run.roster.find((unit) => unit.id === unitId);
  return snapshot ? toUnitDetailView(restoreUnit(snapshot, classes, items)) : null;
}
