import type { ReactNode } from 'react';
import type { ForecastSideView } from '../bridge/views.ts';
import { countForecastStrikes, describeForecastOutcome } from '../bridge/forecastView.ts';
import { ItemIcon } from './ItemIcon.tsx';
import { Pips } from './Pips.tsx';
import { RankBadge } from './RankBadge.tsx';
import { StatIcon, type StatIconKind } from './StatIcon.tsx';
import { usePanelBesideAnchor } from './useMenuBesideUnit.ts';
import { UnitSprite } from './UnitSprite.tsx';
import { useGameStore } from './useGameStore.ts';

// The combat forecast shown while aiming an attack at a unit. On wide
// windows it's a band across the foot of the stage (`band`): one row per
// fighter facing the other across a VS spine that counts the strikes, each
// row its portrait, its name over its weapon, then HP (now ➜ after, with
// the points lost drawn red on its blocks), damage per hit (×2 when it
// strikes twice), hit (with a bar) and crit, the attacker's row tinted its
// team's color on the left and the defender's on the right; over the band,
// a tag saying how the exchange ends if every strike lands
// (describeForecastOutcome). The damage is also drawn on the target's tile
// (MapTags), and the right column lists the other targets in reach
// (BattleSide). Otherwise (windows too narrow for the columns; ui.css
// shows one or the other) it floats beside the fighters, covering neither:
// a small table, each side's weapon (with its icon), HP with a bar marking
// how much of it the exchange would take, damage, hit and crit, attacker
// on the left and defender on the right, each row's label with a small
// stat icon as on the GBA's battle window. A defender that can't counter
// shows "–". GridScene publishes the numbers (from getCombatForecast) and
// where the two units stand.
// The share of the stage's height, from the top, above the strip the band
// covers at its foot (the band and its tag are about a seventh of it).
const BAND_STRIP = 0.84;

export function CombatForecast({ band = false }: { band?: boolean }) {
  const forecast = useGameStore((state) => state.combatForecast);
  const placement = usePanelBesideAnchor(Boolean(forecast) && !band, forecast?.anchor ?? null);
  if (!forecast) return null;

  const { attacker, defender } = forecast;
  const sides = `combat-forecast--attacker-${attacker.team} combat-forecast--defender-${defender.team}`;
  if (band) {
    // The band sits across the stage's foot, or its top while either
    // fighter stands in the strip it would cover.
    const edge = forecast.anchor.bottom > BAND_STRIP ? ' combat-forecast--band-top' : '';
    return (
      <section className={`combat-forecast combat-forecast--band${edge} ${sides}`} aria-label="Combat forecast">
        <p className="combat-forecast__outcome">{describeForecastOutcome(attacker, defender)}</p>
        <FighterRow side={attacker} facing="left" />
        <div className="combat-forecast__spine">
          <span className="combat-forecast__vs">vs</span>
          <span className="combat-forecast__strikes">
            {countForecastStrikes(attacker, defender)}
            <br />
            {countForecastStrikes(attacker, defender) === 1 ? 'strike' : 'strikes'}
          </span>
        </div>
        <FighterRow side={defender} facing="right" />
      </section>
    );
  }
  return (
    <section
      className={`panel combat-forecast combat-forecast--float ${sides}`}
      aria-label="Combat forecast"
      {...placement}
    >
      <div className="combat-forecast__head">
        <div className="combat-forecast__names">
          <Name side={attacker} />
          <Name side={defender} />
        </div>
        <div className="combat-forecast__weapons">
          <Weapon side={attacker} />
          <Weapon side={defender} />
        </div>
      </div>
      <div className="combat-forecast__rows">
        <Row icon="health" label="HP" attacker={<Health side={attacker} />} defender={<Health side={defender} />} />
        <div className="combat-forecast__bars">
          <HealthBar side={attacker} />
          <HealthBar side={defender} />
        </div>
        <Row icon="attack" label="Dmg" attacker={<Damage side={attacker} />} defender={<Damage side={defender} />} />
        <Row icon="hit" label="Hit" attacker={attacker.hit} defender={defender.hit} />
        <Row icon="crit" label="Crt" attacker={attacker.crit} defender={defender.crit} />
      </div>
    </section>
  );
}

