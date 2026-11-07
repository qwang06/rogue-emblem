import type { MouseEvent } from 'react';
import { ICON_URLS } from '../assets/fantasyIcons.ts';
import { SPRITE_URLS } from '../assets/sprites.ts';
import { gameCommands } from '../bridge/commands.ts';
import type {
  EquipmentLoadView,
  EquipmentScreenView,
  EquipmentSlotView,
  EquipmentStatView,
  GearChoiceView,
} from '../bridge/equipmentView.ts';
import type { EquipmentColumn } from '../game/warband/equipmentScreen.ts';
import { DockSection } from './dock.tsx';
import { GlyphIcon } from './GlyphIcon.tsx';
import { KeyHint, type KeyHintEntry } from './KeyHint.tsx';
import { Pips } from './Pips.tsx';
import { ScrollList } from './ScrollList.tsx';
import { UnitSprite } from './UnitSprite.tsx';
import { useGameStore } from './useGameStore.ts';
import './EquipmentScreen.css';

// Mouse handlers for an entry of the equipment screen: hovering moves the
// cursor there and clicking acts on it, exactly as the keyboard would.
function pointerProps(column: EquipmentColumn, index: number) {
  return {
    onMouseEnter: () => gameCommands.send({ type: 'hover-equipment', column, index }),
    onClick: (event: MouseEvent) => {
      event.stopPropagation();
      gameCommands.send({ type: 'select-equipment', column, index });
    },
  };
}

// An item's icon, or an empty dashed spot of the same size.
function Icon({ icon, className = 'equipment-screen__icon' }: { icon: string | null; className?: string }) {
  const url = icon ? SPRITE_URLS[icon] : undefined;
  return url ? (
    <img className={className} src={url} alt="" />
  ) : (
    <span className={`${className} equipment-screen__icon--empty`} />
  );
}

// Warband Mode's equipment screen between stages (see
// src/game/warband/equipmentScreen.ts), as one screen over the stage, a
// Tactics Ogre convoy table with Into the Breach's flat preview: the
// warband down the left (clicked to pick a unit, or stepped with Q and E;
// hovering one does nothing, so the mouse can't switch units by passing
// over them) with the convoy's count under it; in the middle the picked
// unit's worn gear (five slots for a humanoid, a monster's special slot
// and accessory, the picked one lit) with its load, beside the convoy
// table for the picked slot under one tab per slot: Remove first, then
// the convoy's pieces, then what teammates wear, each with its numbers
// and what wearing it would change; down the right a preview of the
// swap, the unit's rates before and after the highlighted choice, and
// what the highlighted item does. Every list keeps its size (a monster's
// two slots leave the rest blank, every change cell is drawn), so moving
// the cursor or changing gear never reflows anything. GridScene handles
// the input; the mouse is forwarded to it.
export function EquipmentScreen() {
  const view = useGameStore((state) => state.equipmentScreen);
  if (!view) return null;
  return <EquipmentScreenPanel view={view} />;
}

function EquipmentScreenPanel({ view }: { view: EquipmentScreenView }) {
  const { column } = view;
  const unit = view.units[view.unitIndex] ?? null;
  const pickedSlot = view.slots[view.slotIndex] ?? null;
  const highlighted = column === 'gear' ? (view.gear[view.gearIndex] ?? null) : null;
  const hints: readonly KeyHintEntry[] = [
    ['←→', 'Slot · convoy'],
    ['↑↓', 'Choose'],
    ['Q E', 'Unit'],
    ['Enter', column === 'gear' ? 'Equip' : 'Open'],
    ['Esc', column === 'slots' ? 'Done' : 'Back'],
  ];

  return (
    <div className="equipment-screen" role="dialog" aria-label="Equipment">
      <aside className="equipment-screen__column equipment-screen__warband">
        <Warband view={view} />
        <Convoy view={view} />
      </aside>

      <section className="equipment-screen__stage">
        <Worn view={view} unit={unit} />
        <ConvoyTable view={view} pickedSlot={pickedSlot} />
      </section>

      <aside className="equipment-screen__column equipment-screen__side">
        <Preview view={view} unit={unit} pickedSlot={pickedSlot} highlighted={highlighted} />
        <Changes view={view} />
        <Detail view={view} />
        <AlsoFits view={view} />
      </aside>

      <footer className="equipment-screen__bar">
        <KeyHint className="equipment-screen__hints" entries={hints} />
        <p className="equipment-screen__line">{describeStep(view, pickedSlot, highlighted)}</p>
        <button
          type="button"
          className="battle-bar__button"
          onClick={(event) => {
            event.stopPropagation();
            gameCommands.send({ type: 'cancel' });
          }}
        >
          <GlyphIcon kind={column === 'slots' ? 'close' : 'back'} />
          {column === 'slots' ? 'Done' : 'Back'}
        </button>
        <button
          type="button"
          className="battle-bar__button battle-bar__button--end"
          disabled={column === 'gear' ? !highlighted || highlighted.disabled : !pickedSlot || pickedSlot.locked}
          onClick={(event) => {
            event.stopPropagation();
            gameCommands.send({
              type: 'select-equipment',
              column,
              index: column === 'gear' ? view.gearIndex : view.slotIndex,
            });
          }}
        >
          {column === 'gear' ? (highlighted?.remove ? 'Take off' : 'Equip') : 'Open'}
        </button>
      </footer>
    </div>
  );
}

