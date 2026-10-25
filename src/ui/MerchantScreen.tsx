import type { MouseEvent } from 'react';
import { SPRITE_URLS } from '../assets/sprites.ts';
import { gameCommands } from '../bridge/commands.ts';
import type { MerchantItemView, MerchantScreenView } from '../bridge/merchantView.ts';
import type { MerchantColumn, MerchantTarget } from '../game/warband/merchantScreen.ts';
import { GlyphIcon } from './GlyphIcon.tsx';
import { ItemCount } from './ItemCount.tsx';
import { ItemDetailLine } from './ItemDetailLine.tsx';
import { KeyHint } from './KeyHint.tsx';
import { ScrollList } from './ScrollList.tsx';
import { useGameStore } from './useGameStore.ts';

// Mouse handlers for an entry of the merchant screen: hovering moves the
// cursor there and clicking buys or sells it, exactly as the keyboard would.
function pointerProps(column: MerchantTarget, index: number) {
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
// breaks, nothing for armor) or count, and price behind a coin.
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
      <ItemCount item={item} />
      <span className="merchant-screen__price" title={`${item.price} gold`}>
        <GlyphIcon kind="gold" />
        <span className="visually-hidden">Price </span>
        {item.price}
      </span>
    </li>
  );
}

// Who a bought item is for, asked over the screen once a stock item is
// picked: each unit (with whether it can use the item, or has no room),
// then the convoy.
function RecipientMenu({
  recipients,
  item,
}: {
  recipients: NonNullable<MerchantScreenView['recipients']>;
  item: string;
}) {
  return (
    <div className="merchant-screen__recipients-layer">
      <nav className="panel action-menu merchant-screen__recipients" aria-label={`Buy ${item} for`}>
        <h3 className="merchant-screen__recipients-title">Buy {item} for</h3>
        <ul className="action-menu__list">
          {recipients.entries.map((entry, index) => {
            const selected = index === recipients.selectedIndex;
            const classes = ['action-menu__item', 'merchant-screen__recipient'];
            if (selected) classes.push('action-menu__item--selected');
            if (entry.disabled) classes.push('action-menu__item--disabled');
            return (
              <li
                key={entry.key}
                className={classes.join(' ')}
                aria-current={selected ? 'true' : undefined}
                aria-disabled={entry.disabled ? 'true' : undefined}
                {...pointerProps('recipients', index)}
              >
                <span className="merchant-screen__recipient-name">{entry.label}</span>
                <span className="merchant-screen__recipient-note">{entry.note}</span>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

// The camp's merchant (see src/game/warband/merchantScreen.ts): its stock
// with prices beside the warband's convoy with what each item sells for.
// Buying asks who the item is for (RecipientMenu): a unit gets it
// straight away, or it goes to the convoy for the roster screen. The
// gold sits in the window's top border, so it changing never moves
// anything. Both columns keep their size as items come and go, scrolling
// to follow the cursor when they hold more than fits. GridScene
// handles the input; the mouse is forwarded to it.
export function MerchantScreen() {
  const view = useGameStore((state) => state.merchantScreen);
  if (!view) return null;

  return (
    <div className="pause-overlay">
      <div className="roster-screen__scroll merchant-screen__scroll">
        <section className="panel roster-screen merchant-screen" aria-label="Merchant">
          <h2 className="roster-screen__title">Merchant</h2>
          <p className="merchant-screen__gold" title={`${view.gold} gold`}>
            <GlyphIcon kind="gold" />
            {view.gold}
            <span className="visually-hidden"> gold</span>
          </p>
          <div className="roster-screen__columns merchant-screen__columns">
            <section
              className={`roster-screen__column${view.column === 'stock' ? ' roster-screen__column--focused' : ''}`}
            >
              <h3 className="roster-screen__heading">Buy</h3>
              <ScrollList
                className="action-menu__list roster-screen__list merchant-screen__list"
                selectedIndex={view.stockIndex}
              >
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
              </ScrollList>
            </section>

            <section
              className={`roster-screen__column${view.column === 'convoy' ? ' roster-screen__column--focused' : ''}`}
            >
              <h3 className="roster-screen__heading">Sell from convoy</h3>
              <ScrollList
                className="action-menu__list roster-screen__list merchant-screen__list"
                selectedIndex={view.convoyIndex}
              >
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
              </ScrollList>
            </section>
          </div>

          <ItemDetailLine
            detail={view.detail}
            hint="Buy for a unit or the convoy. Store a unit's items in the convoy to sell them."
          />
          {view.recipients && (
            <RecipientMenu recipients={view.recipients} item={view.stock[view.stockIndex]?.label ?? ''} />
          )}
          <KeyHint
            className="roster-screen__hint"
            entries={[
              ['←→', 'Column'],
              ['↑↓', 'Choose'],
              ['Enter', view.recipients || view.column === 'stock' ? 'Buy' : 'Sell'],
              ['Esc', view.recipients ? 'Back' : 'Done'],
            ]}
          />
        </section>
      </div>
    </div>
  );
}