// A fighter's row on the band: portrait, name over weapon, then its four
// numbers; the defender's run the other way so the numbers meet at the
// spine. Every cell is laid out whether or not it has a number, so the
// band keeps its width from one target to the next.
function FighterRow({ side, facing }: { side: ForecastSideView; facing: 'left' | 'right' }) {
  const lost = side.health - side.healthAfter;
  const cells = [
    <div key="hp" className="combat-forecast__cell combat-forecast__cell--hp">
      <span className="combat-forecast__key">HP</span>
      <span className="combat-forecast__number">
        {side.health}
        <span className="combat-forecast__to" aria-hidden="true">
          ➜
        </span>
        <span className={side.healthAfter <= 0 ? 'combat-forecast__after--lethal' : 'combat-forecast__after--alive'}>
          {side.healthAfter}
        </span>
      </span>
      <Pips value={side.health} max={side.maxHealth} lost={lost} size="small" />
    </div>,
    <div key="dmg" className="combat-forecast__cell">
      <span className="combat-forecast__key">Dmg</span>
      <span className="combat-forecast__number">
        <Damage side={side} />
      </span>
    </div>,
    <div key="hit" className="combat-forecast__cell">
      <span className="combat-forecast__key">Hit</span>
      <span className="combat-forecast__number">{side.hit ?? '–'}</span>
      <span className="combat-forecast__hit-bar" role="presentation">
        <i style={{ width: `${side.hit ?? 0}%` }} />
      </span>
    </div>,
    <div key="crt" className="combat-forecast__cell">
      <span className="combat-forecast__key">Crt</span>
      <span className="combat-forecast__number">{side.crit ?? '–'}</span>
    </div>,
  ];
  const identity = [
    <span key="portrait" className={`combat-forecast__portrait combat-forecast__portrait--${side.team}`}>
      <UnitSprite sprite={side.sprite} />
      {side.rank && <RankBadge rank={side.rank} className="rank-badge--portrait" />}
    </span>,
    <span key="id" className="combat-forecast__identity">
      <span className={`combat-forecast__name combat-forecast__name--${side.team}`} title={side.name}>
        {side.name}
      </span>
      <span className="combat-forecast__weapon-name" title={side.weapon ?? undefined}>
        {side.weapon ?? '–'}
      </span>
    </span>,
  ];
  return (
    <div
      className={`combat-forecast__fighter combat-forecast__fighter--${facing} combat-forecast__fighter--${side.team}`}
    >
      {facing === 'left' ? [...identity, ...cells] : [...cells.reverse(), ...identity.reverse()]}
    </div>
  );
}

// A side's name, led by its badge when it's a boss or an elite.
function Name({ side }: { side: ForecastSideView }) {
  return (
    <span className={`combat-forecast__name combat-forecast__name--${side.team}`}>
      {side.rank && <RankBadge rank={side.rank} />}
      {side.name}
    </span>
  );
}

function Weapon({ side }: { side: ForecastSideView }) {
  return (
    <span className="combat-forecast__weapon">
      <ItemIcon itemId={side.weaponId} />
      <span className="combat-forecast__weapon-label" title={side.weapon ?? undefined}>
        {side.weapon ?? '–'}
      </span>
    </span>
  );
}

function Row({
  icon,
  label,
  attacker,
  defender,
}: {
  icon: StatIconKind;
  label: string;
  attacker: ReactNode;
  defender: ReactNode;
}) {
  return (
    <div className="combat-forecast__row">
      <span className="combat-forecast__value">{attacker ?? '–'}</span>
      <span className="combat-forecast__label">
        <StatIcon kind={icon} />
        {label}
      </span>
      <span className="combat-forecast__value">{defender ?? '–'}</span>
    </div>
  );
}

function Damage({ side }: { side: ForecastSideView }) {
  if (side.damage === null) return '–';
  return (
    <>
      {side.damage}
      {side.strikes > 1 && <span className="combat-forecast__double">×{side.strikes}</span>}
    </>
  );
}

// Current HP, then what it drops to if every strike lands. The drop is
// always laid out (hidden when nothing is lost) so the panel keeps its size
// from one target to the next.
function Health({ side }: { side: ForecastSideView }) {
  const loses = side.healthAfter < side.health;
  return (
    <>
      {side.health}
      <span
        className={`combat-forecast__after${side.healthAfter === 0 ? ' combat-forecast__after--lethal' : ''}`}
        style={loses ? undefined : { visibility: 'hidden' }}
        aria-hidden={!loses}
      >
        <span className="combat-forecast__arrow">▸</span>
        {side.healthAfter}
      </span>
    </>
  );
}

// The side's health bar: what it keeps, then the part the exchange would
// take (blinking), then the trough of what it had already lost.
function HealthBar({ side }: { side: ForecastSideView }) {
  const max = Math.max(1, side.maxHealth);
  const kept = (side.healthAfter / max) * 100;
  const lost = ((side.health - side.healthAfter) / max) * 100;
  return (
    <span className="combat-forecast__bar" role="presentation">
      <span className="combat-forecast__bar-kept" style={{ width: `${kept}%` }} />
      <span className="combat-forecast__bar-lost" style={{ width: `${lost}%` }} />
    </span>
  );
}
