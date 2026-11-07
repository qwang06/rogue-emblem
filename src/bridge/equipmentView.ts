// Snapshot of Warband Mode's equipment screen
// (src/game/warband/equipmentScreen.ts) for React: the units for its tabs,
// the picked unit's slots with what each holds, the gear on offer for the
// picked slot (the convoy's, then what teammates wear), the unit's whole
// stat sheet and load before and after the highlighted choice, and what
// the highlighted item does. Plain frozen data, built fresh from the
// screen's state.

import { GEAR_SLOT_LABELS, GEAR_SLOTS, getGearLayout, type Gear, type GearSlot } from '../game/equipment.ts';
import { ARMOR_WEIGHT_LABELS, type Item } from '../game/items.ts';
import { formatWeaponRange, isTrained, WEAPON_TYPE_LABELS } from '../game/weapons.ts';
import { getItemSprite, getUnitSprite } from '../game/tileset.ts';
import { getGearSound, type GearSound } from '../audio/soundKinds.ts';
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
import { restoreUnit, RUN_ITEMS, type RunState, type UnitSnapshot } from '../game/warband/run.ts';
import type { Unit } from '../game/Unit.ts';
import { describeItem, type ItemDetail } from './rosterView.ts';
import { toUnitDetailView, type UnitDetailView } from './views.ts';

export interface EquipmentUnitView {
  id: string;
  name: string;
  classLabel: string;
  level: number;
  sprite: string;
  health: number;
  maxHealth: number;
}

// A slot on the paper doll: its name, what it holds (null when empty), and
// whether it's locked (the off hand beside a two-handed weapon).
export interface EquipmentSlotView {
  slot: GearSlot;
  label: string;
  // The slot's tab over the gear list: what goes in it ("Weapons"), and
  // the tab's icon (a name in ICON_URLS).
  tabLabel: string;
  tabIcon: string;
  // `meta` sums the gear up in a line ("Spear · Pow 4 · Wt 3", "+2 DEF ·
  // Wt 2"); `sound`: what putting it on or taking it off sounds like.
  item: { label: string; icon: string | null; meta: string; sound: GearSound } | null;
  locked: boolean;
  // How many pieces are on offer for the slot (the convoy's and what
  // teammates wear), for its tab.
  count: number;
}

// One line of what a gear choice would change: "+2 ATK" (up), "−1 AS"
// (down), or a note ("Can't use", "Drops shield", "Rng 1").
export interface GearDeltaView {
  text: string;
  tone: 'up' | 'down' | 'flat';
}

