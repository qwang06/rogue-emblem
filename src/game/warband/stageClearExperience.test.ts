import { describe, expect, it } from 'vitest';
import { scaleExperience } from '../experience.ts';
import { Soldier } from '../Soldier.ts';
import type { Unit } from '../Unit.ts';
import { VILLAGER_EXPERIENCE_RATE, Villager } from '../Villager.ts';
import { createRun, type RunState, type UnitSnapshot } from './run.ts';
import { applyStageClearExperience, getStageClearExperience } from './stageClearExperience.ts';

function newRun(): RunState {
  return createRun(
    7,
    new Map<string, Unit>([
      ['alden', new Soldier({ name: 'Alden', team: 'player' })],
      ['cato', new Villager({ name: 'Cato', team: 'player' })],
    ]),
  );
}

function withUnit(run: RunState, id: string, changes: Partial<UnitSnapshot>): RunState {
  return { ...run, roster: run.roster.map((unit) => (unit.id === id ? { ...unit, ...changes } : unit)) };
}

describe('getStageClearExperience', () => {
  it('grows with the stage for a unit at the stage level', () => {
    expect(getStageClearExperience(1, 1)).toBe(22);
    expect(getStageClearExperience(10, 10)).toBe(40);
    expect(getStageClearExperience(30, 30)).toBe(80);
  });

  it('pays more to a unit below the stage and less to one above it', () => {
    expect(getStageClearExperience(15, 11)).toBe(80);
    expect(getStageClearExperience(15, 19)).toBe(20);
  });

  it('never falls under 20% of the base', () => {
    expect(getStageClearExperience(1, 20)).toBe(4);
    expect(getStageClearExperience(10, 40)).toBe(8);
  });
});

describe('applyStageClearExperience', () => {
  it('gives clear XP only to the units that fought', () => {
    const before = newRun();
    const { run } = applyStageClearExperience(before, 1, ['alden']);
    expect(run.roster[0]).toMatchObject({ level: 1, experience: 22 });
    expect(run.roster[1]).toBe(before.roster[1]);
  });

  it("scales the clear XP by the unit's XP rate", () => {
    const { run } = applyStageClearExperience(newRun(), 1, ['cato']);
    expect(run.roster[1].experience).toBe(scaleExperience(22, VILLAGER_EXPERIENCE_RATE));
  });

  it('adds to XP earned in the battle and reports the level ups', () => {
    const before = withUnit(newRun(), 'alden', { experience: 40 });
    const { run, levelUps } = applyStageClearExperience(before, 1, ['alden']);
    expect(run.roster[0]).toMatchObject({ level: 2, experience: 12 });
    expect(levelUps.map((entry) => [entry.name, entry.levelUp.level])).toEqual([['Alden', 2]]);
  });

  it('leaves the run as it is when no roster unit fought', () => {
    const run = newRun();
    expect(applyStageClearExperience(run, 3, [])).toEqual({ run, levelUps: [] });
    expect(applyStageClearExperience(run, 3, ['someone-else'])).toEqual({ run, levelUps: [] });
  });

  it('rolls the same stat gains for the same run and stage', () => {
    const before = withUnit(newRun(), 'alden', { experience: 45 });
    expect(applyStageClearExperience(before, 2, ['alden', 'cato'])).toEqual(
      applyStageClearExperience(before, 2, ['alden', 'cato']),
    );
  });

  it('leaves the run passed in alone', () => {
    const run = newRun();
    applyStageClearExperience(run, 1, ['alden', 'cato']);
    expect(run.roster.every((unit) => unit.experience === 0)).toBe(true);
  });
});