// What confirming now does, for the bar's line.
function describeStep(
  view: EquipmentScreenView,
  pickedSlot: EquipmentSlotView | null,
  highlighted: GearChoiceView | null,
): string {
  if (view.column !== 'gear') {
    if (!pickedSlot) return 'Nobody to dress.';
    if (pickedSlot.locked) return 'Both hands are busy: free the main hand first.';
    return `Open the convoy for the ${pickedSlot.label.toLowerCase()}.`;
  }
  if (!highlighted) return pickedSlot?.locked ? 'Free a hand first.' : 'Nothing fits this slot.';
  if (highlighted.disabled) return "Can't be worn now.";
  const worn = pickedSlot?.item;
  if (highlighted.remove) return worn ? `Take off the ${worn.label} · it goes back to the convoy` : 'Take it off.';
  const parts = [`Equip the ${highlighted.label}`];
  if (worn) parts.push(`the ${worn.label} goes back to the convoy`);
  if (highlighted.wornBy) parts.push(`${highlighted.wornBy} loses it`);
  return parts.join(' · ');
}

// Every unit on the roster, the picked one lit; a click picks it.
function Warband({ view }: { view: EquipmentScreenView }) {
  return (
    <DockSection title="Warband" className="equipment-screen__roster">
      <ul className="equipment-screen__units">
        {view.units.map((unit, index) => {
          const picked = index === view.unitIndex;
          return (
            <li
              key={unit.id}
              className={picked ? 'equipment-screen__unit equipment-screen__unit--picked' : 'equipment-screen__unit'}
              aria-current={picked ? 'true' : undefined}
              onClick={(event) => {
                event.stopPropagation();
                gameCommands.send({ type: 'select-equipment-unit', index });
              }}
            >
              <span className="equipment-screen__unit-sprite">
                <UnitSprite sprite={unit.sprite} />
              </span>
              <span className="equipment-screen__unit-name" title={unit.name}>
                {unit.name}
              </span>
              <span className="equipment-screen__unit-hp">
                {unit.health}
                {unit.health < unit.maxHealth && (
                  <span className="equipment-screen__unit-hp-max">/{unit.maxHealth}</span>
                )}
              </span>
              <span className="equipment-screen__unit-class" title={unit.classLabel}>
                {unit.classLabel} · Lv {unit.level}
              </span>
              <span className="equipment-screen__unit-pips">
                <Pips value={unit.health} max={unit.maxHealth} size="small" />
              </span>
            </li>
          );
        })}
      </ul>
    </DockSection>
  );
}

// How much the convoy holds, and what's on offer for each slot.
function Convoy({ view }: { view: EquipmentScreenView }) {
  return (
    <DockSection title="Convoy" className="equipment-screen__convoy">
      <p className="equipment-screen__count">
        <span className="equipment-screen__count-number">{view.convoyCount}</span>{' '}
        {view.convoyCount === 1 ? 'item' : 'items'}
      </p>
      <p className="equipment-screen__offer">
        {view.slots.length > 0 ? view.slots.map((slot) => `${slot.tabLabel} ${slot.count}`).join(' · ') : '—'}
      </p>
    </DockSection>
  );
}