// A choice in the gear column: Remove, or a convoy item for the slot.
// `tag` names a weapon's family or an armor piece's weight (null for
// Remove and anything else); `untrained` marks a weapon of a family the
// unit isn't trained in, which fights without the proficiency bonus.
// `wornBy` names the teammate wearing it, who loses it if it's taken.
// `kind` is the row's line under the name ("Spear · 1H", "Light · Body");
// `cells` its numbers under the table's `columns`, "" where it has none;
// `deltas` what wearing it changes (at most two), or why it can't be.
export interface GearChoiceView {
  key: string;
  label: string;
  icon: string | null;
  remove: boolean;
  disabled: boolean;
  tag: string | null;
  untrained: boolean;
  wornBy: string | null;
  kind: string;
  cells: readonly string[];
  deltas: readonly GearDeltaView[];
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

// What each slot's tab over the gear list says, and the icon it shows.
const SLOT_TABS: Readonly<Record<GearSlot, string>> = Object.freeze({
  main: 'Weapons',
  off: 'Off-hand',
  head: 'Head',
  body: 'Body',
  accessory: 'Accessory',
  special: 'Special',
});

const SLOT_ICONS: Readonly<Record<GearSlot, string>> = Object.freeze({
  main: 'sword',
  off: 'shield',
  head: 'helmet',
  body: 'chestplate',
  accessory: 'ring',
  special: 'gem',
});

// The gear table's number columns: a weapon's for the main hand, armor's
// for every other slot.
const WEAPON_COLUMNS: readonly string[] = Object.freeze(['Pow', 'Hit', 'Wt']);
const ARMOR_COLUMNS: readonly string[] = Object.freeze(['Def', 'Res', 'Wt']);

// The order a choice's changes are listed in: what it does to the fight
// first. Each is a stat of the sheet and its short name.
const DELTA_STATS: readonly (readonly [EquipmentStatId, string])[] = Object.freeze([
  ['attack', 'ATK'],
  ['hit', 'HIT'],
  ['crit', 'CRT'],
  ['attackSpeed', 'AS'],
  ['avoid', 'AVO'],
  ['defense', 'DEF'],
  ['resistance', 'RES'],
  ['movement', 'MOV'],
  ['strength', 'STR'],
  ['speed', 'SPD'],
  ['luck', 'LCK'],
  ['dexterity', 'DEX'],
  ['intelligence', 'INT'],
  ['maxHealth', 'HP'],
]);

// How many changes a gear row lists.
const MAX_DELTAS = 2;

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
  // The gear table's number columns for the picked slot (three).
  columns: readonly string[];
  gear: readonly GearChoiceView[];
  stats: readonly EquipmentStatView[];
  load: EquipmentLoadView | null;
  // The unit's reach, now and with the highlighted choice ("1–2").
  range: { before: string; after: string } | null;
  // The highlighted item (a gear choice, else the picked slot's gear): its
  // name and what it does. Null over an empty slot or Remove.
  detail: ItemDetail | null;
  // The teammates trained in the highlighted weapon's family (or who
  // could wear the highlighted armor), by name.
  alsoFits: readonly string[];
  // How many entries the convoy holds.
  convoyCount: number;
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
  const slots = getUnitSlots(unit).map((each, index) => {
    const gear = equipment[each];
    const offered = getGearChoices({ ...state, column: 'slots', slotIndex: index }, items);
    return Object.freeze<EquipmentSlotView>({
      slot: each,
      label: GEAR_SLOT_LABELS[each],
      tabLabel: SLOT_TABS[each],
      tabIcon: SLOT_ICONS[each],
      item: gear
        ? Object.freeze({
            label: gear.label,
            icon: getItemSprite(gear.id),
            meta: describeGearMeta(gear),
            sound: getGearSound(gear),
          })
        : null,
      locked: each === 'off' && locked,
      count: offered.filter((choice) => choice.kind !== 'remove').length,
    });
  });
  const choices = getGearChoices(state, items);
  const trained = unit ? restoreUnit(unit, classes, items).weaponTypes : [];
  const before = unit ? toNumbers(state.run, unit.id, classes, items) : null;
  const gear = choices.map((choice, index) => {
    const outcome = previewGearChoice({ ...state, column: 'gear', gearIndex: index }, items);
    const changed = unit && outcome ? toNumbers(outcome, unit.id, classes, items) : null;
    const deltas = choice.disabled
      ? [Object.freeze<GearDeltaView>({ text: "Can't use", tone: 'flat' })]
      : before && changed
        ? listDeltas(before, changed, unit!, outcome!, slot, items)
        : [];
    return Object.freeze<GearChoiceView>(
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
            kind: choice.cost > 0 ? 'Cursed · lifts for gold' : 'Back to the convoy',
            cells: Object.freeze(['', '', '']),
            deltas: Object.freeze(deltas),
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
            kind: describeGearKind(choice.item),
            cells: Object.freeze(toCells(choice.item, slot)),
            deltas: Object.freeze(deltas),
          },
    );
  });
  const highlighted = state.column === 'gear' ? choices[state.gearIndex] : undefined;
  const shown =
    highlighted && highlighted.kind !== 'remove'
      ? highlighted.item
      : state.column !== 'gear' && slot
        ? equipment[slot]
        : undefined;

  const preview = previewGearChoice(state, items);
  const after = unit && preview ? toNumbers(preview, unit.id, classes, items) : before;
  const alsoFits =
    shown && unit
      ? state.run.roster
          .filter((other) => other.id !== unit.id && fits(restoreUnit(other, classes, items), shown))
          .map((other) => other.name)
      : [];

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
          health: snapshot.health,
          maxHealth: snapshot.maxHealth,
        }),
      ),
    ),
    unitName: unit?.name ?? null,
    slots: Object.freeze(slots),
    maxSlots: GEAR_SLOTS.humanoid.length,
    slotLabel: slot ? GEAR_SLOT_LABELS[slot] : null,
    columns: slot === 'main' ? WEAPON_COLUMNS : ARMOR_COLUMNS,
    gear: Object.freeze(gear),
    stats: Object.freeze(
      before && after
        ? STATS.map(([id, label, group]) =>
            Object.freeze({ id, label, group, before: before.detail[id], after: after.detail[id] }),
          )
        : [],
    ),
    load: before && after ? Object.freeze({ before: before.load, after: after.load, capacity: before.capacity }) : null,
    range: before && after ? Object.freeze({ before: before.detail.range, after: after.detail.range }) : null,
    detail: shown ? describeItem(lookUpItem(shown.id, items)) : null,
    alsoFits: Object.freeze(alsoFits),
    convoyCount: state.run.convoy.reduce((sum, entry) => sum + entry.quantity, 0),
  });
}

