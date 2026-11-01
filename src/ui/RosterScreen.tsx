import type { MouseEvent } from 'react';
import { SPRITE_URLS } from '../assets/sprites.ts';
import { gameCommands } from '../bridge/commands.ts';
import type { RosterItemView, RosterScreenView } from '../bridge/rosterView.ts';
import type { RosterTarget } from '../game/warband/rosterScreen.ts';
import { ItemCount } from './ItemCount.tsx';
import { ItemDetailLine } from './ItemDetailLine.tsx';
import { KeyHint } from './KeyHint.tsx';
import { RosterUnitSheet } from './RosterUnitSheet.tsx';
import { ScrollList } from './ScrollList.tsx';
import { UnitSprite } from './UnitSprite.tsx';
import { useGameStore } from './useGameStore.ts';
import './RosterScreen.css';

// What the roster screen does with the mouse: hovering an entry moves
// the cursor there and clicking acts on it, exactly as the keyboard would.
export interface RosterPointer {
  hover(target: RosterTarget, index: number): void;
  select(target: RosterTarget, index: number): void;
}

// Between stages GridScene runs the screen, so the mouse is forwarded to it.
const SCENE_POINTER: RosterPointer = {
  hover: (target, index) => gameCommands.send({ type: 'hover-roster', target, index }),
  select: (target, index) => gameCommands.send({ type: 'select-roster', target, index }),
};

function rowClass(selected: boolean, focused: boolean, disabled = false) {
  const classes = ['action-menu__item', 'roster-screen__row'];
  if (selected && focused) classes.push('action-menu__item--selected');
  else if (selected) classes.push('roster-screen__row--picked');
  if (disabled) classes.push('action-menu__item--disabled');
  return classes.join(' ');
}

// An item's icon, or an empty spot of the same size for one without.
function ItemIcon({ item }: { item: RosterItemView }) {
  const url = item.icon ? SPRITE_URLS[item.icon] : undefined;
  return url ? <img className="roster-screen__icon" src={url} alt="" /> : <span className="roster-screen__icon" />;
}

// A unit's HP as its count over a small bar, so the hurt stand out down
// the list.
function HealthGauge({ health, maxHealth }: { health: number; maxHealth: number }) {
  const percent = maxHealth > 0 ? Math.min(100, (health / maxHealth) * 100) : 0;
  return (
    <span className="roster-screen__hp" title={`HP ${health}/${maxHealth}`}>
      <span className="roster-screen__hp-count">
        <span className="visually-hidden">HP </span>
        {health}/{maxHealth}
      </span>
      <span className="roster-screen__hp-bar" aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </span>
    </span>
  );
}

// Warband Mode's roster screen between stages (see
// src/game/warband/rosterScreen.ts), laid out like a tactics game's
// formation screen: the units down the left (sprite, name, level and HP;
// the sprite already shows the class, which the sheet names); beside them the picked unit's
// full status sheet (who it is, its stats, the rates it fights with, its
// skills and passives, RosterUnitSheet), and under the sheet its inventory
// and the convoy side by side. Moving down the unit list pages through
// each unit's sheet. Picking an item in the inventory opens its actions
// (Equip for weapons and armor, Store) beside it; picking one in the
// convoy gives it to the picked unit. Every box keeps its size as the
// cursor moves and items change hands. At camp GridScene handles the
// input; on the overworld (OverworldRoster) React does.
export function RosterScreen() {
  const view = useGameStore((state) => state.rosterScreen);
  if (!view) return null;
  return <RosterScreenPanel view={view} pointer={SCENE_POINTER} />;
}

