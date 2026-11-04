import type { MouseEvent } from 'react';
import { SPRITE_URLS } from '../assets/sprites.ts';
import { gameCommands } from '../bridge/commands.ts';
import type {
  EquipmentLoadView,
  EquipmentScreenView,
  EquipmentStatView,
  GearChoiceView,
} from '../bridge/equipmentView.ts';
import type { EquipmentColumn } from '../game/warband/equipmentScreen.ts';
import { GlyphIcon } from './GlyphIcon.tsx';
import { ItemDetailLine } from './ItemDetailLine.tsx';
import { KeyHint } from './KeyHint.tsx';
import { MenuExitButton } from './MenuExitButton.tsx';
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

function rowClass(selected: boolean, focused: boolean, disabled = false) {
  const classes = ['action-menu__item', 'roster-screen__row'];
  if (selected && focused) classes.push('action-menu__item--selected');
  else if (selected) classes.push('roster-screen__row--picked');
  if (disabled) classes.push('action-menu__item--disabled');
  return classes.join(' ');
}

function columnClass(focused: boolean, extra: string) {
  return `roster-screen__column ${extra}${focused ? ' roster-screen__column--focused' : ''}`;
}

// An item's icon, or an empty spot of the same size.
function Icon({ icon }: { icon: string | null }) {
  const url = icon ? SPRITE_URLS[icon] : undefined;
  return url ? <img className="roster-screen__icon" src={url} alt="" /> : <span className="roster-screen__icon" />;
}

