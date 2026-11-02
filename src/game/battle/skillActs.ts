// The acts a battle AI can take besides attacking: using a skill or a
// staff. Skills and heals roll no dice, so each one is played out for real
// (applyCommand) on a copy of the battle, and what it did, read off its
// events, is weighed: damage and kills on foes (a shove onto spikes or
// into deep water included), HP healed and buffs on allies, debuffs on
// foes, a mine laid near a foe, against harm to its own side and the mana
// it costs. The AI never sees what it isn't meant to: foes' hidden mines
// are taken off the copy first. Used by the enemy's planner (ai.ts) and
// the player's (playerAI.ts). Pure: reads a state and returns commands.

import { getDistance, findUnit, isSameTile, moveUnit, type Point } from '../grid.ts';
import { KILL_BONUS } from '../aiScoring.ts';
import { getHealTargets, getStaves, isWounded } from '../healing.ts';
import { canUseSkill, getUnitSkills, isSupportSkill, isSwapSkill, isTileSkill, type Skill } from '../skills.ts';
import { areAllied } from '../teams.ts';
import type { Unit } from '../Unit.ts';
import { applyCommand, getSkillTargets, type BattleCommand, type BattleEvent } from './commands.ts';
import type { BattleState } from './state.ts';

export const SKILL_ACT_WEIGHTS = Object.freeze({
  // Per point of damage dealt to a foe (capped at its health).
  damage: 1,
  // Per foe felled: as much as an attack's sure kill (aiScoring.ts).
  kill: KILL_BONUS,
  // Per point of damage dealt to its own side (friendly fire, recoil, a
  // shoved foe slammed into an ally).
  allyDamage: 1.5,
  // Per unit of its own side felled.
  allyLost: 60,
  // Per point of HP healed, doubled for an ally under half health.
  heal: 1.2,
  // Per debuff left on a foe, and buff given to an ally, it didn't have.
  debuff: 4,
  buff: 3,
  // Per point of a mine's damage, when a foe is within MINE_REACH of it.
  mine: 0.5,
  // Per point of mana spent.
  mana: 0.5,
});

export type SkillActWeights = typeof SKILL_ACT_WEIGHTS;

// How near a foe has to be for a mine to be worth laying.
export const MINE_REACH = 3;

export interface SkillAct {
  // The skill or heal, used from the tile the unit moved to.
  command: BattleCommand;
  score: number;
}

export interface SkillActOptions {
  // Who an offensive skill may be aimed at (a Taunted unit's choice is
  // narrowed, see getTargetFilter in ai.ts); any foe by default.
  isTarget?: (unitId: string) => boolean;
  weights?: SkillActWeights;
  // Whether staff heals are among the acts (true by default).
  staves?: boolean;
}

// Whether the unit could use a skill or a staff at all: it knows a skill it
// can afford (other than the ones the AI leaves alone) or carries a staff.
export function hasSkillActs(unit: Unit): boolean {
  return getUsableSkills(unit).length > 0 || getStaves(unit.items).length > 0;
}

// Every skill and staff use the unit `unitId` could make after moving to
// `tile` (its own tile to stay put), each scored. Empty when it can't get
// there or has nothing to use.
export function getSkillActs(
  state: BattleState,
  unitId: string,
  tile: Point,
  { isTarget, weights = SKILL_ACT_WEIGHTS, staves = true }: SkillActOptions = {},
): SkillAct[] {
  const unit = state.units.get(unitId);
  const from = findUnit(state.grid, unitId);
  if (!unit || !from || !hasSkillActs(unit)) return [];
  // What it could aim at from there, found on the map with it moved
  // there, before anything is played out.
  const grid = isSameTile(from, tile) ? state.grid : moveUnit(state.grid, from, tile);
  const aimable = isTarget ?? ((otherId: string) => isFoe(state, unit, otherId));
  const commands: { command: BattleCommand; manaCost: number }[] = [];
  for (const skill of getUsableSkills(unit)) {
    for (const target of getSkillTargets(grid, state.units, unitId, tile, skill)) {
      // An offensive skill goes at a unit the AI may target.
      const offensive = !isSupportSkill(skill) && !isTileSkill(skill);
      if (offensive && target.unitId !== unitId && !aimable(target.unitId)) continue;
      commands.push({
        command: { type: 'skill', unitId, skillId: skill.id, target: point(target) },
        manaCost: skill.manaCost,
      });
    }
  }
  if (staves) {
    for (const { staff, index } of getStaves(unit.items)) {
      const canHeal = (otherId: string) => {
        const other = state.units.get(otherId);
        return otherId !== unitId && !!other && areAllied(other.team, unit.team) && isWounded(other);
      };
      for (const target of getHealTargets(grid, tile, staff, canHeal)) {
        commands.push({ command: { type: 'heal', unitId, staffIndex: index, target: point(target) }, manaCost: 0 });
      }
    }
  }
  if (commands.length === 0) return [];

  // Only its own side's mines are known to it.
  const known: BattleState = { ...state, mines: state.mines.filter((mine) => areAllied(mine.team, unit.team)) };
  const moved = isSameTile(from, tile) ? known : placeAt(known, unitId, grid, getDistance(from, tile));
  const acts: SkillAct[] = [];
  for (const { command, manaCost } of commands) {
    const score = scoreAct(moved, unitId, command, weights);
    if (score !== null) acts.push({ command, score: score - weights.mana * manaCost });
  }
  return acts;
}

