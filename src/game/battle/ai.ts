// Commands a side can be given without anyone choosing them: the enemy
// phase (each enemy "rushes", see enemyAI.ts, or uses a skill or staff
// when that's worth more, see skillActs.ts), and the same for the
// player's units, so a whole battle can play itself out (runner.ts).
// Pure: they read a state and return commands to apply to it.

import { createAttackScorer, KILL_BONUS } from '../aiScoring.ts';
import { getCombatForecast, type TargetTile } from '../combat.ts';
import { getFirstOpenTile } from '../deployment.ts';
import { getPhaseMovement, planRushAction, type AttackScorer } from '../enemyAI.ts';
import { findUnit, getCell, getDistance, isSameTile, moveUnit, type Point } from '../grid.ts';
import { hasModifier } from '../modifiers.ts';
import { getMovePath, getMovementRange } from '../movement.ts';
import { getPushDirection, getPushResult } from '../push.ts';
import { areAllied, getTeamUnitIds } from '../teams.ts';
import { isDone } from '../turns.ts';
import { getMovementOptions, hostileTo, type BattleCommand } from './commands.ts';
import { getSkillActs, hasSkillActs } from './skillActs.ts';
import type { BattleState } from './state.ts';
import type { Unit } from '../Unit.ts';

// One unit's whole action: walk a route (just its own tile to stay put),
// then act from the end of it. The plan is planRushAction's (attack the
// best target in reach, or march on the nearest), unless a skill or a
// staff used from some tile in reach scores higher (getSkillActs), and
// beats doing nothing at all; between equal ones, the tile nearest where
// the rush would have ended wins, so the unit keeps closing in.
export function planUnitTurn(state: BattleState, unitId: string): BattleCommand[] {
  const unit = state.units.get(unitId);
  const from = findUnit(state.grid, unitId);
  if (!unit || !from) return [];
  const movement = getPhaseMovement(unit);
  const options = getMovementOptions(state.units, unit);
  const isTarget = getTargetFilter(state, unit);
  const scorer = createShoveScorer(
    state,
    unit,
    from,
    createAttackScorer(unit, (id) => state.units.get(id)!),
  );
  const { path, target } = planRushAction(
    state.grid,
    from,
    { movement, weapon: unit.weapon },
    isTarget,
    options,
    scorer,
  );
  const end = path[path.length - 1];
  let plan = { path, act: rushAct(unitId, target), score: target ? scorer(end, target) : 0, distance: 0 };

  if (hasSkillActs(unit)) {
    for (const tile of getMovementRange(state.grid, from, movement, options)) {
      const standing = getCell(state.grid, tile.x, tile.y)?.unitId;
      if (standing && standing !== unitId) continue;
      const distance = getDistance(tile, end);
      for (const { command, score } of getSkillActs(state, unitId, tile, { isTarget })) {
        if (score <= 0 || score < plan.score || (score === plan.score && distance >= plan.distance)) continue;
        const route = isSameTile(tile, from) ? [from] : getMovePath(state.grid, from, tile, movement, options);
        if (route) plan = { path: route, act: command, score, distance };
      }
    }
  }
  const to = plan.path[plan.path.length - 1];
  return [{ type: 'move', unitId, to: point(to), path: plan.path.map(point) }, plan.act];
}

function rushAct(unitId: string, target: TargetTile | null): BattleCommand {
  return target ? { type: 'attack', unitId, target: point(target) } : { type: 'wait', unitId };
}

// For a unit whose attacks shove (the slime's Bounce), `score` plus what
// the shove would add if a strike lands: the spikes' or a bump's damage,
// a kill when it drowns or fells the foe, and the bump on whoever it
// slams into (for a foe, against an ally). Anyone else is scored as is.
export function createShoveScorer(state: BattleState, unit: Unit, from: Point, score: AttackScorer): AttackScorer {
  if (!hasModifier(unit.modifiers, 'shove-on-attack')) return score;
  return (tile, target) => {
    const base = score(tile, target);
    const grid = isSameTile(from, tile) ? state.grid : moveUnit(state.grid, from, tile);
    const shove = getPushResult(grid, state.units, target, getPushDirection(tile, target));
    const defender = state.units.get(target.unitId);
    if (!shove || !defender) return base;
    const { attacker } = getCombatForecast(unit, defender, { distance: getDistance(tile, target) });
    const lands = 1 - (1 - (attacker.hit ?? 0) / 100) ** attacker.strikes;
    const left = Math.max(0, defender.health - (attacker.damage ?? 0));
    let bonus = shove.drowned || (left > 0 && shove.damage >= left) ? KILL_BONUS : Math.min(shove.damage, left);
    const collided = shove.collidedId ? state.units.get(shove.collidedId) : undefined;
    if (collided) bonus += (areAllied(collided.team, unit.team) ? -1 : 1) * shove.collisionDamage;
    return base + lands * bonus;
  };
}

// Who `unit` goes after: any hostile unit, or, while it's Taunted
// (statuses.ts), only the Taunting ones, as long as one is in play.
export function getTargetFilter(state: BattleState, unit: Unit): (unitId: string) => boolean {
  const hostile = hostileTo(state.units, unit);
  if (!unit.statuses.includes('taunted')) return hostile;
  const taunting = (unitId: string) => hostile(unitId) && state.units.get(unitId)!.statuses.includes('taunting');
  return [...state.units.keys()].some(taunting) ? taunting : hostile;
}

// The next unit's planned action in the current phase: the first unit of
// the phase's team (in registry order) that hasn't acted. Empty when the
// battle isn't being fought (deployment, or decided).
export function planNextTurn(state: BattleState): BattleCommand[] {
  const { turnState } = state;
  if (state.stage !== 'battle' || state.outcome || !turnState) return [];
  // A unit on a canto (a Momentum kill) just stays put.
  if (turnState.canto) return [{ type: 'wait', unitId: turnState.canto.unitId }];
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
