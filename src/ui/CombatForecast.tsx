import type { ReactNode } from 'react';
import type { ForecastSideView } from '../bridge/views.ts';
import { ItemIcon } from './ItemIcon.tsx';
import { RankBadge } from './RankBadge.tsx';
import { StatIcon, type StatIconKind } from './StatIcon.tsx';
import { usePanelBesideAnchor } from './useMenuBesideUnit.ts';
import { useGameStore } from './useGameStore.ts';

// The combat forecast shown while aiming an attack at a unit: each side's
// weapon (with its icon), HP with a bar marking how much of it the exchange
// would take if every strike lands, damage per hit (with ×2 when it strikes twice), hit and crit
// chances, attacker on the left and defender on the right. A defender that
// can't counter shows "–". GridScene publishes the numbers (from
// getCombatForecast) and where the two units stand; this opens beside
// them, covering neither. Each row's label carries a small stat icon, as
// on the GBA's battle window.
export function CombatForecast() {
  const forecast = useGameStore((state) => state.combatForecast);
  const placement = usePanelBesideAnchor(Boolean(forecast), forecast?.anchor ?? null);
  if (!forecast) return null;

  const { attacker, defender } = forecast;
  return (
    <section
      className={`panel combat-forecast combat-forecast--attacker-${attacker.team} combat-forecast--defender-${defender.team}`}
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
