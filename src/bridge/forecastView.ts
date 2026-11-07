import type { Unit } from '../game/Unit.ts';
import type { Point } from '../game/grid.ts';
import { toPartyUnitView, type PartyUnitView } from './partyView.ts';
import type { ForecastSideView } from './views.ts';

// What the combat forecast band (CombatForecast.tsx) says over its two
// rows, and the other targets the aimed attack could hit instead.

// How many strikes the exchange holds: the attacker's, then the defender's
// if it can counter.
export function countForecastStrikes(attacker: ForecastSideView, defender: ForecastSideView): number {
  return attacker.strikes + (defender.counters ? defender.strikes : 0);
}

// The exchange in a line, if every strike lands: who falls, else what each
// side takes at most ("Goblin falls · Kestrel takes 4 at most"), and that
// a defender can't answer ("Goblin can't counter").
export function describeForecastOutcome(attacker: ForecastSideView, defender: ForecastSideView): string {
  const parts = [describeSide(defender), defender.counters ? describeSide(attacker) : `${defender.name} can't counter`];
  return parts.join(' · ');
}

function describeSide(side: ForecastSideView): string {
  if (side.healthAfter <= 0) return `${side.name} falls`;
  const loses = side.health - side.healthAfter;
  return loses > 0 ? `${side.name} takes ${loses} at most` : `${side.name} is safe`;
}

// The hostile units the aimed attack could hit instead of the one under
// the cursor, as rows for the right column's "Other targets" card, in the
// order the targets were found.
export function toOtherTargetViews(
  units: ReadonlyMap<string, Unit>,
  targets: readonly (Point & { unitId: string })[],
  currentId: string,
): readonly PartyUnitView[] {
  const rows: PartyUnitView[] = [];
  for (const target of targets) {
    if (target.unitId === currentId) continue;
    const unit = units.get(target.unitId);
    if (unit) rows.push(toPartyUnitView(target.unitId, unit, false, false));
  }
  return Object.freeze(rows);
}
