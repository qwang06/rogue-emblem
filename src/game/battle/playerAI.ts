// A battle AI for the player's side, so a Warband run can play itself
// (warband/autoRun.ts). The enemy's AI (ai.ts) only rushes; this one plays
// for the objective and keeps its units alive. For each unit that hasn't
// acted it scores every action it could take from every tile it could
// reach: attacking (by the forecast's expected damage and kill chance),
// healing a wounded ally, drinking a potion, or waiting, plus what the tile
// itself is worth: how much the enemy could hit it there next phase and
// how much closer it is to the objective. The best-scoring unit acts first.
// It plans from the forecast, never from the dice. Every weight is a named
// constant to tune. Its few best plans then go to a lookahead
// (lookahead.ts), which plays each out through the enemy phase with
// sampled dice and keeps the one that turns out best. Pure: reads a state
// and returns commands.

import { getCombatForecast, getAttackRange, getAttackTargets, type ForecastSide } from '../combat.ts';
import { CRIT_MULTIPLIER } from '../combatStats.ts';
import { getDistance, getCell, getNeighbors, findUnit, type Grid, type Point } from '../grid.ts';
import { getHealAmount, getHealTargets, getStaves, isWounded } from '../healing.ts';
import { canUseItem, getConsumables, getItemRecovery } from '../items.ts';
import { getMoveCost, getMovementRange, getMovePath, type RangeTile } from '../movement.ts';
import { getPhaseMovement } from '../enemyAI.ts';
import { getTeamUnitIds } from '../teams.ts';
import { isDone } from '../turns.ts';
import type { Unit } from '../Unit.ts';
import { getMovementOptions, hostileTo, type BattleCommand } from './commands.ts';
import { LOOKAHEAD, pickByLookahead, type LookaheadOptions } from './lookahead.ts';
import type { BattleState } from './state.ts';

export const PLAYER_AI_WEIGHTS = Object.freeze({
  // Per point of expected damage dealt (capped at the target's health).
  damageDealt: 1,
  // Per point of expected counter damage taken.
  counterTaken: 0.5,
  // Times the hit chance, for an attack that kills if its strikes land.
  kill: 40,
  // Per point of expected damage the enemy could deal on the tile next phase.
  danger: 0.6,
  // When that could kill the unit.
  lethalDanger: 30,
  // Per point of health healed (doubled for an ally under half health).
  heal: 1.2,
  // Per point of health a potion restores, only at half health or under.
  potion: 1,
  // Per movement point closer to the goal (the seize tile, the boss, or
  // the nearest enemy).
  approach: 0.8,
  // For ending a move on the seize tile, which wins the battle.
  seize: 1000,
  // Per other player unit within COHESION_RANGE of the tile (up to
  // COHESION_CAP of them), so units move up together.
  cohesion: 2,
  // Attacking the boss on a boss stage.
  boss: 15,
});

export type PlayerAIWeights = typeof PLAYER_AI_WEIGHTS;

// How near another unit counts as moving together, and how many count.
export const COHESION_RANGE = 2;
export const COHESION_CAP = 2;

const FAR = Number.MAX_SAFE_INTEGER;

// One unit's planned action: its move and act, how the heuristic scores
// it, and the parts of that score the lookahead keeps or checks.
export interface PlayerPlan {
  commands: BattleCommand[];
  score: number;
  // What the end tile is worth apart from danger: the seize bonus,
  // progress toward the goal and cohesion.
  position: number;
  // Expected damage the enemy could deal the unit there next phase.
  danger: number;
  // Whether the act strikes or heals someone (not a wait or a potion).
  engages: boolean;
}

export interface PlayerAIOptions {
  weights?: PlayerAIWeights;
  // How the best plans are played out before one is picked; false picks
  // the heuristic's best outright.
  lookahead?: LookaheadOptions | false;
}

// The player's next unit's action: the heuristic's best plans across the
// units yet to act, played out by the lookahead, which picks one. Empty
// when the battle isn't being fought or every unit has acted.
export function planPlayerTurn(state: BattleState, options: PlayerAIOptions = {}): BattleCommand[] {
  const { weights = PLAYER_AI_WEIGHTS, lookahead = LOOKAHEAD } = options;
  const plans = getPlayerPlans(state, weights);
  if (plans.length === 0) return [];
  if (!lookahead || !isContested(plans.slice(0, lookahead.candidates))) return plans[0].commands;
  const rest = (next: BattleState) => getPlayerPlans(next, weights)[0]?.commands ?? [];
  return pickByLookahead(state, plans.slice(0, lookahead.candidates), lookahead, rest).commands;
}

