import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OBJECTIVE,
  describeObjective,
  getObjectiveOutcome,
  getObjectiveStatus,
  isPastTurnLimit,
  ROUT,
  TURN_LIMIT,
  type BattleSnapshot,
  type Objective,
} from './objectives.ts';
import type { Point } from './grid.ts';
import type { Team } from './turns.ts';

const SEIZE: Objective = { kind: 'seize', tile: { x: 3, y: 0 } };
const BOSS: Objective = { kind: 'boss', unitId: 'boss', name: 'Goblin Chief' };
const SURVIVE: Objective = { kind: 'survive', turns: 4 };

const unit = (unitId: string, team: Team, position: Point | null = { x: 0, y: 7 }, alive = true) => ({
  unitId,
  team,
  alive,
  position,
});

// A battle on turn `turn` with a living player unit and two enemies,
// one of them the boss, plus `extra` units.
const battle = (turn = 1, ...extra: BattleSnapshot['units']): BattleSnapshot => ({
  turn,
  units: [
    unit('hero', 'player'),
    unit('boss', 'enemy', { x: 3, y: 0 }),
    unit('grunt', 'enemy', { x: 1, y: 1 }),
    ...extra,
  ],
});

describe('objectives', () => {
  it('defaults to a rout', () => {
    expect(DEFAULT_OBJECTIVE).toBe(ROUT);
    expect(ROUT).toEqual({ kind: 'rout' });
  });

  it('describes each kind, every one lost when all your units fall, all but survive at the turn limit', () => {
    const defeat = 'All your units fall, or turn 40 ends';
    expect(describeObjective(ROUT)).toEqual({ goal: 'Defeat all enemies', defeat });
    expect(describeObjective(SEIZE)).toEqual({ goal: 'Seize the marked tile', defeat });
    expect(describeObjective(BOSS)).toEqual({ goal: 'Defeat Goblin Chief', defeat });
    expect(describeObjective(SURVIVE)).toEqual({ goal: 'Survive 4 turns', defeat: 'All your units fall' });
    expect(describeObjective({ kind: 'survive', turns: 1 }).goal).toBe('Survive 1 turn');
  });

  it('returns frozen text', () => {
    expect(Object.isFrozen(describeObjective(ROUT))).toBe(true);
    expect(Object.isFrozen(describeObjective(SURVIVE))).toBe(true);
  });
});

describe('getObjectiveStatus', () => {
  it('names the kind in a word and counts the turn out of the turn limit', () => {
    expect(getObjectiveStatus(ROUT, 3)).toBe('Rout 3/40');
    expect(getObjectiveStatus(SEIZE, 3)).toBe('Seize 3/40');
    expect(getObjectiveStatus(BOSS, 40)).toBe('Boss 40/40');
    expect(getObjectiveStatus(ROUT, 41)).toBe('Rout 40/40');
  });

  it('counts a survive objective’s turns, never past the last', () => {
    expect(getObjectiveStatus(SURVIVE, 1)).toBe('Survive 1/4');
    expect(getObjectiveStatus(SURVIVE, 4)).toBe('Survive 4/4');
    expect(getObjectiveStatus(SURVIVE, 5)).toBe('Survive 4/4');
  });
});

