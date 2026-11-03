import type { MouseEvent } from 'react';
import { SPRITE_URLS } from '../assets/sprites.ts';
import { gameCommands } from '../bridge/commands.ts';
import type { EquipmentScreenView, EquipmentStatView } from '../bridge/equipmentView.ts';
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

// One number now and with the highlighted gear. Both values and the arrow
// are always drawn (the after value matching while nothing changes it), so
// moving through the gear only recolors the row.
function StatRow({ stat }: { stat: EquipmentStatView }) {
  const change = Math.sign(stat.after - stat.before);
  const tone = change > 0 ? ' equipment-stats__after--up' : change < 0 ? ' equipment-stats__after--down' : '';
  return (
    <li className="equipment-stats__row">
      <span className="equipment-stats__label">{stat.label}</span>
      <span className="equipment-stats__value">{stat.before}</span>
      <span className="equipment-stats__arrow" aria-hidden="true">
        →
      </span>
      <span className={`equipment-stats__value equipment-stats__after${tone}`}>
        <span className="visually-hidden"> becomes </span>
        {stat.after}
      </span>
    </li>
  );
}

// Warband Mode's equipment screen between stages (see
// src/game/warband/equipmentScreen.ts), Tactics Ogre style: the units on
// the left; in the middle the picked unit's paper doll (five slots for a
// humanoid, a monster's special slot and accessory) over its numbers; on
// the right the gear the convoy has for the picked slot, Remove first. The
// numbers show what the highlighted gear would change, before → after.
// Every list keeps its size (a monster's two slots leave the rest blank),
// and the detail line keeps two lines, so nothing reflows as the cursor
// moves or gear changes hands. GridScene handles the input; the mouse is
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

  return (
    <div className="pause-overlay">
      <div className="roster-screen__scroll roster-screen__scroll--wide">
        <section className="panel roster-screen equipment-screen" aria-label="Equipment">
          <h2 className="roster-screen__title">Equipment</h2>
          <MenuExitButton kind={column === 'units' ? 'close' : 'back'} />
          <div className="equipment-layout">
            <section className={columnClass(column === 'units', 'equipment-layout__units')}>
              <h3 className="roster-screen__heading">Units</h3>
              <ScrollList
                className="action-menu__list roster-screen__list equipment-list"
                selectedIndex={view.unitIndex}
              >
                {view.units.map((unit, index) => {
                  const selected = index === view.unitIndex;
                  return (
                    <li
                      key={unit.id}
                      className={rowClass(selected, column === 'units')}
                      aria-current={selected ? 'true' : undefined}
                      {...pointerProps('units', index)}
                    >
                      <span className="roster-screen__sprite" title={unit.classLabel}>
                        <UnitSprite sprite={unit.sprite} />
                      </span>
                      <span className="roster-screen__unit">
                        <span className="roster-screen__name">{unit.name}</span>
                        <span className="roster-screen__meta">
                          {unit.classLabel} · Lv {unit.level}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ScrollList>
            </section>

            <section className={columnClass(column === 'slots', 'equipment-layout__doll')}>
              <h3 className="roster-screen__heading">{view.unitName ? `${view.unitName}'s gear` : 'Gear'}</h3>
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
                            (slot.item?.label ?? <span className="equipment-slots__empty">Empty</span>)
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
              <ul className="equipment-stats" aria-label="Numbers">
                {view.stats.map((stat) => (
                  <StatRow key={stat.id} stat={stat} />
                ))}
              </ul>
            </section>

            <section className={columnClass(column === 'gear', 'equipment-layout__gear')}>
              <h3 className="roster-screen__heading">{view.slotLabel ? `${view.slotLabel} from convoy` : 'Convoy'}</h3>
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
                      title={choice.disabled ? "Can't be worn now" : undefined}
                      {...pointerProps('gear', index)}
                    >
                      <Icon icon={choice.icon} />
                      <span className={`roster-screen__label${choice.remove ? ' equipment-gear__remove' : ''}`}>
                        {choice.label}
                      </span>
                    </li>
                  );
                })}
              </ScrollList>
            </section>
          </div>

          <ItemDetailLine
            detail={view.detail}
            hint="Pick a slot, then gear from the convoy to wear in it. What it displaces goes back to the convoy."
          />
          <KeyHint
            className="roster-screen__hint"
            entries={[
              ['←→', 'Column'],
              ['↑↓', 'Choose'],
              ['Enter', column === 'gear' ? 'Equip' : 'Open'],
              ['Esc', column === 'units' ? 'Done' : 'Back'],
            ]}
          />
        </section>
      </div>
    </div>
  );
}