// The picked unit's slots, the picked one lit, and its load.
function Worn({ view, unit }: { view: EquipmentScreenView; unit: EquipmentScreenView['units'][number] | null }) {
  const blankSlots = Math.max(0, view.maxSlots - view.slots.length);
  return (
    <section className={`equipment-screen__worn${view.column === 'slots' ? ' equipment-screen__worn--focused' : ''}`}>
      <h3 className="equipment-screen__heading">
        <span>Worn</span>
        <span className="equipment-screen__heading-note">{unit?.name ?? ''}</span>
      </h3>
      <ul className="equipment-screen__slots">
        {view.slots.map((slot, index) => {
          const selected = index === view.slotIndex;
          const classes = ['equipment-screen__slot'];
          if (selected) classes.push('equipment-screen__slot--selected');
          if (slot.locked) classes.push('equipment-screen__slot--locked');
          return (
            <li
              key={slot.slot}
              className={classes.join(' ')}
              aria-current={selected ? 'true' : undefined}
              aria-disabled={slot.locked ? 'true' : undefined}
              {...pointerProps('slots', index)}
            >
              <Icon icon={slot.item?.icon ?? null} />
              <span className="equipment-screen__slot-lines">
                <span className="equipment-screen__slot-label">{slot.label}</span>
                {slot.locked ? (
                  <>
                    <span className="equipment-screen__slot-name equipment-screen__slot-name--empty">
                      <GlyphIcon kind="lock" /> Both hands busy
                    </span>
                    <span className="equipment-screen__slot-meta">Two-handed weapon</span>
                  </>
                ) : slot.item ? (
                  <>
                    <span className="equipment-screen__slot-name" title={slot.item.label}>
                      {slot.item.label}
                    </span>
                    <span className="equipment-screen__slot-meta">{slot.item.meta}</span>
                  </>
                ) : (
                  <>
                    <span className="equipment-screen__slot-name equipment-screen__slot-name--empty">— empty</span>
                    <span
                      className={`equipment-screen__slot-meta${slot.count > 0 ? ' equipment-screen__slot-meta--offer' : ''}`}
                    >
                      {slot.count > 0 ? `${slot.count} in convoy` : 'Nothing in convoy'}
                    </span>
                  </>
                )}
              </span>
            </li>
          );
        })}
        {Array.from({ length: blankSlots }, (_, index) => (
          <li
            key={`blank-${index}`}
            className="equipment-screen__slot equipment-screen__slot--blank"
            aria-hidden="true"
          />
        ))}
      </ul>
      {view.load && <LoadMeter load={view.load} />}
    </section>
  );
}

// The unit's load against its strength: a bar filled to the load with the
// highlighted gear (red past the strength mark), and the numbers.
function LoadMeter({ load }: { load: EquipmentLoadView }) {
  const scale = Math.max(load.capacity, load.before, load.after, 1);
  const fill = (Math.min(load.after, load.capacity) / scale) * 100;
  const over = (Math.max(0, load.after - load.capacity) / scale) * 100;
  const mark = (load.capacity / scale) * 100;
  const change = Math.sign(load.after - load.before);
  const overload = Math.max(0, load.after - load.capacity);
  return (
    <div className="equipment-screen__load" title="Load past strength costs 1 AS a point, and 1 MOV every 4">
      <h3 className="equipment-screen__heading">
        <span>Load</span>
        <span className="equipment-screen__heading-note">
          {load.before !== load.after && (
            <span className={change > 0 ? 'equipment-screen__down' : 'equipment-screen__up'}>{load.before} → </span>
          )}
          {load.after}
          <span className="equipment-screen__dim">/{load.capacity}</span>
        </span>
      </h3>
      <div className="equipment-screen__load-bar" aria-hidden="true">
        <span className="equipment-screen__load-fill" style={{ width: `${fill}%` }} />
        <span className="equipment-screen__load-over" style={{ left: `${fill}%`, width: `${over}%` }} />
        <span className="equipment-screen__load-mark" style={{ left: `${mark}%` }} />
      </div>
      <p className={`equipment-screen__load-note${overload > 0 ? ' equipment-screen__down' : ''}`}>
        {overload > 0 ? `${overload} over strength · slower` : 'Within strength'}
      </p>
    </div>
  );
}

