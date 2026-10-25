import type { MouseEvent } from 'react';
import { gameCommands } from '../bridge/commands.ts';
import type { PromotionDetailView } from '../bridge/promotionView.ts';
import { KeyHint } from './KeyHint.tsx';
import { ScrollList } from './ScrollList.tsx';
import { UnitSprite } from './UnitSprite.tsx';
import { useGameStore } from './useGameStore.ts';

// Mouse handlers for an option: hovering moves the cursor there and
// clicking promotes, exactly as the keyboard would.
function pointerProps(index: number) {
  return {
    onMouseEnter: () => gameCommands.send({ type: 'hover-promotion', index }),
    onClick: (event: MouseEvent) => {
      event.stopPropagation();
      gameCommands.send({ type: 'select-promotion', index });
    },
  };
}

// What the highlighted promotion does: the new class's art and line, the
// stats it adds, its weapons, skill, passive and gift. Every line is
// always laid out (empty ones as a dash), so moving the cursor never
// resizes the panel.
function Detail({ detail }: { detail: PromotionDetailView }) {
  const gains = detail.gains.map((gain) => `${gain.label} +${gain.value}`);
  if (detail.movement !== 0) gains.push(`MOV ${detail.movement > 0 ? '+' : ''}${detail.movement}`);
  return (
    <div className="promotion-screen__detail">
      <div className="promotion-screen__head">
        <UnitSprite sprite={detail.sprite} scale={2} animated />
        <div>
          <h3 className="promotion-screen__class">
            {detail.toClass}
            {detail.evolves && <span className="promotion-screen__evolves"> ✦ evolves!</span>}
          </h3>
          <p className="promotion-screen__who">
            {detail.name}, level {detail.level} {detail.fromClass}
          </p>
        </div>
      </div>
      <p className="promotion-screen__description">{detail.description}</p>
      <dl className="promotion-screen__facts">
        <dt>Stats</dt>
        <dd>{gains.join(', ') || '–'}</dd>
        <dt>Weapons</dt>
        <dd>{detail.weaponTypes.join(', ')}</dd>
        <dt>Skill</dt>
        <dd>{detail.skill ? `${detail.skill.label} (${detail.skill.manaCost} MP, RNG ${detail.skill.range})` : '–'}</dd>
        <dt>Passive</dt>
        <dd>
          {detail.passive.name}: {detail.passive.description}
        </dd>
        <dt>Gift</dt>
        <dd>{detail.gift ?? '–'}</dd>
      </dl>
    </div>
  );
}

// The camp's promotion screen (see src/game/warband/promotionScreen.ts):
// every promotion the warband could make on the left, what the highlighted
// one does on the right, and the Master Seals held in the window's top
// border. GridScene handles the input; the mouse is forwarded to it.
export function PromotionScreen() {
  const view = useGameStore((state) => state.promotionScreen);
  if (!view) return null;

  return (
    <div className="pause-overlay">
      <div className="roster-screen__scroll promotion-screen__scroll">
        <section className="panel roster-screen promotion-screen" aria-label="Promote">
          <h2 className="roster-screen__title">Promote</h2>
          <p className="merchant-screen__gold">
            {view.seals} {view.seals === 1 ? 'seal' : 'seals'}
          </p>
          <div className="roster-screen__columns promotion-screen__columns">
            <section className="roster-screen__column roster-screen__column--focused">
              <h3 className="roster-screen__heading">Promotions</h3>
              <ScrollList
                className="action-menu__list roster-screen__list promotion-screen__list"
                selectedIndex={view.selectedIndex}
              >
                {view.options.map((option, index) => {
                  const selected = index === view.selectedIndex;
                  const classes = ['action-menu__item', 'roster-screen__row'];
                  if (selected) classes.push('action-menu__item--selected');
                  if (option.disabled) classes.push('action-menu__item--disabled');
                  return (
                    <li
                      key={option.key}
                      className={classes.join(' ')}
                      aria-current={selected ? 'true' : undefined}
                      aria-disabled={option.disabled ? 'true' : undefined}
                      title={option.disabled ? 'Needs a Master Seal' : undefined}
                      {...pointerProps(index)}
                    >
                      <span className="roster-screen__label">{option.label}</span>
                    </li>
                  );
                })}
              </ScrollList>
            </section>
            <section className="roster-screen__column">
              <h3 className="roster-screen__heading">Becomes</h3>
              {view.detail && <Detail detail={view.detail} />}
            </section>
          </div>
          <p className="roster-screen__detail">
            <span className="roster-screen__detail-hint">
              {view.seals > 0
                ? 'Spends a Master Seal. Level, items and boons carry over.'
                : 'Needs a Master Seal: buy one from the merchant, or win one as a reward.'}
            </span>
          </p>
          <KeyHint
            className="roster-screen__hint"
            entries={[
              ['↑↓', 'Choose'],
              ['Enter', 'Promote'],
              ['Esc', 'Done'],
            ]}
          />
        </section>
      </div>
    </div>
  );
}
