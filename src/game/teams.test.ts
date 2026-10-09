import { describe, expect, it } from 'vitest';
import { getTeamUnitIds, isAllyOf, isHostileTo } from './teams.ts';
import type { Team } from './turns.ts';

const units = new Map<string, { team: Team }>([
  ['p1', { team: 'player' }],
  ['e1', { team: 'enemy' }],
  ['p2', { team: 'player' }],
  ['e2', { team: 'enemy' }],
]);

describe('getTeamUnitIds', () => {
  it("lists a team's units in registry order", () => {
    expect(getTeamUnitIds(units, 'player')).toEqual(['p1', 'p2']);
    expect(getTeamUnitIds(units, 'enemy')).toEqual(['e1', 'e2']);
  });

  it('is empty for a team with no units left, or an empty registry', () => {
    expect(getTeamUnitIds(new Map([['p1', { team: 'player' }]]), 'enemy')).toEqual([]);
    expect(getTeamUnitIds(new Map(), 'player')).toEqual([]);
  });
});

describe('isAllyOf', () => {
  it('is true for units on the same team, including the unit itself', () => {
    expect(isAllyOf(units, 'player', 'p2')).toBe(true);
    expect(isAllyOf(units, 'player', 'p1')).toBe(true);
  });

  it('is false for the other team', () => {
    expect(isAllyOf(units, 'player', 'e1')).toBe(false);
    expect(isAllyOf(units, 'enemy', 'p1')).toBe(false);
  });

  it('is false for an id not in the registry (e.g. a removed unit)', () => {
    expect(isAllyOf(units, 'player', 'gone')).toBe(false);
  });
});

describe('isHostileTo', () => {
  it('is true for units on another team, from either side', () => {
    expect(isHostileTo(units, 'player', 'e1')).toBe(true);
    expect(isHostileTo(units, 'enemy', 'p2')).toBe(true);
  });

  it('is false for allies and the unit itself', () => {
    expect(isHostileTo(units, 'player', 'p2')).toBe(false);
    expect(isHostileTo(units, 'enemy', 'e1')).toBe(false);
  });

  it('is false for an id not in the registry', () => {
    expect(isHostileTo(units, 'player', 'gone')).toBe(false);
  });

  it('is never true for both allies and hostiles at once', () => {
    for (const team of ['player', 'enemy'] as const) {
      for (const unitId of [...units.keys(), 'gone']) {
        expect(isAllyOf(units, team, unitId) && isHostileTo(units, team, unitId)).toBe(false);
      }
    }
  });
});