// Every unit's best plan for each different act it could take (attacking
// each foe in reach, healing each ally, a potion, waiting), over the units
// yet to act, best first.
export function getPlayerPlans(state: BattleState, weights: PlayerAIWeights = PLAYER_AI_WEIGHTS): PlayerPlan[] {
  const { turnState } = state;
  if (state.stage !== 'battle' || state.outcome || !turnState || turnState.team !== 'player') return [];
  const context = createContext(state, weights);
  const plans: PlayerPlan[] = [];
  for (const unitId of getTeamUnitIds(state.units, 'player')) {
    if (isDone(turnState, unitId)) continue;
    plans.push(...planUnit(state, context, unitId));
  }
  // Stable, so ties keep unit order.
  return plans.sort((a, b) => b.score - a.score);
}

// Whether the dice could change which plan is best: one of them fights,
// or ends where the enemy can reach. If none does, the heuristic's best
// stands.
function isContested(plans: readonly PlayerPlan[]): boolean {
  return plans.length > 1 && plans.some((plan) => plan.engages || plan.danger > 0);
}

// Deployment for the player: the healthiest roster units (by share of
// health) until the slots run out, those that fight up close on the zone
// tiles nearest the enemy and the rest behind them, then the battle starts.
export function planPlayerDeployment(state: BattleState): BattleCommand[] {
  if (state.stage !== 'deployment') return [];
  const { grid, units } = state;
  const enemyTiles = [...units]
    .filter(([, unit]) => unit.team !== 'player' && unit.isAlive())
    .map(([unitId]) => findUnit(grid, unitId))
    .filter((tile): tile is Point => tile !== null);
  const nearestEnemy = (tile: Point) => Math.min(FAR, ...enemyTiles.map((at) => getDistance(tile, at)));
  const open = state.deploymentZone
    .filter((tile) => !getCell(grid, tile.x, tile.y)?.unitId)
    .sort((a, b) => nearestEnemy(a) - nearestEnemy(b));
  const placed = state.roster.filter((unitId) => findUnit(grid, unitId)).length;
  const healthShare = (unitId: string) => units.get(unitId)!.health / units.get(unitId)!.maxHealth;
  const picked = state.roster
    .filter((unitId) => !findUnit(grid, unitId))
    .sort((a, b) => healthShare(b) - healthShare(a))
    .slice(0, Math.max(0, state.deploymentLimit - placed));
  const front = picked.filter((unitId) => isFrontLine(units.get(unitId)!));
  const back = picked.filter((unitId) => !isFrontLine(units.get(unitId)!));
  const commands: BattleCommand[] = [];
  [...front, ...back].forEach((unitId, index) => {
    const tile = open[index];
    if (tile) commands.push({ type: 'place', unitId, to: { x: tile.x, y: tile.y } });
  });
  commands.push({ type: 'start-battle' });
  return commands;
}

// What planning reads once per call: each enemy's reach next phase, and
// how far every tile is from the objective.
interface Context {
  weights: PlayerAIWeights;
  // Where the other player units stand, by unitId.
  allies: Map<string, Point>;
  enemies: { unitId: string; unit: Unit; threatened: Set<string> }[];
  // Movement cost from each tile ("x,y") to the goal; absent = unreachable.
  goal: Map<string, number>;
  seize: Point | null;
  bossId: string | null;
}

function createContext(state: BattleState, weights: PlayerAIWeights): Context {
  const { grid, units, objective } = state;
  const allies = new Map<string, Point>();
  for (const unitId of getTeamUnitIds(units, 'player')) {
    const tile = findUnit(grid, unitId);
    if (tile) allies.set(unitId, tile);
  }
  const enemies = [...units]
    .filter(([unitId, unit]) => unit.team !== 'player' && unit.isAlive() && findUnit(grid, unitId) !== null)
    .map(([unitId, unit]) => ({ unitId, unit, threatened: getThreatened(state, unitId, unit) }));
  const seize = objective.kind === 'seize' ? objective.tile : null;
  const bossId = objective.kind === 'boss' && units.has(objective.unitId) ? objective.unitId : null;
  const goals: Point[] = seize
    ? [seize]
    : bossId
      ? [findUnit(grid, bossId)].filter((tile): tile is Point => tile !== null)
      : enemies.map(({ unitId }) => findUnit(grid, unitId)).filter((tile): tile is Point => tile !== null);
  return { weights, allies, enemies, goal: getDistanceMap(grid, goals), seize, bossId };
}

