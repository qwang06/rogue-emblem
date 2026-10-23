import { describe, expect, it } from 'vitest';
import { Soldier } from '../Soldier.ts';
import type { Unit } from '../Unit.ts';
import { Warrior } from '../Warrior.ts';
import { createRun, type RunState, type UnitSnapshot } from './run.ts';
import { applyStageClearExperience, getStageClearLevel } from './stageClearExperience.ts';

function newRun(): RunState {
  return createRun(
    7,
    new Map<string, Unit>([
      ['alden', new Soldier({ name: 'Alden', team: 'player' })],
      ['cato', new Warrior({ name: 'Cato', team: 'player' })],
    ]),
  );
}

function withUnit(run: RunState, id: string, changes: Partial<UnitSnapshot>): RunState {
  return { ...run, roster: run.roster.map((unit) => (unit.id === id ? { ...unit, ...changes } : unit)) };
}

describe('getStageClearLevel', () => {
  it('guarantees level 2 for stage 1 only', () => {
    expect(getStageClearLevel(1)).toBe(2);
    expect(getStageClearLevel(2)).toBeNull();
    expect(getStageClearLevel(10)).toBeNull();
  });
});

describe('applyStageClearExperience', () => {
  it('takes every level 1 unit to level 2 with 0 XP and reports each level up', () => {
    const { run, levelUps } = applyStageClearExperience(newRun(), 1);
    expect(run.roster.map((unit) => [unit.level, unit.experience])).toEqual([
      [2, 0],
      [2, 0],
    ]);
    expect(levelUps.map((entry) => [entry.name, entry.levelUp.level])).toEqual([
      ['Alden', 2],
      ['Cato', 2],
    ]);
  });

  it('tops up XP a unit earned in the battle rather than adding to it', () => {
    const { run } = applyStageClearExperience(withUnit(newRun(), 'alden', { experience: 35 }), 1);
    expect(run.roster[0]).toMatchObject({ level: 2, experience: 0 });
  });

  it('gives nothing to a unit that already levelled in the battle', () => {
    const before = withUnit(newRun(), 'cato', { level: 2, experience: 30 });
    const { run, levelUps } = applyStageClearExperience(before, 1);
    expect(run.roster[1]).toBe(before.roster[1]);
    expect(levelUps.map((entry) => entry.name)).toEqual(['Alden']);
  });

  it('leaves the run as it is when everyone is already there, or on a later stage', () => {
    const leveled = applyStageClearExperience(newRun(), 1).run;
    expect(applyStageClearExperience(leveled, 1)).toEqual({ run: leveled, levelUps: [] });
    const run = newRun();
    expect(applyStageClearExperience(run, 2)).toEqual({ run, levelUps: [] });
  });

  it('rolls the same stat gains for the same run and stage', () => {
    expect(applyStageClearExperience(newRun(), 1)).toEqual(applyStageClearExperience(newRun(), 1));
  });

  it('leaves the run passed in alone', () => {
    const run = newRun();
    applyStageClearExperience(run, 1);
    expect(run.roster.every((unit) => unit.level === 1)).toBe(true);
  });
});