describe('getObjectiveOutcome', () => {
  it('does not let a guest keep the warband alive or seize a tile', () => {
    const guest = unit('guest-recruit', 'guest', { x: 3, y: 0 });
    const lost = { turn: 1, units: [unit('hero', 'player', null, false), guest, unit('foe', 'enemy')] };
    expect(getObjectiveOutcome(ROUT, lost)).toBe('defeat');
    expect(getObjectiveOutcome(SEIZE, battle(1, guest))).toBeNull();
  });
  it('is undecided while both sides stand and the objective is unmet', () => {
    for (const objective of [ROUT, SEIZE, BOSS, SURVIVE]) {
      expect(getObjectiveOutcome(objective, battle())).toBeNull();
    }
  });

  it('is a defeat for every kind once all player units fall, even on a win', () => {
    const lost = (turn: number): BattleSnapshot => ({
      turn,
      units: [unit('hero', 'player', { x: 3, y: 0 }, false), unit('grunt', 'enemy')],
    });
    for (const objective of [ROUT, SEIZE, BOSS, SURVIVE]) {
      expect(getObjectiveOutcome(objective, lost(9))).toBe('defeat');
    }
    expect(getObjectiveOutcome(ROUT, { turn: 1, units: [] })).toBe('defeat');
  });

  it('is a victory for every kind once every enemy falls', () => {
    const routed: BattleSnapshot = { turn: 1, units: [unit('hero', 'player')] };
    for (const objective of [ROUT, SEIZE, BOSS, SURVIVE]) {
      expect(getObjectiveOutcome(objective, routed)).toBe('victory');
    }
  });

  it('is a seize victory once a living player unit stands on the tile', () => {
    const onTile: BattleSnapshot = {
      turn: 2,
      units: [unit('hero', 'player', { x: 3, y: 0 }), unit('grunt', 'enemy', { x: 1, y: 1 })],
    };
    expect(getObjectiveOutcome(SEIZE, onTile)).toBe('victory');
    expect(getObjectiveOutcome(ROUT, onTile)).toBeNull();
  });

  it('is no seize while only an enemy, a fallen unit or nobody holds the tile', () => {
    expect(getObjectiveOutcome(SEIZE, battle())).toBeNull(); // the boss stands on it
    expect(getObjectiveOutcome(SEIZE, battle(1, unit('ally', 'player', { x: 3, y: 0 }, false)))).toBeNull();
    expect(getObjectiveOutcome(SEIZE, battle(1, unit('ally', 'player', null)))).toBeNull();
  });

  it('is a boss victory once the boss falls or is gone, with other enemies left', () => {
    const fallen: BattleSnapshot = {
      turn: 1,
      units: [unit('hero', 'player'), unit('boss', 'enemy', null, false), unit('grunt', 'enemy')],
    };
    expect(getObjectiveOutcome(BOSS, fallen)).toBe('victory');
    const gone: BattleSnapshot = { turn: 1, units: [unit('hero', 'player'), unit('grunt', 'enemy')] };
    expect(getObjectiveOutcome(BOSS, gone)).toBe('victory');
    expect(getObjectiveOutcome(ROUT, gone)).toBeNull();
  });

  it('is a survive victory only once the turn passes the turns to survive', () => {
    expect(getObjectiveOutcome(SURVIVE, battle(1))).toBeNull();
    expect(getObjectiveOutcome(SURVIVE, battle(4))).toBeNull();
    expect(getObjectiveOutcome(SURVIVE, battle(5))).toBe('victory');
    expect(getObjectiveOutcome({ kind: 'survive', turns: 1 }, battle(2))).toBe('victory');
  });

  it('is a defeat for every kind but survive once the turn passes the turn limit undecided', () => {
    expect(TURN_LIMIT).toBe(40);
    for (const objective of [ROUT, SEIZE, BOSS]) {
      expect(getObjectiveOutcome(objective, battle(TURN_LIMIT))).toBeNull();
      expect(getObjectiveOutcome(objective, battle(TURN_LIMIT + 1))).toBe('defeat');
    }
    expect(getObjectiveOutcome({ kind: 'survive', turns: 50 }, battle(TURN_LIMIT + 1))).toBeNull();
  });

  it('lets a win decided on the last turn stand over the turn limit', () => {
    const routed: BattleSnapshot = { turn: TURN_LIMIT + 1, units: [unit('hero', 'player')] };
    expect(getObjectiveOutcome(ROUT, routed)).toBe('victory');
  });
});

describe('isPastTurnLimit', () => {
  it('is true past TURN_LIMIT for every kind but survive', () => {
    expect(isPastTurnLimit(ROUT, TURN_LIMIT)).toBe(false);
    expect(isPastTurnLimit(ROUT, TURN_LIMIT + 1)).toBe(true);
    expect(isPastTurnLimit(SURVIVE, 99)).toBe(false);
  });
});