// The skills the AI would use: the ones the unit knows and can afford,
// except a swap or a breach, whose worth it can't judge.
function getUsableSkills(unit: Unit): Skill[] {
  return getUnitSkills(unit).filter((skill) => canUseSkill(unit, skill) && !isSwapSkill(skill) && !skill.breach);
}

// What `command` is worth, played out on `state` (see weighEvents), or
// null if the battle won't take it.
function scoreAct(state: BattleState, unitId: string, command: BattleCommand, weights: SkillActWeights): number | null {
  try {
    const { state: after, events } = applyCommand(state, command);
    return weighEvents(state, after, unitId, events, weights);
  } catch {
    return null;
  }
}

// Weighs what the unit's act did, from its events up to the unit being
// done (what follows, a new phase starting, isn't the act's doing).
export function weighEvents(
  before: BattleState,
  after: BattleState,
  unitId: string,
  events: readonly BattleEvent[],
  weights: SkillActWeights = SKILL_ACT_WEIGHTS,
): number {
  const user = before.units.get(unitId)!;
  const health = new Map([...before.units].map(([id, unit]) => [id, unit.health]));
  const ours = (id: string) => {
    const unit = before.units.get(id);
    return !!unit && areAllied(unit.team, user.team);
  };
  let score = 0;
  // A unit's health went to `now`: damage to a foe counts for, to its own
  // side against, and a heal for (twice over for one under half health).
  const setHealth = (id: string, now: number) => {
    const was = health.get(id);
    if (was === undefined) return;
    health.set(id, now);
    const change = now - was;
    if (change < 0) score += ours(id) ? weights.allyDamage * change : -weights.damage * change;
    if (change > 0 && ours(id)) {
      const unit = before.units.get(id)!;
      score += weights.heal * change * (was < unit.maxHealth / 2 ? 2 : 1);
    }
  };
  for (const event of events) {
    if (event.type === 'unit-done') break;
    switch (event.type) {
      case 'skill':
        setHealth(event.targetId, event.health);
        break;
      case 'pushed':
        setHealth(event.push.unitId, event.health);
        if (event.push.collidedId && event.collidedHealth !== null) {
          setHealth(event.push.collidedId, event.collidedHealth);
        }
        break;
      case 'recoil':
        setHealth(event.unitId, event.health);
        break;
      case 'healed': {
        const was = health.get(event.targetId);
        if (was !== undefined) setHealth(event.targetId, was + event.amount);
        break;
      }
      case 'recovered':
        if (event.stat === 'health') setHealth(event.unitId, (health.get(event.unitId) ?? 0) + event.amount);
        break;
      case 'defeated':
        // What was left of it (a drowned unit's whole health) goes too.
        setHealth(event.unitId, 0);
        score += ours(event.unitId) ? -weights.allyLost : weights.kill;
        break;
      case 'status': {
        if (before.units.get(event.targetId)?.statuses.includes(event.status)) break;
        score += ours(event.targetId) ? weights.buff : weights.debuff;
        break;
      }
      case 'mine-laid': {
        const mine = after.mines.find((other) => isSameTile(other, event.at));
        const near = [...after.units].some(([id]) => {
          const tile = isFoe(after, user, id) ? findUnit(after.grid, id) : null;
          return tile !== null && getDistance(tile, event.at) <= MINE_REACH;
        });
        if (mine && near) score += weights.mine * mine.damage;
        break;
      }
    }
  }
  return score;
}

// `state` with the unit `unitId` set down on `grid` (the map with it
// moved), as if it had walked `walked` tiles there: quicker to play an act
// out from than a real move, and the same but for a mine on the way (which
// it doesn't know of anyway).
function placeAt(state: BattleState, unitId: string, grid: BattleState['grid'], walked: number): BattleState {
  const unit = state.units.get(unitId)!;
  // Only a charge skill reads how far it walked.
  if (!getUsableSkills(unit).some((skill) => skill.chargeMight) || unit.movedTiles === walked) {
    return { ...state, grid };
  }
  const walker = unit.clone();
  walker.movedTiles = walked;
  return { ...state, grid, units: new Map(state.units).set(unitId, walker) };
}

function isFoe(state: BattleState, unit: Unit, otherId: string): boolean {
  const other = state.units.get(otherId);
  return !!other && !areAllied(other.team, unit.team);
}

function point({ x, y }: Point): Point {
  return { x, y };
}