// One line of the stat sheet: the number now and, only when the
// highlighted gear changes it, a colored arrow and the new number. The
// change's cell is always laid out (hidden while nothing changes), so
// moving through the gear never moves a number.
function StatRow({ stat }: { stat: EquipmentStatView }) {
  const change = Math.sign(stat.after - stat.before);
  const tone = change > 0 ? ' equipment-sheet__change--up' : change < 0 ? ' equipment-sheet__change--down' : '';
  return (
    <li className="equipment-sheet__row">
      <span className="equipment-sheet__label">{stat.label}</span>
      <span className="equipment-sheet__value">{stat.before}</span>
      <span className={`equipment-sheet__change${tone}`} aria-hidden={change === 0 ? 'true' : undefined}>
        <span aria-hidden="true">→</span>
        <span className="visually-hidden"> becomes </span>
        <span className="equipment-sheet__value">{stat.after}</span>
      </span>
    </li>
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
  const tone = change > 0 ? ' equipment-load__after--up' : change < 0 ? ' equipment-load__after--down' : '';
  const overload = Math.max(0, load.after - load.capacity);
  return (
    <div className="equipment-load" title="Load past strength costs 1 AS a point, and 1 MOV every 4">
      <div className="equipment-load__text">
        <span className="equipment-sheet__label">Load</span>
        <span className="equipment-load__numbers">
          {load.before}
          <span className={`equipment-load__after${tone}`} aria-hidden={change === 0 ? 'true' : undefined}>
            {' → '}
            {load.after}
          </span>{' '}
          / {load.capacity}
        </span>
      </div>
      <div className="equipment-load__bar" aria-hidden="true">
        <span className="equipment-load__fill" style={{ width: `${fill}%` }} />
        <span className="equipment-load__over" style={{ left: `${fill}%`, width: `${over}%` }} />
        <span className="equipment-load__mark" style={{ left: `${mark}%` }} />
      </div>
      <div className={`equipment-load__note${overload > 0 ? ' equipment-load__note--over' : ''}`}>
        {overload > 0 ? `${overload} over strength` : 'Within strength'}
      </div>
    </div>
  );
}

// Warband Mode's equipment screen between stages (see
// src/game/warband/equipmentScreen.ts), Tactics Ogre style: the units as
// tabs across the top (clicked, or stepped with Q and E; hovering one does
// nothing, so the mouse can't switch units by passing over them); below,
// the picked unit's slots (five for a humanoid, a monster's special slot
// and accessory), the gear for the picked slot under one tab per slot
// (the convoy's, Remove first, then what teammates wear), and the unit's
// whole stat sheet and load, before and with the highlighted gear. Every
// list keeps its size (a monster's two slots leave the rest blank), and
// the detail line keeps two lines, so nothing reflows as the cursor moves
// or gear changes hands. GridScene handles the input; the mouse is
// forwarded to it.
export function EquipmentScreen() {
  const view = useGameStore((state) => state.equipmentScreen);
  if (!view) return null;
  return <EquipmentScreenPanel view={view} />;
}

function EquipmentScreenPanel({ view }: { view: EquipmentScreenView }) {
  const { column } = view;
  const blankSlots = Math.max(0, view.maxSlots - view.slots.length);
  const pickedSlot = view.slots[view.slotIndex];
  const unit = view.units[view.unitIndex];
  const stats = view.stats.filter((stat) => stat.group === 'stats');
  const combat = view.stats.filter((stat) => stat.group === 'combat');

  return (
    <div className="pause-overlay">
      <div className="roster-screen__scroll roster-screen__scroll--wide">
        <section className="panel roster-screen equipment-screen" aria-label="Equipment">
          <h2 className="roster-screen__title">Equipment</h2>
          <MenuExitButton kind={column === 'slots' ? 'close' : 'back'} />
          <div className="equipment-units" role="tablist" aria-label="Units">
            <button
              type="button"
              className="equipment-units__step"
              aria-label="Previous unit (Q)"
              onClick={(event) => {
                event.stopPropagation();
                gameCommands.send({ type: 'step-equipment-unit', delta: -1 });
              }}
            >
              ◀<span className="equipment-units__key">Q</span>
            </button>
            {view.units.map((each, index) => {
              const selected = index === view.unitIndex;
              return (
                <button
                  key={each.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  title={`${each.name}, ${each.classLabel} · Lv ${each.level}`}
                  className={`equipment-units__tab${selected ? ' equipment-units__tab--selected' : ''}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    gameCommands.send({ type: 'select-equipment-unit', index });
                  }}
                >
                  <span className="equipment-units__sprite">
                    <UnitSprite sprite={each.sprite} />
                  </span>
                  <span className="equipment-units__name">{each.name}</span>
                </button>
              );
            })}
            <button
              type="button"
              className="equipment-units__step"
              aria-label="Next unit (E)"
              onClick={(event) => {
                event.stopPropagation();
                gameCommands.send({ type: 'step-equipment-unit', delta: 1 });
              }}
            >
              <span className="equipment-units__key">E</span>▶
            </button>
          </div>
          <div className="equipment-layout">
            <section className={columnClass(column === 'slots', 'equipment-layout__doll')}>
              <h3 className="roster-screen__heading">Worn</h3>
              <ul className="action-menu__list equipment-slots">
                {view.slots.map((slot, index) => {
                  const selected = index === view.slotIndex;
                  return (
                    <li
                      key={slot.slot}
                      className={rowClass(selected, column === 'slots', slot.locked)}
                      aria-current={selected ? 'true' : undefined}
                      aria-disabled={slot.locked ? 'true' : undefined}
                      {...pointerProps('slots', index)}
                    >
                      <Icon icon={slot.item?.icon ?? null} />
                      <span className="roster-screen__unit">
                        <span className="roster-screen__meta">{slot.label}</span>
                        <span className="roster-screen__label equipment-slots__item">
                          {slot.locked ? (
                            <span className="equipment-slots__locked">
                              <GlyphIcon kind="lock" /> Both hands busy
                            </span>
                          ) : (
                            (slot.item?.label ?? (
                              <span className="equipment-slots__empty" aria-label="Empty">
                                -
                              </span>
                            ))
                          )}
                        </span>
                      </span>
                    </li>
                  );
                })}
                {Array.from({ length: blankSlots }, (_, index) => (
                  <li key={`blank-${index}`} className="roster-screen__row equipment-slots__blank" aria-hidden="true" />
                ))}
              </ul>
            </section>

            <section className={columnClass(column === 'gear', 'equipment-layout__gear')}>
              <div className="equipment-categories" role="tablist" aria-label="Gear">
                {Array.from({ length: view.maxSlots }, (_, index) => {
                  const slot = view.slots[index];
                  if (!slot)
                    return <span key={`blank-${index}`} className="equipment-categories__tab" aria-hidden="true" />;
                  const selected = index === view.slotIndex;
                  return (
                    <button
                      key={slot.slot}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      className={`equipment-categories__tab${selected ? ' equipment-categories__tab--selected' : ''}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        gameCommands.send({ type: 'select-equipment', column: 'slots', index });
                      }}
                    >
                      {slot.tabLabel}
                    </button>
                  );
                })}
              </div>
              <ScrollList
                className="action-menu__list roster-screen__list equipment-list"
                selectedIndex={view.gearIndex}
              >
                {view.gear.length === 0 && (
                  <li className="roster-screen__row roster-screen__row--empty">
                    {pickedSlot?.locked ? 'Free a hand first' : 'Nothing for this slot'}
                  </li>
                )}
                {view.gear.map((choice, index) => {
                  const selected = index === view.gearIndex;
                  return (
                    <li
                      key={choice.key}
                      className={rowClass(selected, column === 'gear', choice.disabled)}
                      aria-current={selected ? 'true' : undefined}
                      aria-disabled={choice.disabled ? 'true' : undefined}
                      title={gearTitle(choice)}
                      {...pointerProps('gear', index)}
                    >
                      <Icon icon={choice.icon} />
                      <span className={`roster-screen__label${choice.remove ? ' equipment-gear__remove' : ''}`}>
                        {choice.label}
                      </span>
                      {choice.wornBy ? (
                        <span className="equipment-gear__worn">{choice.wornBy}</span>
                      ) : (
                        choice.tag && (
                          <span
                            className={`equipment-gear__tag${choice.untrained ? ' equipment-gear__tag--untrained' : ''}`}
                          >
                            {choice.tag}
                          </span>
                        )
                      )}
                    </li>
                  );
                })}
              </ScrollList>
            </section>

            <section className="roster-screen__column equipment-layout__sheet" aria-label="Numbers">
              <h3 className="roster-screen__heading">{unit ? `${unit.classLabel} · Lv ${unit.level}` : 'Numbers'}</h3>
              <div className="equipment-sheet">
                <ul className="equipment-sheet__list">
                  {stats.map((stat) => (
                    <StatRow key={stat.id} stat={stat} />
                  ))}
                </ul>
                <ul className="equipment-sheet__list">
                  {combat.map((stat) => (
                    <StatRow key={stat.id} stat={stat} />
                  ))}
                </ul>
              </div>
              {view.load && <LoadMeter load={view.load} />}
            </section>
          </div>

          <ItemDetailLine
            detail={view.detail}
            hint="Pick a slot, then gear to wear in it. What it displaces goes back to the convoy; gear a teammate wears leaves them."
          />
          <KeyHint
            className="roster-screen__hint"
            entries={[
              ['Q E', 'Unit'],
              ['←→', 'Column'],
              ['↑↓', 'Choose'],
              ['Enter', column === 'gear' ? 'Equip' : 'Open'],
              ['Esc', column === 'slots' ? 'Done' : 'Back'],
            ]}
          />
        </section>
      </div>
    </div>
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