export function RosterScreenPanel({ view, pointer }: { view: RosterScreenView; pointer: RosterPointer }) {
  const pointerProps = (target: RosterTarget, index: number) => ({
    onMouseEnter: () => pointer.hover(target, index),
    onClick: (event: MouseEvent) => {
      event.stopPropagation();
      pointer.select(target, index);
    },
  });
  const focus = view.actions ? 'actions' : view.column;
  const emptySlots = Math.max(0, view.slots - view.items.length);

  return (
    <div className="pause-overlay">
      <div className="roster-screen__scroll roster-screen__scroll--wide">
        <section className="panel roster-screen roster-screen--sheet" aria-label="Roster">
          <h2 className="roster-screen__title">Roster</h2>
          <div className="roster-layout">
            <section
              className={`roster-screen__column roster-layout__units${focus === 'units' ? ' roster-screen__column--focused' : ''}`}
            >
              <h3 className="roster-screen__heading">Units</h3>
              <ScrollList
                className="action-menu__list roster-screen__list roster-screen__list--units"
                selectedIndex={view.unitIndex}
              >
                {view.units.map((unit, index) => {
                  const selected = index === view.unitIndex;
                  return (
                    <li
                      key={unit.id}
                      className={rowClass(selected, focus === 'units')}
                      aria-current={selected ? 'true' : undefined}
                      {...pointerProps('units', index)}
                    >
                      <span className="roster-screen__sprite" title={unit.classLabel}>
                        <UnitSprite sprite={unit.sprite} />
                      </span>
                      <span className="roster-screen__unit">
                        <span className="roster-screen__name">{unit.name}</span>
                        <span className="roster-layout__unit-line">
                          <span className="roster-screen__meta">
                            <span className="visually-hidden">{unit.classLabel} </span>Lv {unit.level}
                          </span>
                          <HealthGauge health={unit.health} maxHealth={unit.maxHealth} />
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ScrollList>
            </section>

            <div className="roster-layout__main">
              <RosterUnitSheet unit={view.unit} />
              <div className="roster-layout__bags">
                <section
                  className={`roster-screen__column${focus === 'items' || focus === 'actions' ? ' roster-screen__column--focused' : ''}`}
                >
                  <h3 className="roster-screen__heading">{view.unitName ? `${view.unitName}'s items` : 'Items'}</h3>
                  <ul className="action-menu__list roster-screen__list roster-screen__list--items">
                    {view.items.map((item, index) => {
                      const selected = index === view.itemIndex;
                      const showActions = selected && view.actions;
                      return (
                        <li
                          key={item.key}
                          className={rowClass(selected, focus === 'items' || focus === 'actions')}
                          aria-current={selected ? 'true' : undefined}
                          {...pointerProps('items', index)}
                        >
                          <span className="roster-screen__equipped" aria-label={item.equipped ? 'Equipped' : undefined}>
                            {item.equipped ? 'E' : ''}
                          </span>
                          <ItemIcon item={item} />
                          <span className="roster-screen__label">{item.label}</span>
                          <ItemCount item={item} />
                          {showActions && (
                            <nav
                              className="panel action-menu roster-screen__actions"
                              aria-label={`${item.label} actions`}
                            >
                              <ul className="action-menu__list">
                                {view.actions!.actions.map((action, actionIndex) => {
                                  const picked = actionIndex === view.actions!.selectedIndex;
                                  const classes = ['action-menu__item'];
                                  if (picked) classes.push('action-menu__item--selected');
                                  if (action.disabled) classes.push('action-menu__item--disabled');
                                  return (
                                    <li
                                      key={action.id}
                                      className={classes.join(' ')}
                                      aria-current={picked ? 'true' : undefined}
                                      aria-disabled={action.disabled ? 'true' : undefined}
                                      {...pointerProps('actions', actionIndex)}
                                    >
                                      {action.label}
                                    </li>
                                  );
                                })}
                              </ul>
                            </nav>
                          )}
                        </li>
                      );
                    })}
                    {Array.from({ length: emptySlots }, (_, index) => (
                      <li key={`empty-${index}`} className="roster-screen__row roster-screen__row--empty">
                        —
                      </li>
                    ))}
                  </ul>
                </section>

                <section
                  className={`roster-screen__column${focus === 'convoy' ? ' roster-screen__column--focused' : ''}`}
                >
                  <h3 className="roster-screen__heading">Convoy</h3>
                  <ul className="action-menu__list roster-screen__list roster-screen__list--convoy">
                    {view.convoy.length === 0 && (
                      <li className="roster-screen__row roster-screen__row--empty">Empty</li>
                    )}
                    {view.convoy.map((item, index) => {
                      const selected = index === view.convoyIndex;
                      return (
                        <li
                          key={item.key}
                          className={rowClass(selected, focus === 'convoy', item.disabled)}
                          aria-current={selected ? 'true' : undefined}
                          aria-disabled={item.disabled ? 'true' : undefined}
                          title={item.disabled ? `${view.unitName ?? 'This unit'} has no room` : undefined}
                          {...pointerProps('convoy', index)}
                        >
                          <span className="roster-screen__equipped" />
                          <ItemIcon item={item} />
                          <span className="roster-screen__label">{item.label}</span>
                          <ItemCount item={item} />
                        </li>
                      );
                    })}
                  </ul>
                </section>
              </div>
            </div>
          </div>

          <ItemDetailLine
            detail={view.detail}
            hint="Pick a unit, then equip or store its items, or give it items from the convoy."
          />
          <KeyHint
            className="roster-screen__hint"
            entries={[
              ['←→', 'Column'],
              ['↑↓', 'Choose'],
              ['Enter', focus === 'convoy' ? 'Give' : 'Select'],
              ['Esc', focus === 'units' ? 'Done' : 'Back'],
            ]}
          />
        </section>
      </div>
    </div>
  );
}
