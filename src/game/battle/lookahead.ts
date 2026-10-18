// Lookahead for the player's battle AI (playerAI.ts): given a few candidate
// actions, plays each one out with sampled dice (the rest of the player
// phase forfeited, then the whole enemy phase) and keeps the one whose
// outcomes average best. The heuristic guesses from the forecast; this
// checks what the enemy actually does next, e.g. that a tile is only safe
// if the attack before it kills, or that a foe left alive takes a unit
// down. It never reads the battle's own dice: every play-out gets seeds of
// its own, the same seeds for every candidate so they're compared on the
// same luck. Pure: reads a state and returns one of the candidates.

import { TURN_LIMIT } from '../objectives.ts';
import { planNextTurn } from './ai.ts';
import { applyCommand, type BattleCommand } from './commands.ts';
import type { BattleState } from './state.ts';

// What a play-out's end state is worth against the state it started from.
export const LOOKAHEAD_WEIGHTS = Object.freeze({
  // Winning or losing the battle outright.
  outcome: 10000,
  // Per point of damage dealt to an enemy.
  damageDealt: 1,
  // Extra per point of damage dealt to the boss on a boss stage.
  bossDamage: 1,
  // Per enemy defeated.
  kill: 40,
  // Per point of health a player unit lost (gained back, for a heal).
  damageTaken: 0.4,
  // Per player unit that fell.
  fallen: 80,
});

export type LookaheadWeights = typeof LOOKAHEAD_WEIGHTS;

export interface LookaheadOptions {
  // How many of the heuristic's best plans are played out.
  candidates: number;
  // How many times each is played out, with different dice.
  samples: number;
  // The turn from which a play-out still undecided counts against the
  // player: it loses a growing share of `outcome`, all of it by the
  // battle's TURN_LIMIT, so a stalemate (a boss nobody dares attack) is
  // broken by a risky attack before running out of turns loses it anyway.
  patience: number;
  weights: LookaheadWeights;
}

export const LOOKAHEAD: LookaheadOptions = Object.freeze({
  candidates: 6,
  samples: 4,
  patience: 20,
  weights: LOOKAHEAD_WEIGHTS,
});

export interface LookaheadCandidate {
  commands: readonly BattleCommand[];
  // What the plan's end tile is worth that a play-out can't see (progress
  // toward the goal, cohesion), added to its average.
  position: number;
}

// Plays the rest of the player phase in a play-out: the next unit's
// action, or nothing to end the phase.
export type PhasePlanner = (state: BattleState) => readonly BattleCommand[];

const forfeit: PhasePlanner = () => [];

// Play-outs stop after this many commands, in case a phase never ends.
const MAX_STEPS = 200;

// Of `candidates` for the player's next action in `state`, the one whose
// play-outs average best (the first, on a tie).
export function pickByLookahead<C extends LookaheadCandidate>(
  state: BattleState,
  candidates: readonly C[],
  options: LookaheadOptions = LOOKAHEAD,
  playerPhase: PhasePlanner = forfeit,
): C {
  if (candidates.length === 0) throw new Error('No candidates to look ahead from');
  const seeds = getSampleSeeds(state, options.samples);
  let best = candidates[0];
  let bestScore = -Infinity;
  for (const candidate of candidates) {
    let total = 0;
    for (const seed of seeds) {
      total += scorePlayOut(state, playOut(state, candidate.commands, seed, playerPhase), options);
    }
    const score = candidate.position + total / seeds.length;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

// The battle after `commands`, the rest of the player phase played by
// `playerPhase` (forfeited, by default) and the enemy phase by its AI, its dice seeded by `seed`: where it
// stands when the player is next to move (or once decided).
export function playOut(
  state: BattleState,
  commands: readonly BattleCommand[],
  seed: number,
  playerPhase: PhasePlanner = forfeit,
): BattleState {
  let current: BattleState = { ...state, rngState: seed >>> 0 };
  for (const command of commands) current = applyCommand(current, command).state;
  const turn = current.turnState?.turn;
  for (let step = 0; step < MAX_STEPS && !current.outcome && current.turnState; step++) {
    const { team } = current.turnState;
    if (team === 'player' && current.turnState.turn !== turn) break;
    const planned = team === 'player' ? playerPhase(current) : planNextTurn(current);
    const next: readonly BattleCommand[] = planned.length > 0 ? planned : [{ type: 'end-phase' }];
    for (const command of next) current = applyCommand(current, command).state;
  }
  return current;
}

// How much better `after` stands than `before` for the player: the
// outcome if decided, damage dealt and taken, units lost on each side, and
// the stall the battle is drifting toward if it's dragged on.
export function scorePlayOut(
  before: BattleState,
  after: BattleState,
  { patience, weights }: Pick<LookaheadOptions, 'patience' | 'weights'> = LOOKAHEAD,
): number {
  if (after.outcome) return after.outcome === 'victory' ? weights.outcome : -weights.outcome;
  const bossId = before.objective.kind === 'boss' ? before.objective.unitId : null;
  const turn = after.turnState?.turn ?? 0;
  const timed = before.objective.kind !== 'survive';
  const stall = timed ? Math.min(1, Math.max(0, (turn - patience) / Math.max(1, TURN_LIMIT - patience))) : 0;
  let score = -weights.outcome * stall;
  for (const [unitId, unit] of before.units) {
    if (!unit.isAlive()) continue;
    const now = after.units.get(unitId);
    const health = now?.isAlive() ? now.health : 0;
    const lost = unit.health - health;
    if (unit.team === 'player') {
      score -= weights.damageTaken * lost;
      if (health === 0) score -= weights.fallen;
    } else {
      score += weights.damageDealt * lost;
      if (unitId === bossId) score += weights.bossDamage * lost;
      if (health === 0) score += weights.kill;
    }
  }
  return score;
}

// `count` seeds for play-outs from `state`, made from where the battle
// stands (turn, phase progress) rather than its dice.
function getSampleSeeds(state: BattleState, count: number): number[] {
  const turn = state.turnState?.turn ?? 0;
  const acted = state.turnState?.done.length ?? 0;
  return Array.from({ length: Math.max(1, count) }, (_, sample) => mix(turn * 0x10001 + acted * 0x101 + sample));
}

// A 32-bit integer hash (from MurmurHash3's finalizer), to spread nearby
// numbers into unrelated seeds.
function mix(value: number): number {
  let h = value >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
