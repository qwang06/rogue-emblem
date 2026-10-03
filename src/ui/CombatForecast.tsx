import type { ReactNode } from 'react';
import type { ForecastSideView } from '../bridge/views.ts';
import { usePanelBesideAnchor } from './useMenuBesideUnit.ts';
import { useGameStore } from './useGameStore.ts';

// The combat forecast shown while aiming an attack at a unit: each side's
// HP, damage per hit (with ×2 when it strikes twice), hit and crit
// chances, attacker on the left and defender on the right. A defender that
// can't counter shows "–". GridScene publishes the numbers (from
// getCombatForecast) and where the two units stand; this opens beside
// them, covering neither.
export function CombatForecast() {
  const forecast = useGameStore((state) => state.combatForecast);
  const placement = usePanelBesideAnchor(Boolean(forecast), forecast?.anchor ?? null);
  if (!forecast) return null;

  const { attacker, defender } = forecast;
  return (
    <section className="panel combat-forecast" aria-label="Combat forecast" {...placement}>
      <div className="combat-forecast__names">
        <span className={`combat-forecast__name combat-forecast__name--${attacker.team}`}>{attacker.name}</span>
        <span className={`combat-forecast__name combat-forecast__name--${defender.team}`}>{defender.name}</span>
      </div>
      <div className="combat-forecast__rows">
        <Row label="HP" attacker={attacker.health} defender={defender.health} />
        <Row label="Dmg" attacker={<Damage side={attacker} />} defender={<Damage side={defender} />} />
        <Row label="Hit" attacker={attacker.hit} defender={defender.hit} />
        <Row label="Crit" attacker={attacker.crit} defender={defender.crit} />
      </div>
    </section>
  );
}

function Row({ label, attacker, defender }: { label: string; attacker: ReactNode; defender: ReactNode }) {
  return (
    <div className="combat-forecast__row">
      <span className="combat-forecast__value">{attacker ?? '–'}</span>
      <span className="combat-forecast__label">{label}</span>
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
