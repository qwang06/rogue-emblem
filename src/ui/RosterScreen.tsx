import type { MouseEvent } from 'react';
import { SPRITE_URLS } from '../assets/sprites.ts';
import { gameCommands } from '../bridge/commands.ts';
import type { RosterItemView } from '../bridge/rosterView.ts';
import type { RosterTarget } from '../game/warband/rosterScreen.ts';
import { KeyHint } from './KeyHint.tsx';
import { UnitSprite } from './UnitSprite.tsx';
import { useGameStore } from './useGameStore.ts';

// Mouse handlers for an entry of the roster screen: hovering moves the
// cursor there and clicking acts on it, exactly as the keyboard would.
function pointerProps(target: RosterTarget, index: number) {
  return {
    onMouseEnter: () => gameCommands.send({ type: 'hover-roster', target, index }),
    onClick: (event: MouseEvent) => {
      event.stopPropagation();
      gameCommands.send({ type: 'select-roster', target, index });
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

// An item's icon, or an empty spot of the same size for one without.
function ItemIcon({ item }: { item: RosterItemView }) {
  const url = item.icon ? SPRITE_URLS[item.icon] : undefined;
  return url ? <img className="roster-screen__icon" src={url} alt="" /> : <span className="roster-screen__icon" />;
}

// How many are left (a weapon's uses), ∞ for one that never breaks, and
// nothing for armor, which doesn't wear out.
function ItemCount({ item }: { item: RosterItemView }) {
  const count = item.quantity ?? (item.kind === 'armor' ? '' : '∞');
  return <span className="roster-screen__count">{count}</span>;
}

// Warband Mode's roster screen between stages (see
// src/game/warband/rosterScreen.ts): the units, the picked unit's
// inventory and the convoy side by side, items with their icons. Picking
// an item in the inventory opens its actions (Equip for weapons and armor,
// Store) beside it; picking one in the convoy
// gives it to the picked unit. Every column keeps its size as the cursor
// moves and items change hands. GridScene handles the input; the mouse is
// forwarded to it.
export function RosterScreen() {
  const view = useGameStore((state) => state.rosterScreen);
  if (!view) return null;
  const focus = view.actions ? 'actions' : view.column;
  const emptySlots = Math.max(0, view.slots - view.items.length);

  return (
    <div className="pause-overlay">
      <div className="roster-screen__scroll">
        <section className="panel roster-screen" aria-label="Roster">
          <h2 className="roster-screen__title">Roster</h2>
          <div className="roster-screen__columns">
            <section className={`roster-screen__column${focus === 'units' ? ' roster-screen__column--focused' : ''}`}>
              <h3 className="roster-screen__heading">Units</h3>
              <ul className="action-menu__list roster-screen__list roster-screen__list--units">
                {view.units.map((unit, index) => {
                  const selected = index === view.unitIndex;
                  return (
                    <li
                      key={unit.id}
                      className={rowClass(selected, focus === 'units')}
                      aria-current={selected ? 'true' : undefined}
                      {...pointerProps('units', index)}
                    >
                      <UnitSprite sprite={unit.sprite} />
                      <span className="roster-screen__unit">
                        <span className="roster-screen__name">{unit.name}</span>
                        <span className="roster-screen__meta">
                          {unit.classLabel} · Lv {unit.level} · HP {unit.health}/{unit.maxHealth}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

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
                        <nav className="panel action-menu roster-screen__actions" aria-label={`${item.label} actions`}>
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

            <section className={`roster-screen__column${focus === 'convoy' ? ' roster-screen__column--focused' : ''}`}>
              <h3 className="roster-screen__heading">Convoy</h3>
              <ul className="action-menu__list roster-screen__list roster-screen__list--convoy">
                {view.convoy.length === 0 && <li className="roster-screen__row roster-screen__row--empty">Empty</li>}
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

          <p className="roster-screen__detail">
            {view.detail ? (
              <>
                <span className="roster-screen__detail-label">{view.detail.label}</span> {view.detail.description}
              </>
            ) : (
              <span className="roster-screen__detail-hint">
                Pick a unit, then equip or store its items, or give it items from the convoy.
              </span>
            )}
          </p>
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
