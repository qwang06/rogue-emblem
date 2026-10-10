import type { MouseEvent } from 'react';
import { SPRITE_URLS } from '../assets/sprites.ts';
import { gameCommands } from '../bridge/commands.ts';
import type { MerchantItemView } from '../bridge/merchantView.ts';
import type { MerchantColumn } from '../game/warband/merchantScreen.ts';
import { KeyHint } from './KeyHint.tsx';
import { useGameStore } from './useGameStore.ts';

// Mouse handlers for an entry of the merchant screen: hovering moves the
// cursor there and clicking buys or sells it, exactly as the keyboard would.
function pointerProps(column: MerchantColumn, index: number) {
  return {
    onMouseEnter: () => gameCommands.send({ type: 'hover-merchant', column, index }),
    onClick: (event: MouseEvent) => {
      event.stopPropagation();
      gameCommands.send({ type: 'select-merchant', column, index });
    },
  };
}

function rowClass(selected: boolean, focused: boolean, disabled: boolean) {
  const classes = ['action-menu__item', 'roster-screen__row'];
  if (selected && focused) classes.push('action-menu__item--selected');
  else if (selected) classes.push('roster-screen__row--picked');
  if (disabled) classes.push('action-menu__item--disabled');
  return classes.join(' ');
}

// One stock or convoy row: icon, name, uses (∞ for a weapon that never
// breaks, nothing for armor) and price.
function ItemRow({
  item,
  column,
  index,
  selected,
  focused,
  disabledTitle,
}: {
  item: MerchantItemView;
  column: MerchantColumn;
  index: number;
  selected: boolean;
  focused: boolean;
  disabledTitle: string;
}) {
  const url = item.icon ? SPRITE_URLS[item.icon] : undefined;
  const count = item.quantity ?? (item.kind === 'armor' ? '' : '∞');
  return (
    <li
      className={rowClass(selected, focused, item.disabled)}
      aria-current={selected ? 'true' : undefined}
      aria-disabled={item.disabled ? 'true' : undefined}
      title={item.disabled ? disabledTitle : undefined}
      {...pointerProps(column, index)}
    >
      {url ? <img className="roster-screen__icon" src={url} alt="" /> : <span className="roster-screen__icon" />}
      <span className="roster-screen__label">{item.label}</span>
      <span className="roster-screen__count">{count}</span>
      <span className="merchant-screen__price">{item.price} G</span>
    </li>
  );
}

// The camp's merchant (see src/game/warband/merchantScreen.ts): its stock
// with prices beside the warband's convoy with what each item sells for.
// Bought items go to the convoy; the roster screen hands them out. The
// gold sits in the window's top border, so it changing never moves
// anything. Both columns keep their size as items come and go. GridScene
// handles the input; the mouse is forwarded to it.
export function MerchantScreen() {
  const view = useGameStore((state) => state.merchantScreen);
  if (!view) return null;

  return (
    <div className="pause-overlay">
      <div className="roster-screen__scroll merchant-screen__scroll">
        <section className="panel roster-screen merchant-screen" aria-label="Merchant">
          <h2 className="roster-screen__title">Merchant</h2>
          <p className="merchant-screen__gold">{view.gold} gold</p>
          <div className="roster-screen__columns merchant-screen__columns">
            <section
              className={`roster-screen__column${view.column === 'stock' ? ' roster-screen__column--focused' : ''}`}
            >
              <h3 className="roster-screen__heading">Buy</h3>
              <ul className="action-menu__list roster-screen__list merchant-screen__list">
                {view.stock.map((item, index) => (
                  <ItemRow
                    key={item.key}
                    item={item}
                    column="stock"
                    index={index}
                    selected={index === view.stockIndex}
                    focused={view.column === 'stock'}
                    disabledTitle="Not enough gold"
                  />
                ))}
              </ul>
            </section>

            <section
              className={`roster-screen__column${view.column === 'convoy' ? ' roster-screen__column--focused' : ''}`}
            >
              <h3 className="roster-screen__heading">Sell from convoy</h3>
              <ul className="action-menu__list roster-screen__list merchant-screen__list roster-screen__list--convoy">
                {view.convoy.length === 0 && <li className="roster-screen__row roster-screen__row--empty">Empty</li>}
                {view.convoy.map((item, index) => (
                  <ItemRow
                    key={item.key}
                    item={item}
                    column="convoy"
                    index={index}
                    selected={index === view.convoyIndex}
                    focused={view.column === 'convoy'}
                    disabledTitle="Can't be sold"
                  />
                ))}
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
                Bought items go to the convoy. Store a unit's items in the convoy to sell them.
              </span>
            )}
          </p>
          <KeyHint
            className="roster-screen__hint"
            entries={[
              ['←→', 'Column'],
              ['↑↓', 'Choose'],
              ['Enter', view.column === 'stock' ? 'Buy' : 'Sell'],
              ['Esc', 'Done'],
            ]}
          />
        </section>
      </div>
    </div>
  );
}
