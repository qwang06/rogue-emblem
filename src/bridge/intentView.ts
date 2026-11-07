// Snapshots of the enemies' intents for the right column's enemy rows
// (BattleSide): who each enemy means to strike next phase and for how
// much, and, for the column's threat readout, what the intents add up
// to. Plain frozen data from src/game/battle/intents.ts.

import type { EnemyIntent, IntentThreat } from '../game/battle/intents.ts';
import type { BattleState } from '../game/battle/state.ts';

export interface IntentView {
  unitId: string;
  // The name of the foe it means to strike, or null when it only moves
  // (or heals, buffs or lays a mine).
  targetName: string | null;
  // Per landed strike, how many strikes, and its hit chance; 0 with no target.
  damage: number;
  strikes: number;
  hit: number;
  // Whether it stays where it stands.
  holds: boolean;
}

export function toIntentViews(
  state: Pick<BattleState, 'units'>,
  intents: readonly EnemyIntent[],
): readonly IntentView[] {
  return intents.map((intent) =>
    Object.freeze({
      unitId: intent.unitId,
      targetName: intent.target ? (state.units.get(intent.target.unitId)?.name ?? null) : null,
      damage: intent.damage,
      strikes: intent.strikes,
      hit: intent.hit,
      holds: intent.path.length <= 1 && !intent.target,
    }),
  );
}

// What the intents add up to: how many units are in someone's sights,
// the HP they'd lose together if every strike landed, and how many of
// them that would fell.
export interface ThreatSummaryView {
  units: number;
  damage: number;
  lethal: number;
}

export function summarizeThreats(threats: readonly IntentThreat[]): ThreatSummaryView {
  return Object.freeze({
    units: threats.length,
    damage: threats.reduce((sum, threat) => sum + threat.damage, 0),
    lethal: threats.filter((threat) => threat.lethal).length,
  });
}
