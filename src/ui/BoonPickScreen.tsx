import type { CSSProperties } from 'react';
import type { BoonKind } from '../game/warband/boons.ts';
import { BoonIcon } from './BoonIcon.tsx';
import { Frame } from './Frame.tsx';
import { KeyHint } from './KeyHint.tsx';
import { menuItemPointerProps } from './menuPointer.ts';
import { UnitSprite } from './UnitSprite.tsx';
import { useGameStore } from './useGameStore.ts';
import './BoonPickScreen.css';
import { StatLabel } from './StatLabel.tsx';

const KIND_LABELS: Readonly<Record<BoonKind, string>> = { stat: 'Stat', skill: 'Skill', passive: 'Passive' };
const TITLE = 'Level Up!';
// How many sparks rise around the unit.
const SPARKS = 10;

// Spark `index`'s spot across the column and its start in the rise's
// cycle, scattered so they never rise in step.
function sparkStyle(index: number): CSSProperties {
  return { '--x': `${((index * 37) % 76) + 12}%`, '--delay': `${((index * 470) % 1700) + 300}ms` } as CSSProperties;
}

// A Warband unit's level-up boon pick, as its own screen rather than the
// reward screen's cards: on the left the unit, enlarged, in a column of
// light with sparks rising and "Level Up!" bouncing in over it, its new
// level and its stats (a stat boon's raise previewed on them); on the
// right the boons as a list with their icons, and the picked one's
// description in a box under it. GridScene drives the menu (`rewardMenu`,
// its entries in the order of `boonPick.boons`) and holds off confirming
// while the effect plays. The screen is keyed by the pick, so the effect
// replays for each unit and level in a row of picks.
export function BoonPickScreen() {
  const menu = useGameStore((state) => state.rewardMenu);
  const pick = useGameStore((state) => state.boonPick);
  if (!menu || !pick) return null;
  const selected = pick.boons[menu.selectedIndex] ?? null;
  const gain = selected?.gain ?? null;

  return (
    <div className="pause-overlay boon-pick-overlay">
      <section key={pick.key} className="boon-pick" aria-label={`${pick.name} reached level ${pick.level}`}>
        <Frame as="div" variant="banner" className="boon-pick__stage">
          <div className="boon-pick__glory" aria-hidden="true">
            <span className="boon-pick__rays" />
            <span className="boon-pick__pillar" />
            <span className="boon-pick__ring" />
            {Array.from({ length: SPARKS }, (_, index) => (
              <span key={index} className="boon-pick__spark" style={sparkStyle(index)} />
            ))}
            <span className="boon-pick__hero">
              <UnitSprite sprite={pick.sprite} scale={3} animated />
            </span>
            <span className="boon-pick__flash" />
          </div>
          <h2 className="boon-pick__title">
            {[...TITLE].map((letter, index) => (
              <span key={index} className="boon-pick__letter" style={{ '--i': index } as CSSProperties}>
                {letter === ' ' ? ' ' : letter}
              </span>
            ))}
          </h2>
          <p className="boon-pick__who">
            <span className="boon-pick__name">{pick.name}</span>
            <span className="boon-pick__class">{pick.classLabel}</span>
          </p>
          <p className="boon-pick__level">
            LV <span className="boon-pick__level-was">{pick.level - 1}</span>
            <span className="boon-pick__level-arrow">▸</span>
            <span className="boon-pick__level-now">{pick.level}</span>
          </p>
          <dl className="boon-pick__stats">
            {pick.stats.map((stat) => {
              const up = gain?.stat === stat.stat ? gain.amount : 0;
              const classes = ['boon-pick__stat'];
              if (stat.gain > 0) classes.push('boon-pick__stat--grew');
              if (up > 0) classes.push('boon-pick__stat--up');
              return (
                <div key={stat.stat} className={classes.join(' ')}>
                  <dt>
                    <StatLabel label={stat.label} />
                  </dt>
                  <dd>
                    {stat.value}
                    <span className="boon-pick__stat-gain">{stat.gain > 0 ? `+${stat.gain}` : ''}</span>
                    <span className="boon-pick__stat-after">▸{stat.value + up}</span>
                  </dd>
                </div>
              );
            })}
          </dl>
          {pick.skills.length > 0 && <p className="boon-pick__skills">Learned {pick.skills.join(', ')}</p>}
        </Frame>
        <Frame as="div" className="boon-pick__choices">
          <h3 className="boon-pick__choices-title">Choose a Boon</h3>
          <ul className="boon-pick__list">
            {pick.boons.map((boon, index) => {
              const isSelected = index === menu.selectedIndex;
              return (
                <li
                  key={`${boon.id}-${index}`}
                  className={`boon-pick__boon boon-pick__boon--${boon.kind}${isSelected ? ' boon-pick__boon--selected' : ''}`}
                  aria-current={isSelected ? 'true' : undefined}
                  style={{ '--i': index } as CSSProperties}
                  {...menuItemPointerProps('rewardMenu', index)}
                >
                  <span className="boon-pick__boon-icon">
                    <BoonIcon boonId={boon.id} kind={boon.kind} />
                  </span>
                  <span className="boon-pick__boon-name">{boon.name}</span>
                  <span className="boon-pick__boon-kind">{KIND_LABELS[boon.kind]}</span>
                </li>
              );
            })}
          </ul>
          <div className="boon-pick__detail" aria-live="polite">
            {selected && (
              <>
                <span className="boon-pick__detail-icon">
                  <BoonIcon boonId={selected.id} kind={selected.kind} scale={2} />
                </span>
                <div className="boon-pick__detail-text">
                  <p className="boon-pick__detail-name">{selected.name}</p>
                  <p className="boon-pick__detail-description">{selected.description}</p>
                  <p className="boon-pick__detail-evolves">{selected.evolves ? '✦ Completes an evolution!' : ''}</p>
                </div>
              </>
            )}
          </div>
          <KeyHint
            className="boon-pick__hint"
            entries={[
              ['↑↓', 'Choose'],
              ['Enter', 'Take boon'],
            ]}
          />
        </Frame>
      </section>
    </div>
  );
}