// Every tile ("x,y") the enemy `unitId` could strike next phase.
function getThreatened(state: BattleState, unitId: string, unit: Unit): Set<string> {
  const threatened = new Set<string>();
  const from = findUnit(state.grid, unitId);
  const weapon = unit.weapon;
  if (!from || !weapon) return threatened;
  // Player units block it, as they would on its phase.
  const stops = getMovementRange(state.grid, from, getPhaseMovement(unit), getMovementOptions(state.units, unit));
  for (const stop of stops) {
    for (const tile of getAttackRange(state.grid, stop, weapon.maxRange, weapon.minRange)) {
      threatened.add(key(tile));
    }
  }
  return threatened;
}

// The cheapest movement cost from any of `goals` to every tile, as if no
// unit stood anywhere (Dijkstra over the terrain's move costs).
function getDistanceMap(grid: Grid, goals: readonly Point[]): Map<string, number> {
  const costs = new Map<string, number>();
  const queue: { tile: Point; cost: number }[] = goals.map((tile) => ({ tile, cost: 0 }));
  for (const { tile } of queue) costs.set(key(tile), 0);
  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const { tile, cost } = queue.shift()!;
    if (cost > costs.get(key(tile))!) continue;
    for (const next of getNeighbors(grid, tile.x, tile.y)) {
      const step = getMoveCost(getCell(grid, next.x, next.y)!.terrain);
      if (!Number.isFinite(step)) continue;
      const total = cost + step;
      if (total < (costs.get(key(next)) ?? Infinity)) {
        costs.set(key(next), total);
        queue.push({ tile: next, cost: total });
      }
    }
  }
  return costs;
}

// One unit's plans: for each different act, the best tile to take it
// from.
function planUnit(state: BattleState, context: Context, unitId: string): PlayerPlan[] {
  const unit = state.units.get(unitId);
  const from = findUnit(state.grid, unitId);
  if (!unit || !from) return [];
  const options = getMovementOptions(state.units, unit);
  const tiles = getMovementRange(state.grid, from, unit.movement, options);
  const here = context.goal.get(key(from));
  const best = new Map<string, Omit<PlayerPlan, 'commands'> & { act: Action; tile: RangeTile }>();
  for (const tile of tiles) {
    const actions = getActions(state, context, unitId, unit, tile);
    const position = scorePosition(context, unitId, tile, here);
    for (const action of actions) {
      const danger = getDanger(context, unit, tile, action.removes);
      const score = action.score + position - dangerPenalty(context.weights, unit, danger);
      const actKey = JSON.stringify(action.commands[0]);
      const current = best.get(actKey);
      if (!current || score > current.score || (score === current.score && tile.cost < current.tile.cost)) {
        best.set(actKey, { act: action, tile, score, position, danger, engages: action.engages });
      }
    }
  }
  return [...best.values()].map(({ act, tile, ...plan }) => {
    const path = getMovePath(state.grid, from, tile, unit.movement, options) ?? [from];
    const to = { x: tile.x, y: tile.y };
    const move: BattleCommand = { type: 'move', unitId, to, path: path.map(({ x, y }) => ({ x, y })) };
    return { ...plan, commands: [move, ...act.commands] };
  });
}

interface Action {
  commands: BattleCommand[];
  score: number;
  engages: boolean;
  // An enemy this action likely kills, so it no longer threatens the tile.
  removes?: string;
}