// The convoy table for the picked slot: a tab per slot, a header, then a
// row per choice with its numbers and what wearing it changes.
function ConvoyTable({ view, pickedSlot }: { view: EquipmentScreenView; pickedSlot: EquipmentSlotView | null }) {
  const focused = view.column === 'gear';
  return (
    <section className={`equipment-screen__table${focused ? ' equipment-screen__table--focused' : ''}`}>
      <div className="equipment-screen__tabs" role="tablist" aria-label="Slots">
        {Array.from({ length: view.maxSlots }, (_, index) => {
          const slot = view.slots[index];
          if (!slot) return <span key={`blank-${index}`} className="equipment-screen__tab" aria-hidden="true" />;
          const selected = index === view.slotIndex;
          return (
            <button
              key={slot.slot}
              type="button"
              role="tab"
              aria-selected={selected}
              title={`${slot.tabLabel} · ${slot.count} on offer`}
              className={`equipment-screen__tab${selected ? ' equipment-screen__tab--selected' : ''}`}
              onClick={(event) => {
                event.stopPropagation();
                gameCommands.send({ type: 'select-equipment', column: 'slots', index });
              }}
            >
              <img className="equipment-screen__tab-icon" src={ICON_URLS[slot.tabIcon]} alt="" />
              <span className="equipment-screen__tab-count">{slot.count}</span>
            </button>
          );
        })}
        <span className="equipment-screen__tabs-fill" aria-hidden="true" />
      </div>
      <div className="equipment-screen__row equipment-screen__row--header" aria-hidden="true">
        <span />
        <span>Convoy · {pickedSlot?.tabLabel ?? '—'}</span>
        {view.columns.map((label) => (
          <span key={label} className="equipment-screen__num">
            {label}
          </span>
        ))}
        <span className="equipment-screen__delta">If equipped</span>
      </div>
      <ScrollList className="equipment-screen__rows" selectedIndex={view.gearIndex}>
        {view.gear.length === 0 && (
          <li className="equipment-screen__row equipment-screen__row--empty">
            {pickedSlot?.locked ? 'Free a hand first' : 'Nothing for this slot'}
          </li>
        )}
        {view.gear.map((choice, index) => {
          const selected = index === view.gearIndex;
          const classes = ['equipment-screen__row'];
          if (selected && focused) classes.push('equipment-screen__row--selected');
          else if (selected) classes.push('equipment-screen__row--picked');
          if (choice.disabled) classes.push('equipment-screen__row--disabled');
          if (choice.remove) classes.push('equipment-screen__row--remove');
          return (
            <li
              key={choice.key}
              className={classes.join(' ')}
              aria-current={selected ? 'true' : undefined}
              aria-disabled={choice.disabled ? 'true' : undefined}
              title={gearTitle(choice)}
              {...pointerProps('gear', index)}
            >
              <Icon icon={choice.icon} />
              <span className="equipment-screen__row-lines">
                <span className="equipment-screen__row-name" title={choice.label}>
                  {choice.label}
                  {choice.wornBy && <span className="equipment-screen__row-worn"> · {choice.wornBy}</span>}
                </span>
                <span className={`equipment-screen__row-kind${choice.untrained ? ' equipment-screen__down' : ''}`}>
                  {choice.untrained ? `${choice.kind} · untrained` : choice.kind}
                </span>
              </span>
              {choice.cells.map((cell, cellIndex) => (
                <span key={cellIndex} className={`equipment-screen__num${cell ? '' : ' equipment-screen__num--none'}`}>
                  {cell || '–'}
                </span>
              ))}
              <span className="equipment-screen__delta">
                {choice.deltas.map((delta) => (
                  <span
                    key={delta.text}
                    className={`equipment-screen__delta-line equipment-screen__delta-line--${delta.tone}`}
                  >
                    {delta.text}
                  </span>
                ))}
              </span>
            </li>
          );
        })}
      </ScrollList>
    </section>
  );
}

// A gear row's tooltip: that it's disabled, whose it is, or that the unit
// isn't trained in its family.
function gearTitle(choice: GearChoiceView): string | undefined {
  if (choice.disabled) return "Can't be worn now";
  if (choice.wornBy) return `Worn by ${choice.wornBy}: taking it leaves them without it`;
  if (choice.untrained) return 'Untrained: no +15 hit and +5 crit';
  return undefined;
}

// The unit and the swap in hand: what the slot holds beside what the
// highlighted choice puts there.
function Preview({
  view,
  unit,
  pickedSlot,
  highlighted,
}: {
  view: EquipmentScreenView;
  unit: EquipmentScreenView['units'][number] | null;
  pickedSlot: EquipmentSlotView | null;
  highlighted: GearChoiceView | null;
}) {
  const worn = pickedSlot?.item ?? null;
  const next = highlighted && !highlighted.disabled ? highlighted : null;
  return (
    <DockSection title="Preview" className="equipment-screen__preview">
      <div className="equipment-screen__head">
        <span className="equipment-screen__portrait">
          {unit && <UnitSprite sprite={unit.sprite} scale={1} animated />}
        </span>
        <span className="equipment-screen__head-lines">
          <span className="equipment-screen__head-name" title={unit?.name}>
            {unit?.name ?? 'Nobody'}
          </span>
          <span className="equipment-screen__head-class">
            {unit ? `${unit.classLabel} · Lv ${unit.level}` : ''}
            {pickedSlot ? ` · ${pickedSlot.label}` : ''}
          </span>
        </span>
      </div>
      <div className={`equipment-screen__swap${next ? ' equipment-screen__swap--live' : ''}`}>
        <span className="equipment-screen__swap-item">
          <Icon icon={worn?.icon ?? null} />
          <span className="equipment-screen__swap-name">{worn?.label ?? 'Empty'}</span>
        </span>
        <span className="equipment-screen__swap-arrow" aria-hidden="true">
          ➜
        </span>
        <span className="equipment-screen__swap-item equipment-screen__swap-item--new">
          <Icon icon={next && !next.remove ? next.icon : null} />
          <span className="equipment-screen__swap-name">
            {next ? (next.remove ? 'Empty' : next.label) : (worn?.label ?? 'Empty')}
          </span>
        </span>
      </div>
      {view.column !== 'gear' && <p className="equipment-screen__swap-hint">Open the convoy to see a swap.</p>}
    </DockSection>
  );
}