// A line summing up worn gear: a weapon's family, power and weight;
// a staff's healing; armor's bonuses and weight.
function describeGearMeta(gear: Gear): string {
  if (gear.kind === 'weapon') return `${WEAPON_TYPE_LABELS[gear.type]} · Pow ${gear.power} · Wt ${gear.weight}`;
  if (gear.kind === 'staff') return `Staff · Heals ${gear.power} · Rng ${formatWeaponRange(gear)}`;
  const parts = [
    ...(gear.defense > 0 ? [`+${gear.defense} DEF`] : []),
    ...(gear.avoid ? [`+${gear.avoid} AVO`] : []),
    ...(gear.resistance ? [`+${gear.resistance} RES`] : []),
    ...(gear.weight > 0 ? [`Wt ${gear.weight}`] : []),
  ];
  return parts.length > 0 ? parts.join(' · ') : 'Worn';
}

// A gear row's line under its name: a weapon's family and hands, armor's
// weight and where it goes.
function describeGearKind(gear: Gear): string {
  if (gear.kind === 'weapon') {
    const crit = gear.crit > 0 ? ` · Crt ${gear.crit}` : '';
    return `${WEAPON_TYPE_LABELS[gear.type]} · ${gear.hands}H${crit}`;
  }
  if (gear.kind === 'staff') return `Staff · ${gear.hands}H · Heals ${gear.power}`;
  const where = GEAR_SLOT_LABELS[gear.slot === 'shield' ? 'off' : gear.slot];
  return gear.weightClass ? `${ARMOR_WEIGHT_LABELS[gear.weightClass]} · ${where}` : where;
}

// A gear row's numbers under the table's columns for `slot`: a weapon's
// power, hit and weight in the main hand; armor's defense, resistance
// and weight elsewhere. A staff shows its healing as power.
function toCells(gear: Gear, slot: GearSlot | null): string[] {
  if (slot === 'main') {
    if (gear.kind === 'weapon') return [String(gear.power), String(gear.hit), String(gear.weight)];
    if (gear.kind === 'staff') return [String(gear.power), '', ''];
    return ['', '', String(gear.weight)];
  }
  if (gear.kind === 'armor')
    return [String(gear.defense), gear.resistance ? String(gear.resistance) : '', String(gear.weight)];
  return ['', '', gear.kind === 'weapon' ? String(gear.weight) : ''];
}

