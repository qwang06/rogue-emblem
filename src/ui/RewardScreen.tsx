import { useGameStore } from './useGameStore.ts';
import { KeyHint } from './KeyHint.tsx';
import { menuItemPointerProps } from './menuPointer.ts';

// Shown after a won Warband Mode stage's result: what the clear paid, and
// the rewards to pick one of, side by side like Slay the Spire's card
// pick, with Skip and Reroll buttons under the cards. GridScene handles
// the input (arrows move the pick through the cards and then the buttons,
// confirm takes it); the mouse is forwarded to it.
export function RewardScreen() {
  const menu = useGameStore((state) => state.rewardMenu);
  const stageClear = useGameStore((state) => state.stageClear);
  if (!menu) return null;
  const entries = menu.actions.map((action, index) => ({ action, index, selected: index === menu.selectedIndex }));
  const cards = entries.filter(({ action }) => action.kind !== 'skip' && action.kind !== 'reroll');
  const buttons = entries.filter(({ action }) => action.kind === 'skip' || action.kind === 'reroll');

  return (
    <div className="pause-overlay">
      <section className="reward-screen" aria-label="Choose a reward">
        <header className="panel reward-screen__header">
          <h2 className="reward-screen__title">Spoils of Battle</h2>
          {stageClear && (
            <p className="reward-screen__gold">
              Stage {stageClear.stage} cleared: <span className="reward-screen__coin">+{stageClear.gold} gold</span>
              {stageClear.flawless && <span className="reward-screen__flawless"> Flawless!</span>}
              <span className="reward-screen__total"> · {stageClear.totalGold} gold in the purse</span>
            </p>
          )}
        </header>
        <ul className="reward-screen__choices">
          {cards.map(({ action: reward, index, selected }) => {
            return (
              <li
                key={reward.id}
                className={`panel reward-card reward-card--${reward.kind}${selected ? ' reward-card--selected' : ''}`}
                aria-current={selected ? 'true' : undefined}
                {...menuItemPointerProps('rewardMenu', index)}
              >
                <span className="reward-card__kind">{reward.kind}</span>
                <h3 className="reward-card__label">{reward.label}</h3>
                <p className="reward-card__description">{reward.description}</p>
                {reward.stats && (
                  <dl className="reward-card__stats">
                    {reward.stats.map((stat) => (
                      <div key={stat.label} className="reward-card__stat">
                        <dt>{stat.label}</dt>
                        <dd>{stat.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </li>
            );
          })}
        </ul>
        <div className="reward-screen__buttons">
          {buttons.map(({ action, index, selected }) => (
            <button
              key={action.id}
              type="button"
              className={`panel reward-button${selected ? ' reward-button--selected' : ''}`}
              aria-current={selected ? 'true' : undefined}
              aria-disabled={action.disabled ? 'true' : undefined}
              title={action.description}
              tabIndex={-1}
              {...menuItemPointerProps('rewardMenu', index)}
            >
              {action.label}
            </button>
          ))}
        </div>
        <KeyHint
          className="reward-screen__hint"
          entries={[
            ['←→', 'Choose'],
            ['Enter', 'Take reward'],
          ]}
        />
      </section>
    </div>
  );
}