const CHANGE_STATS: readonly EquipmentStatView['id'][] = ['attack', 'hit', 'crit', 'attackSpeed', 'avoid'];

// The unit's rates before and after the highlighted choice, with its
// reach and load. Every row is drawn, the after number colored where it
// moves.
function Changes({ view }: { view: EquipmentScreenView }) {
  const stats = CHANGE_STATS.map((id) => view.stats.find((stat) => stat.id === id)).filter(
    (stat): stat is EquipmentStatView => stat !== undefined,
  );
  return (
    <DockSection title="Changes" className="equipment-screen__changes">
      <ul className="equipment-screen__change-list">
        {stats.map((stat) => (
          <ChangeRow
            key={stat.id}
            label={stat.label === 'CRIT' ? 'CRT' : stat.label}
            before={String(stat.before)}
            after={String(stat.after)}
            tone={toneOf(stat.after - stat.before)}
          />
        ))}
        {view.range && <ChangeRow label="RNG" before={view.range.before} after={view.range.after} tone="flat" />}
        {view.load && (
          <ChangeRow
            label="LOAD"
            before={`${view.load.before}/${view.load.capacity}`}
            after={`${view.load.after}/${view.load.capacity}`}
            tone={toneOf(view.load.before - view.load.after)}
          />
        )}
      </ul>
    </DockSection>
  );
}

function toneOf(change: number): 'up' | 'down' | 'flat' {
  return change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
}

function ChangeRow({
  label,
  before,
  after,
  tone,
}: {
  label: string;
  before: string;
  after: string;
  tone: 'up' | 'down' | 'flat';
}) {
  return (
    <li className="equipment-screen__change">
      <span className="equipment-screen__change-label">{label}</span>
      <span className="equipment-screen__change-before">{before}</span>
      <span className="equipment-screen__change-arrow" aria-hidden="true">
        ➜
      </span>
      <span className={`equipment-screen__change-after equipment-screen__change-after--${tone}`}>{after}</span>
    </li>
  );
}

// The highlighted item: its name, what it is and its numbers.
function Detail({ view }: { view: EquipmentScreenView }) {
  const detail = view.detail;
  const numbers = detail?.numbers;
  const chips = numbers
    ? ([
        ['Pow', numbers.power],
        ['Hit', numbers.hit],
        ['Crt', numbers.crit],
        ['Wt', numbers.weight],
        ['Rng', numbers.range],
      ] as const)
    : [];
  return (
    <DockSection title={detail?.label ?? 'Item'} className="equipment-screen__detail">
      {detail ? (
        <>
          <p className="equipment-screen__detail-kind">{detail.description}</p>
          {chips.length > 0 && (
            <p className="equipment-screen__detail-numbers">
              {chips.map(([label, value]) =>
                value === undefined ? null : (
                  <span key={label} className="equipment-screen__detail-number">
                    {label} <b>{value}</b>
                  </span>
                ),
              )}
            </p>
          )}
        </>
      ) : (
        <p className="equipment-screen__detail-kind equipment-screen__dim">
          {view.column === 'gear'
            ? 'Taking the gear off sends it back to the convoy.'
            : 'Pick a slot, then gear to wear in it. What it displaces goes back to the convoy; gear a teammate wears leaves them.'}
        </p>
      )}
    </DockSection>
  );
}

// Who else on the roster could use the highlighted item.
function AlsoFits({ view }: { view: EquipmentScreenView }) {
  return (
    <DockSection title="Also fits" className="equipment-screen__fits">
      <p className="equipment-screen__fits-line">
        {view.detail ? (view.alsoFits.length > 0 ? view.alsoFits.join(', ') : 'Nobody else') : '—'}
      </p>
    </DockSection>
  );
}
