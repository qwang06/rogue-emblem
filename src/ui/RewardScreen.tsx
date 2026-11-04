import type { CSSProperties } from 'react';
import { useGameStore } from './useGameStore.ts';
import { GlyphIcon } from './GlyphIcon.tsx';
import { KeyHint } from './KeyHint.tsx';
import { menuItemPointerProps } from './menuPointer.ts';
import { RewardTeam } from './RewardTeam.tsx';
import { StatLabel } from './StatLabel.tsx';
import { UnitSprite } from './UnitSprite.tsx';
import { SPRITE_URLS } from '../assets/sprites.ts';
import { REWARD_ICON_URLS } from '../assets/rewardIcons.ts';
import { getRelicIconUrl } from '../assets/fantasyIcons.ts';
import { KEYSTONE_ICON_URLS } from '../assets/keystoneIcons.ts';
import type { RewardAction } from '../bridge/views.ts';
import type { RewardFact } from '../game/warband/rewardFacts.ts';

// Shown after a won Warband Mode stage's result, in one window: what the
// clear paid on its top line, the warband as a strip of small tiles, the
// rewards to pick one of side by side in a single row like Slay the
// Spire's card pick (as many columns as there are offers, 3 to 5), and a
// footer with the key hints and the Skip and Reroll buttons. The purse
// hangs off the window's bottom frame as a gold plate, as on the camp menu.
// GridScene handles the input (arrows move the pick through the cards and
// then the buttons, confirm takes it); the mouse is forwarded to it. Each
// card shows its picture small beside its name, then its description, then
// what it does in numbers (RewardAction.facts) pinned to the card's foot.
// The same screen shows a surviving guest's recruitment and a Recruit
// reward's draft of recruits to pick one from; a recruit's card shows its
// stat line in the numbers' place. A level up's boon pick (`boonPick`)
// shares its menu but has a screen of its own (BoonPickScreen). A lone
// card (a guest's recruitment) lies across the window's width, its
// picture, text and stats side by side.
export function RewardScreen() {
  const menu = useGameStore((state) => state.rewardMenu);
  const stageClear = useGameStore((state) => state.stageClear);
  const recruitmentStage = useGameStore((state) => state.recruitmentStage);
  const recruitDraft = useGameStore((state) => state.recruitDraft);
  const team = useGameStore((state) => state.rewardTeam);
  const boonPick = useGameStore((state) => state.boonPick);
  if (!menu || boonPick) return null;
  const title =
    recruitmentStage && recruitDraft
      ? 'Choose a Recruit'
      : recruitmentStage
        ? `Guest Survived Stage ${recruitmentStage}`
        : stageClear?.blessing
          ? 'A Blessing'
          : 'Spoils of Battle';
  const entries = menu.actions.map((action, index) => ({ action, index, selected: index === menu.selectedIndex }));
  const isButton = (action: RewardAction) =>
    action.kind === 'skip' || action.kind === 'reroll' || action.kind === 'decline';
  const cards = entries.filter(({ action }) => !isButton(action));
  const buttons = entries.filter(({ action }) => isButton(action));
  const choicesStyle = { '--reward-cards': Math.max(1, cards.length) } as CSSProperties;

  return (
    <div className="pause-overlay">
      <div className="reward-screen__scroll">
        <section
          className={`panel reward-screen${stageClear ? ' reward-screen--purse' : ''}`}
          aria-label={recruitmentStage ? 'Choose a recruit' : 'Choose a reward'}
        >
          <h2 className="reward-screen__title">{title}</h2>
          <p className="reward-screen__summary">
            {recruitmentStage && recruitDraft ? (
              'Pick one to join the warband, quirk and all.'
            ) : stageClear?.blessing ? (
              `${stageClear.blessing} offers its blessing.`
            ) : stageClear ? (
              <>
                Stage {stageClear.stage} cleared:{' '}
                <Gold amount={stageClear.gold} sign="+" className="reward-screen__coin" />
                {stageClear.flawless && <span className="reward-screen__flawless"> Flawless!</span>}
              </>
            ) : (
              'The guest asks to join the warband.'
            )}
          </p>
          {team && team.length > 0 && (
            <RewardTeam team={team} preview={menu.actions[menu.selectedIndex]?.healthAfter ?? null} />
          )}
          <ul
            className={`reward-screen__choices${cards.length === 1 ? ' reward-screen__choices--single' : ''}`}
            style={choicesStyle}
          >
            {cards.map(({ action: reward, index, selected }) => (
              <li
                key={reward.id}
                className={`reward-card reward-card--${reward.kind}${selected ? ' reward-card--selected' : ''}`}
                aria-current={selected ? 'true' : undefined}
                {...menuItemPointerProps('rewardMenu', index)}
              >
                <div className="reward-card__head">
                  <RewardPicture reward={reward} selected={selected} />
                  <div className="reward-card__name">
                    <span className="reward-card__kind">{reward.tag ?? reward.kind}</span>
                    <h3 className="reward-card__label">{reward.label}</h3>
                  </div>
                </div>
                <p className="reward-card__description">{reward.description}</p>
                {reward.stats ? (
                  <dl className="reward-card__numbers reward-card__numbers--stats">
                    {reward.stats.map((stat) => (
                      <div key={stat.label} className="reward-card__number">
                        <dt>
                          <StatLabel label={stat.label} />
                        </dt>
                        <dd>{stat.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  reward.facts && <RewardFacts facts={reward.facts} />
                )}
              </li>
            ))}
          </ul>
          <footer className="reward-screen__foot">
            <KeyHint
              className="reward-screen__hint"
              entries={[
                ['←→', 'Choose'],
                ['Enter', recruitmentStage ? 'Recruit' : 'Take'],
              ]}
            />
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
                  {action.gold && (
                    <Gold
                      amount={action.gold.amount}
                      sign={action.gold.gain ? '+' : undefined}
                      className="reward-button__gold"
                    />
                  )}
                </button>
              ))}
            </div>
          </footer>
          {stageClear && (
            <p className="reward-screen__purse" title={`${stageClear.totalGold} gold`}>
              <GlyphIcon kind="gold" />
              {stageClear.totalGold}
              <span className="visually-hidden"> gold in the purse</span>
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

// A sum of gold as the rest of the UI shows it: the coin, then the number.
function Gold({ amount, sign, className }: { amount: string | number; sign?: '+'; className?: string }) {
  return (
    <span className={className ? `reward-gold ${className}` : 'reward-gold'}>
      <GlyphIcon kind="gold" />
      {sign}
      {amount}
      <span className="visually-hidden"> gold</span>
    </span>
  );
}

// A card's numbers block: each fact's label and value, "value ▸ after" when
// the reward changes it, a sum of gold with the coin.
function RewardFacts({ facts }: { facts: readonly RewardFact[] }) {
  const show = (fact: RewardFact, value: string | number) => (fact.gold ? <Gold amount={value} /> : value);
  return (
    <dl className="reward-card__numbers">
      {facts.map((fact) => (
        <div key={fact.label} className={`reward-card__number${fact.wide ? ' reward-card__number--wide' : ''}`}>
          <dt>{fact.label}</dt>
          <dd>
            {show(fact, fact.value)}
            {fact.after !== undefined && (
              <span className="reward-card__after">
                {' ▸ '}
                {show(fact, fact.after)}
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// A card's picture, one tile big beside its name: a recruit's unit
// (idling while picked), the item a Supplies, Arms or Seal reward gives,
// the relic a Relic reward gives, the keystone a Keystone reward gives,
// else the reward kind's icon.
function RewardPicture({ reward, selected }: { reward: RewardAction; selected: boolean }) {
  if (reward.sprite) {
    return (
      <span className="reward-card__sprite" aria-hidden="true">
        <UnitSprite sprite={reward.sprite} animated={selected} />
      </span>
    );
  }
  const url = reward.itemIcon
    ? SPRITE_URLS[reward.itemIcon]
    : ((reward.relicId && getRelicIconUrl(reward.relicId)) ??
      (reward.keystoneId && KEYSTONE_ICON_URLS[reward.keystoneId]) ??
      REWARD_ICON_URLS[reward.kind]);
  return (
    <span className="reward-card__sprite" aria-hidden="true">
      {url && <img className="reward-card__icon" src={url} alt="" width={32} height={32} />}
    </span>
  );
}
