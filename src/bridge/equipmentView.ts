// Snapshot of Warband Mode's equipment screen
// (src/game/warband/equipmentScreen.ts) for React: the units for its tabs,
// the picked unit's slots with what each holds, the gear on offer for the
// picked slot (the convoy's, then what teammates wear), the unit's whole
// stat sheet and load before and after the highlighted choice, and what
// the highlighted item does. Plain frozen data, built fresh from the
// screen's state.

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
  // The slot's tab over the gear list: what goes in it ("Weapons").
  tabLabel: string;
  item: { label: string; icon: string | null } | null;
  locked: boolean;
}

// A choice in the gear column: Remove, or a convoy item for the slot.
// `tag` names a weapon's family or an armor piece's weight (null for
// Remove and anything else); `untrained` marks a weapon of a family the
// unit isn't trained in, which fights without the proficiency bonus.
// `wornBy` names the teammate wearing it, who loses it if it's taken.
export interface GearChoiceView {
  key: string;
  label: string;
  icon: string | null;
  remove: boolean;
  disabled: boolean;
  tag: string | null;
  untrained: boolean;
  wornBy: string | null;
}

// One of the unit's numbers, now and with the highlighted choice (`after`
// is the same as `before` when nothing is highlighted). `group` splits the
// sheet: the unit's stats, then the rates it fights with.
export interface EquipmentStatView {
  id: EquipmentStatId;
  label: string;
  group: 'stats' | 'combat';
  before: number;
  after: number;
}

export type EquipmentStatId =
  | 'maxHealth'
  | 'strength'
  | 'intelligence'
  | 'dexterity'
  | 'speed'
  | 'luck'
  | 'defense'
  | 'resistance'
  | 'movement'
  | 'attack'
  | 'hit'
  | 'crit'
  | 'avoid'
  | 'attackSpeed';

const STATS: readonly (readonly [EquipmentStatId, string, EquipmentStatView['group']])[] = Object.freeze([
  ['maxHealth', 'HP', 'stats'],
  ['strength', 'STR', 'stats'],
  ['intelligence', 'INT', 'stats'],
  ['dexterity', 'DEX', 'stats'],
  ['speed', 'SPD', 'stats'],
  ['luck', 'LCK', 'stats'],
  ['defense', 'DEF', 'stats'],
  ['resistance', 'RES', 'stats'],
  ['movement', 'MOV', 'stats'],
  ['attack', 'ATK', 'combat'],
  ['hit', 'HIT', 'combat'],
  ['crit', 'CRIT', 'combat'],
  ['avoid', 'AVO', 'combat'],
  ['attackSpeed', 'AS', 'combat'],
]);

// What each slot's tab over the gear list says.
const SLOT_TABS: Readonly<Record<GearSlot, string>> = Object.freeze({
  main: 'Weapons',
  off: 'Off-hand',
  head: 'Head',
  body: 'Body',
  accessory: 'Accessory',
  special: 'Special',
});

// What the unit carries (its weapon's weight and its armor's) against what
// it carries freely (its strength), now and with the highlighted choice.
// Every point over costs a point of attack speed, every 4 a point of
// movement (combatStats.ts).
export interface EquipmentLoadView {
  before: number;
  after: number;
  capacity: number;
}

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
  load: EquipmentLoadView | null;
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
      tabLabel: SLOT_TABS[each],
      item: gear ? Object.freeze({ label: gear.label, icon: getItemSprite(gear.id) }) : null,
      locked: each === 'off' && locked,
    });
  });
  const choices = getGearChoices(state, items);
  const trained = unit ? restoreUnit(unit, classes, items).weaponTypes : [];
  const gear = choices.map((choice) =>
    Object.freeze<GearChoiceView>(
      choice.kind === 'remove'
        ? {
            key: 'remove',
            label: choice.cost > 0 ? `Cleanse (${choice.cost} gold)` : 'Remove',
            icon: null,
            remove: true,
            disabled: choice.disabled,
            tag: null,
            untrained: false,
            wornBy: null,
          }
        : {
            key:
              choice.kind === 'gear' ? `${choice.item.id}@${choice.convoyIndex}` : `${choice.item.id}@${choice.unitId}`,
            label: choice.item.label,
            icon: getItemSprite(choice.item.id),
            remove: false,
            disabled: choice.disabled,
            tag: getGearTag(choice.item),
            untrained: choice.item.kind === 'weapon' && !isTrained(trained, choice.item),
            wornBy:
              choice.kind === 'worn'
                ? (state.run.roster.find((other) => other.id === choice.unitId)?.name ?? null)
                : null,
          },
    ),
  );
  const highlighted = state.column === 'gear' ? choices[state.gearIndex] : undefined;
  const shown =
    highlighted && highlighted.kind !== 'remove'
      ? highlighted.item
      : state.column !== 'gear' && slot
        ? equipment[slot]
        : undefined;

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
        ? STATS.map(([id, label, group]) =>
            Object.freeze({ id, label, group, before: before.detail[id], after: after.detail[id] }),
          )
        : [],
    ),
    load: before && after ? Object.freeze({ before: before.load, after: after.load, capacity: before.capacity }) : null,
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

// The unit `unitId`'s numbers in `run`, as its stat sheet works them out,
// with its load (weapon and armor weight) and its strength to carry it.
function toNumbers(
  run: RunState,
  unitId: string,
  classes: readonly UnitClass[],
  items: readonly Item[],
): { detail: UnitDetailView; load: number; capacity: number } | null {
  const snapshot = run.roster.find((unit) => unit.id === unitId);
  if (!snapshot) return null;
  const unit = restoreUnit(snapshot, classes, items);
  const detail = toUnitDetailView(unit);
  if (!detail) return null;
  return { detail, load: (unit.equippedWeapon?.weapon.weight ?? 0) + unit.armorWeight, capacity: unit.strength };
}
