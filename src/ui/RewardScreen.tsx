import type { CSSProperties } from 'react';
import { gameCommands } from '../bridge/commands.ts';
import { useGameStore } from './useGameStore.ts';
import { GlyphIcon } from './GlyphIcon.tsx';
import { KeyHint, type KeyHintEntry } from './KeyHint.tsx';
import { menuItemPointerProps } from './menuPointer.ts';
import { StatLabel } from './StatLabel.tsx';
import { UnitSprite } from './UnitSprite.tsx';
import { SPRITE_URLS } from '../assets/sprites.ts';
import { REWARD_ICON_URLS } from '../assets/rewardIcons.ts';
import { getRelicIconUrl } from '../assets/fantasyIcons.ts';
import { KEYSTONE_ICON_URLS } from '../assets/keystoneIcons.ts';
import type { RewardAction, StageClearView, TeamUnitView } from '../bridge/views.ts';
import type { Menu } from '../game/actionMenu.ts';
import type { RewardFact } from '../game/warband/rewardFacts.ts';
import './RewardScreen.css';

// Shown after a won Warband Mode stage's result, as one screen over the
// stage: a strip with the phase word, the stage, its site and the purse
// (with what the clear added); the battle's tally in a row of tiles
// (outcome, turns, kills, HP lost, losses, gold); the rewards to pick one
// of as a row of plates like Slay the Spire's card pick (as many as there
// are offers, 3 to 5), each with its digit, picture, serif name, kind,
// description and numbers (RewardAction.facts, or a recruit's stat
// line); the warband as a row of tiles (sprite, name, level with the
// clear's level ups marked, HP bar with a healing reward's preview, XP
// track); and a bar with the keys, the Skip / Reroll / Banish buttons
// and the Take button. GridScene handles the input (arrows move the pick
// through the cards and then the buttons, a digit picks a card, confirm
// takes it); the mouse is forwarded to it. The same screen shows a
// surviving guest's recruitment and a Recruit reward's draft of recruits
// to pick one from. A level up's boon pick (`boonPick`) shares its menu
// but has a screen of its own (BoonPickScreen). Every plate keeps its
// size and the selected one only changes colors, so moving the pick
// never reflows anything.
export function RewardScreen() {
  const menu = useGameStore((state) => state.rewardMenu);
  const stageClear = useGameStore((state) => state.stageClear);
  const recruitmentStage = useGameStore((state) => state.recruitmentStage);
  const recruitDraft = useGameStore((state) => state.recruitDraft);
  const team = useGameStore((state) => state.rewardTeam);
  const boonPick = useGameStore((state) => state.boonPick);
  if (!menu || boonPick) return null;
  return (
    <RewardScreenPanel
      menu={menu}
      stageClear={stageClear}
      recruitmentStage={recruitmentStage}
      recruitDraft={recruitDraft}
      team={team ?? []}
    />
  );
}

const isButton = (action: RewardAction) =>
  action.kind === 'skip' || action.kind === 'reroll' || action.kind === 'decline' || action.kind === 'banish';

