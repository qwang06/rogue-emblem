// Commands a side can be given without anyone choosing them: the enemy
// phase (each enemy "rushes", see enemyAI.ts), and the same for the player's
// units, so a whole battle can play itself out (runner.ts). Pure: they
// read a state and return commands to apply to it.

import { createAttackScorer } from '../aiScoring.ts';
import { getFirstOpenTile } from '../deployment.ts';
import { getPhaseMovement, planRushAction } from '../enemyAI.ts';
import { findUnit, type Point } from '../grid.ts';
import { getTeamUnitIds } from '../teams.ts';
import { isDone } from '../turns.ts';
import { getMovementOptions, hostileTo, type BattleCommand } from './commands.ts';
import type { BattleState } from './state.ts';

// One unit's whole action, planned with planRushAction: walk its route
// (just its own tile to stay put), then attack the planned target, or wait.
export function planUnitTurn(state: BattleState, unitId: string): BattleCommand[] {
  const unit = state.units.get(unitId);
  const from = findUnit(state.grid, unitId);
  if (!unit || !from) return [];
  const { path, target } = planRushAction(
    state.grid,
    from,
    { movement: getPhaseMovement(unit), weapon: unit.weapon },
    hostileTo(state.units, unit),
    getMovementOptions(state.units, unit),
    createAttackScorer(unit, (id) => state.units.get(id)!),
  );
  const to = path[path.length - 1];
  const move: BattleCommand = { type: 'move', unitId, to: point(to), path: path.map(point) };
  const act: BattleCommand = target ? { type: 'attack', unitId, target: point(target) } : { type: 'wait', unitId };
  return [move, act];
}

// The next unit's planned action in the current phase: the first unit of
// the phase's team (in registry order) that hasn't acted. Empty when the
// battle isn't being fought (deployment, or decided).
export function planNextTurn(state: BattleState): BattleCommand[] {
  const { turnState } = state;
  if (state.stage !== 'battle' || state.outcome || !turnState) return [];
  const unitId = getTeamUnitIds(state.units, turnState.team).find((id) => !isDone(turnState, id));
  return unitId ? planUnitTurn(state, unitId) : [];
}

// Deployment done for the player: roster units, in roster order, on the
// zone's open tiles until the slots run out, then the battle starts.
export function planDeployment(state: BattleState): BattleCommand[] {
  if (state.stage !== 'deployment') return [];
  const commands: BattleCommand[] = [];
  const taken: Point[] = [];
  let placed = state.roster.filter((unitId) => findUnit(state.grid, unitId)).length;
  for (const unitId of state.roster) {
    if (placed >= state.deploymentLimit) break;
    if (findUnit(state.grid, unitId)) continue;
    const zone = state.deploymentZone.filter((tile) => !taken.some((t) => t.x === tile.x && t.y === tile.y));
    const to = getFirstOpenTile(state.grid, zone);
    if (!to) break;
    taken.push(to);
    commands.push({ type: 'place', unitId, to: point(to) });
    placed += 1;
  }
  commands.push({ type: 'start-battle' });
  return commands;
}

function point({ x, y }: Point): Point {
  return { x, y };
}