// What taking a choice changes, at most MAX_DELTAS lines: its biggest
// gain and its biggest loss (a shield it would knock off counts as the
// loss), so a trade shows both sides; then the rest by size, then a
// change of reach. Ties go to the fight's numbers (DELTA_STATS order).
function listDeltas(
  before: Numbers,
  after: Numbers,
  unit: UnitSnapshot,
  outcome: RunState,
  slot: GearSlot | null,
  items: readonly Item[],
): GearDeltaView[] {
  const changes = DELTA_STATS.map(([id, label]) => ({ label, change: after.detail[id] - before.detail[id] })).filter(
    (each) => each.change !== 0,
  );
  const bySize = (a: { change: number }, b: { change: number }) => Math.abs(b.change) - Math.abs(a.change);
  const toDelta = ({ label, change }: { label: string; change: number }): GearDeltaView => ({
    text: `${change > 0 ? '+' : '−'}${Math.abs(change)} ${label}`,
    tone: change > 0 ? 'up' : 'down',
  });
  const gains = changes
    .filter((each) => each.change > 0)
    .sort(bySize)
    .map(toDelta);
  const losses = changes
    .filter((each) => each.change < 0)
    .sort(bySize)
    .map(toDelta);
  const worn = outcome.roster.find((each) => each.id === unit.id);
  if (slot !== 'off' && worn && getUnitEquipment(unit, items).off && !getUnitEquipment(worn, items).off) {
    losses.unshift({ text: 'Drops shield', tone: 'down' });
  }
  const deltas: GearDeltaView[] = [];
  if (gains.length > 0) deltas.push(gains.shift()!);
  if (losses.length > 0) deltas.push(losses.shift()!);
  for (const rest of [...gains, ...losses]) {
    if (deltas.length >= MAX_DELTAS) break;
    deltas.push(rest);
  }
  if (deltas.length < MAX_DELTAS && after.detail.range !== before.detail.range) {
    deltas.push({ text: `Rng ${after.detail.range}`, tone: 'flat' });
  }
  if (deltas.length === 0) deltas.push({ text: '—', tone: 'flat' });
  return deltas.map((delta) => Object.freeze(delta));
}

// Whether `unit` could use `gear`: trained in a weapon's family, or able
// to wear the armor (a monster's special gear only when made for it).
function fits(unit: Unit, gear: Gear): boolean {
  if (gear.kind === 'weapon') return isTrained(unit.weaponTypes, gear);
  if (gear.kind === 'staff') return unit.weaponTypes.includes('staff');
  const layout = getGearLayout(unit.unitClass);
  if (gear.slot === 'special') return gear.forClass === unit.unitClass;
  return GEAR_SLOTS[layout].includes(gear.slot === 'shield' ? 'off' : gear.slot);
}

// What kind of gear `item` is, for its row: a weapon's family, an armor
// piece's weight, or null.
function getGearTag(item: Item): string | null {
  if (item.kind === 'weapon') return WEAPON_TYPE_LABELS[item.type];
  if (item.kind === 'armor' && item.weightClass) return ARMOR_WEIGHT_LABELS[item.weightClass];
  return null;
}

interface Numbers {
  detail: UnitDetailView;
  load: number;
  capacity: number;
}

// The unit `unitId`'s numbers in `run`, as its stat sheet works them out,
// with its load (weapon and armor weight) and its strength to carry it.
function toNumbers(
  run: RunState,
  unitId: string,
  classes: readonly UnitClass[],
  items: readonly Item[],
): Numbers | null {
  const snapshot = run.roster.find((unit) => unit.id === unitId);
  if (!snapshot) return null;
  const unit = restoreUnit(snapshot, classes, items);
  const detail = toUnitDetailView(unit);
  if (!detail) return null;
  return { detail, load: (unit.equippedWeapon?.weapon.weight ?? 0) + unit.armorWeight, capacity: unit.strength };
}