function RewardScreenPanel({
  menu,
  stageClear,
  recruitmentStage,
  recruitDraft,
  team,
}: {
  menu: Menu<RewardAction>;
  stageClear: StageClearView | null;
  recruitmentStage: number | null;
  recruitDraft: boolean;
  team: readonly TeamUnitView[];
}) {
  const recruiting = recruitmentStage !== null;
  const blessing = stageClear?.blessing ?? null;
  const entries = menu.actions.map((action, index) => ({ action, index, selected: index === menu.selectedIndex }));
  const cards = entries.filter(({ action }) => !isButton(action));
  const buttons = entries.filter(({ action }) => isButton(action));
  const selected = menu.actions[menu.selectedIndex] ?? null;
  const selectedIsCard = selected !== null && !isButton(selected);
  const phase = recruiting ? 'Recruit' : blessing ? 'Blessing' : 'Spoils';
  const stage = stageClear?.stage ?? recruitmentStage;
  const heading = recruiting
    ? recruitDraft
      ? 'Choose a recruit'
      : 'The guest asks to join'
    : blessing
      ? `${blessing} offers its blessing`
      : 'Pick one';
  const headingNote = recruiting
    ? recruitDraft
      ? 'quirk and all · the others move on'
      : 'or send them on their way'
    : cards.length > 1
      ? `the other ${cards.length === 2 ? 'one is' : `${cards.length - 1} are`} lost`
      : '';
  const takeLabel = !selected
    ? 'Take'
    : isButton(selected)
      ? selected.label
      : recruiting
        ? `Recruit ${selected.label}`
        : `Take ${selected.label}`;
  const hints: readonly KeyHintEntry[] = [
    [cards.length > 1 ? `1–${Math.min(9, cards.length)}` : '1', 'Choose'],
    ['←→', 'Browse'],
    ['Enter', recruiting ? 'Recruit' : 'Take'],
  ];

  return (
    <div className="reward-screen" role="dialog" aria-label={recruiting ? 'Choose a recruit' : 'Choose a reward'}>
      <header className="reward-screen__strip">
        <span className="reward-screen__phase">{phase}</span>
        <span className="reward-screen__vrule" aria-hidden="true" />
        <p className="reward-screen__where">
          {stage !== null && stage !== undefined && `Stage ${stage}`}
          {stageClear?.site && (
            <>
              {' · '}
              <span className="reward-screen__site">{stageClear.site.name}</span>
              {stageClear.site.region && ` · ${stageClear.site.region}`}
            </>
          )}
        </p>
        {stageClear && (
          <p className="reward-screen__purse" title={`${stageClear.totalGold} gold in the purse`}>
            <GlyphIcon kind="gold" />
            {stageClear.totalGold}
            {stageClear.gold > 0 && <span className="reward-screen__purse-gain"> +{stageClear.gold}</span>}
            <span className="visually-hidden"> gold</span>
          </p>
        )}
      </header>

      <div className="reward-screen__page">
        {stageClear && !blessing && !recruiting && <Tally clear={stageClear} />}

        <h3 className="reward-screen__heading">
          <span>{heading}</span>
          <span className="reward-screen__heading-note">{headingNote}</span>
        </h3>
        <ul
          className={`reward-screen__offers${cards.length === 1 ? ' reward-screen__offers--single' : ''}`}
          style={{ '--reward-cards': Math.max(1, cards.length) } as CSSProperties}
        >
          {cards.map(({ action: reward, index, selected }, place) => (
            <li
              key={reward.id}
              className={`reward-plate reward-plate--${reward.kind}${selected ? ' reward-plate--selected' : ''}`}
              aria-current={selected ? 'true' : undefined}
              {...menuItemPointerProps('rewardMenu', index)}
            >
              <span className="reward-plate__chosen" aria-hidden="true">
                Chosen
              </span>
              {place < 9 && <kbd className="reward-plate__key">{place + 1}</kbd>}
              <div className="reward-plate__top">
                <RewardPicture reward={reward} selected={selected} />
                <div className="reward-plate__lines">
                  <h4 className="reward-plate__name">{reward.label}</h4>
                  <span className="reward-plate__kind">{reward.tag ?? reward.kind}</span>
                </div>
              </div>
              <p className="reward-plate__description">{reward.description}</p>
              {reward.stats ? (
                <dl className="reward-plate__stats">
                  {reward.stats.map((stat) => (
                    <div key={stat.label} className="reward-plate__stat">
                      <dt>
                        <StatLabel label={stat.label} />
                      </dt>
                      <dd>{stat.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <RewardFacts facts={reward.facts ?? []} />
              )}
            </li>
          ))}
        </ul>

        {team.length > 0 && (
          <>
            <h3 className="reward-screen__heading reward-screen__heading--team">
              <span>Warband</span>
              <span className="reward-screen__heading-note">{describeLevelUps(stageClear)}</span>
            </h3>
            <ul className="reward-screen__team" aria-label="Warband">
              {team.map((unit, index) => (
                <TeamTile
                  key={unit.id}
                  unit={unit}
                  after={selected?.healthAfter?.[index] ?? null}
                  leveled={stageClear?.levelUps.some((levelUp) => levelUp.name === unit.name) ?? false}
                />
              ))}
            </ul>
          </>
        )}
      </div>

      <footer className="reward-screen__bar">
        <KeyHint className="reward-screen__hints" entries={hints} />
        <p className="reward-screen__line">{selected?.description ?? ''}</p>
        {buttons.map(({ action, index, selected }) => (
          <button
            key={action.id}
            type="button"
            className={`battle-bar__button reward-screen__button${selected ? ' reward-screen__button--selected' : ''}`}
            aria-current={selected ? 'true' : undefined}
            disabled={action.disabled}
            title={action.description}
            tabIndex={-1}
            {...menuItemPointerProps('rewardMenu', index)}
          >
            {action.label}
            {action.gold && (
              <span className="reward-screen__button-gold">
                <GlyphIcon kind="gold" />
                {action.gold.gain ? '+' : ''}
                {action.gold.amount}
              </span>
            )}
          </button>
        ))}
        <button
          type="button"
          className="battle-bar__button battle-bar__button--end reward-screen__take"
          disabled={!selected || selected.disabled}
          onClick={(event) => {
            event.stopPropagation();
            gameCommands.send({ type: 'select-menu', menu: 'rewardMenu', index: menu.selectedIndex });
          }}
        >
          {selectedIsCard ? takeLabel : (selected?.label ?? 'Take')}
        </button>
      </footer>
    </div>
  );
}

// The battle's numbers in a row of tiles: the outcome lit, then the turns
// against the limit, kills, HP lost, losses and the gold paid. Without the
// battle (the screen reopened for a saved run) the numbers show a dash.
function Tally({ clear }: { clear: StageClearView }) {
  const tally = clear.tally;
  const dash = '—';
  return (
    <ul className="reward-screen__tally">
      <li className="reward-screen__tile reward-screen__tile--outcome">
        <span className="reward-screen__tile-label">Outcome</span>
        <b>Victory</b>
      </li>
      <li className="reward-screen__tile">
        <span className="reward-screen__tile-label">Turns</span>
        <b>
          {tally ? tally.turns : dash}
          {tally?.turnLimit !== null && tally?.turnLimit !== undefined && <small>/{tally.turnLimit}</small>}
        </b>
      </li>
      <li className="reward-screen__tile">
        <span className="reward-screen__tile-label">Kills</span>
        <b>{tally ? tally.kills : dash}</b>
      </li>
      <li className="reward-screen__tile">
        <span className="reward-screen__tile-label">HP lost</span>
        <b>{tally ? tally.hpLost : dash}</b>
      </li>
      <li className={`reward-screen__tile${tally && tally.losses > 0 ? ' reward-screen__tile--bad' : ''}`}>
        <span className="reward-screen__tile-label">Losses</span>
        <b>{tally ? tally.losses : dash}</b>
      </li>
      <li className="reward-screen__tile reward-screen__tile--gold">
        <span className="reward-screen__tile-label">Gold{clear.flawless && ' · flawless'}</span>
        <b>
          <GlyphIcon kind="gold" />+{clear.gold}
        </b>
      </li>
    </ul>
  );
}

function describeLevelUps(clear: StageClearView | null): string {
  const count = clear?.levelUps.length ?? 0;
  if (count === 0) return 'as it stands';
  if (count === 1) return `${clear!.levelUps[0].name} levelled up`;
  return `${count} level ups`;
}

// A unit's tile on the warband row: sprite, serif name, level (marked
// when the clear raised it), the HP bar (blinking what a healing reward
// would add) and the XP track under it.
function TeamTile({
  unit,
  after,
  leveled,
}: {
  unit: TeamUnitView;
  after: { health: number; maxHealth: number } | null;
  leveled: boolean;
}) {
  const max = after?.maxHealth ?? unit.maxHealth;
  const kept = max > 0 ? (unit.health / max) * 100 : 0;
  const gained = after && max > 0 ? (Math.max(0, after.health - unit.health) / max) * 100 : 0;
  const experience = unit.experienceForLevel > 0 ? (unit.experience / unit.experienceForLevel) * 100 : 0;
  const hp = `HP ${unit.health}/${unit.maxHealth}`;
  const healed = after && gained > 0 ? `, ${after.health}/${after.maxHealth} after` : '';
  const hurt = unit.health < unit.maxHealth;
  return (
    <li
      className={`reward-screen__member${leveled ? ' reward-screen__member--leveled' : ''}`}
      title={`${unit.name}, ${unit.unitClass}\nLv ${unit.level} · ${unit.experience}/${unit.experienceForLevel} XP\n${hp}`}
    >
      <span className="reward-screen__member-sprite" aria-hidden="true">
        <UnitSprite sprite={unit.sprite} />
      </span>
      <span className="reward-screen__member-head">
        <span className={`reward-screen__member-name${hurt ? ' reward-screen__member-name--hurt' : ''}`}>
          {unit.name}
        </span>
        <span className="reward-screen__member-level">
          <span className="visually-hidden">Level </span>
          LV <b>{unit.level}</b>
          {leveled && <span className="reward-screen__member-up"> ↑</span>}
        </span>
      </span>
      <span className="reward-screen__member-hp" aria-hidden="true">
        <span className="reward-screen__member-kept" style={{ width: `${kept}%` }} />
        <span className="reward-screen__member-gained" style={{ width: `${gained}%` }} />
      </span>
      <span className="reward-screen__member-xp" aria-hidden="true">
        <span style={{ width: `${experience}%` }} />
      </span>
      <span className="visually-hidden">
        {hp}
        {healed}
      </span>
    </li>
  );
}

// A sum of gold as the rest of the UI shows it: the coin, then the number.
function Gold({ amount }: { amount: string | number }) {
  return (
    <span className="reward-screen__gold">
      <GlyphIcon kind="gold" />
      {amount}
      <span className="visually-hidden"> gold</span>
    </span>
  );
}

// A plate's numbers block, pinned to its foot: each fact's label and
// value, "value ➜ after" when the reward changes it, a sum of gold with
// the coin. Always laid out, so plates with none line up with the rest.
function RewardFacts({ facts }: { facts: readonly RewardFact[] }) {
  const show = (fact: RewardFact, value: string | number) => (fact.gold ? <Gold amount={value} /> : value);
  return (
    <dl className="reward-plate__facts">
      {facts.map((fact) => (
        <div key={fact.label} className="reward-plate__fact">
          <dt>{fact.label}</dt>
          <dd>
            {show(fact, fact.value)}
            {fact.after !== undefined && (
              <>
                <span className="reward-plate__arrow" aria-hidden="true">
                  {' ➜ '}
                </span>
                <span className="visually-hidden"> becomes </span>
                <span className="reward-plate__after">{show(fact, fact.after)}</span>
              </>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// A plate's picture, two tiles big beside its name: a recruit's unit
// (idling while picked), the item a Supplies, Arms or Seal reward gives,
// the relic a Relic reward gives, the keystone a Keystone reward gives,
// else the reward kind's icon.
function RewardPicture({ reward, selected }: { reward: RewardAction; selected: boolean }) {
  if (reward.sprite) {
    return (
      <span className="reward-plate__picture" aria-hidden="true">
        <UnitSprite sprite={reward.sprite} scale={2} animated={selected} />
      </span>
    );
  }
  const url = reward.itemIcon
    ? SPRITE_URLS[reward.itemIcon]
    : ((reward.relicId && getRelicIconUrl(reward.relicId)) ??
      (reward.keystoneId && KEYSTONE_ICON_URLS[reward.keystoneId]) ??
      REWARD_ICON_URLS[reward.kind]);
  return (
    <span className="reward-plate__picture" aria-hidden="true">
      {url && <img className="reward-plate__icon" src={url} alt="" width={64} height={64} />}
    </span>
  );
}