// What the unit could do from `tile`: attack each foe in reach, heal each
// wounded ally in a staff's reach, drink a potion at half health or under,
// or wait.
function getActions(state: BattleState, context: Context, unitId: string, unit: Unit, tile: Point): Action[] {
  const actions: Action[] = [{ commands: [{ type: 'wait', unitId }], score: 0, engages: false }];
  const weapon = unit.weapon;
  if (weapon) {
    for (const target of getAttackTargets(
      state.grid,
      tile,
      weapon.maxRange,
      hostileTo(state.units, unit),
      weapon.minRange,
    )) {
      const foe = state.units.get(target.unitId)!;
      const { attacker, defender } = getCombatForecast(unit, foe, { distance: getDistance(tile, target) });
      const dealt = Math.min(defender.health, expectedDamage(attacker));
      const taken = Math.min(attacker.health, expectedDamage(defender));
      const lethal = canKill(attacker, defender.health);
      const hit = (attacker.hit ?? 0) / 100;
      const W = context.weights;
      let score = W.damageDealt * dealt - W.counterTaken * taken + (lethal ? W.kill * hit : 0);
      if (target.unitId === context.bossId) score += W.boss;
      actions.push({
        commands: [{ type: 'attack', unitId, target: { x: target.x, y: target.y } }],
        score,
        engages: true,
        removes: lethal && hit >= 0.7 ? target.unitId : undefined,
      });
    }
  }
  for (const { staff, index } of getStaves(unit.items)) {
    const canHeal = (otherId: string) => {
      const other = state.units.get(otherId);
      return otherId !== unitId && other?.team === unit.team && isWounded(other);
    };
    for (const target of getHealTargets(state.grid, tile, staff, canHeal)) {
      const patient = state.units.get(target.unitId)!;
      const amount = getHealAmount(unit, staff, patient);
      const urgent = patient.health < patient.maxHealth / 2 ? 2 : 1;
      actions.push({
        commands: [{ type: 'heal', unitId, staffIndex: index, target: { x: target.x, y: target.y } }],
        score: context.weights.heal * amount * urgent,
        engages: true,
      });
    }
  }
  if (unit.health <= unit.maxHealth / 2) {
    for (const { item } of getConsumables(unit.items)) {
      if (!canUseItem(unit, item) || item.stat !== 'health') continue;
      actions.push({
        commands: [{ type: 'item', unitId, itemId: item.id }],
        score: context.weights.potion * getItemRecovery(unit, item),
        engages: false,
      });
    }
  }
  return actions;
}

// What standing on `tile` is worth, danger aside: the seize bonus,
// progress toward the goal, and a little for staying near allies.
function scorePosition(context: Context, unitId: string, tile: Point, here: number | undefined): number {
  const W = context.weights;
  let score = 0;
  const near = [...context.allies].filter(([id, at]) => id !== unitId && getDistance(at, tile) <= COHESION_RANGE);
  score += W.cohesion * Math.min(COHESION_CAP, near.length);
  if (context.seize && tile.x === context.seize.x && tile.y === context.seize.y) score += W.seize;
  const there = context.goal.get(key(tile));
  if (here !== undefined && there !== undefined) score += W.approach * (here - there);
  return score;
}

// The damage the enemy could put on `unit` at `tile` next phase, not
// counting an enemy the action likely kills.
function getDanger(context: Context, unit: Unit, tile: Point, removes?: string): number {
  let danger = 0;
  for (const { unitId, unit: enemy, threatened } of context.enemies) {
    if (unitId === removes || !threatened.has(key(tile)) || !enemy.weapon) continue;
    const { attacker } = getCombatForecast(enemy, unit, { distance: enemy.weapon.minRange });
    danger += expectedDamage(attacker);
  }
  return danger;
}

function dangerPenalty(W: PlayerAIWeights, unit: Unit, danger: number): number {
  return W.danger * Math.min(danger, unit.health) + (danger >= unit.health ? W.lethalDanger : 0);
}

// Whether a unit belongs at the front: it strikes from adjacent tiles.
function isFrontLine(unit: Unit): boolean {
  const weapon = unit.weapon;
  return !!weapon && weapon.minRange <= 1;
}

// Average damage a side deals over the exchange (as aiScoring.ts counts it).
function expectedDamage(side: ForecastSide): number {
  if (side.damage === null || side.hit === null) return 0;
  const critChance = (side.crit ?? 0) / 100;
  return side.strikes * side.damage * (side.hit / 100) * (1 + critChance * (CRIT_MULTIPLIER - 1));
}

// Whether a side's strikes, all landing, take `health` to 0.
function canKill(side: ForecastSide, health: number): boolean {
  return side.damage !== null && side.damage > 0 && side.damage * side.strikes >= health;
}

function key({ x, y }: Point): string {
  return `${x},${y}`;
}
