import { describe, expect, it } from 'vitest';
import { Archer } from '../Archer.ts';
import { Soldier } from '../Soldier.ts';
import type { Unit } from '../Unit.ts';
import { Warrior } from '../Warrior.ts';
import { advanceStage, applyBattleResult, createRun, restoreRoster, type RunState } from './run.ts';
import { formatPlayTime, summarizeRun } from './runSummary.ts';

function startingRun(): RunState {
  return createRun(
    7,
    new Map<string, Unit>([
      ['alden', new Soldier({ name: 'Alden', team: 'player' })],
      ['bryn', new Archer({ name: 'Bryn', team: 'player' })],
      ['cato', new Warrior({ name: 'Cato', team: 'player' })],
    ]),
  );
}

// Stage 1: Alden fells two and Bryn one. Stage 2, a boss: Bryn fells
// three and falls.
function playedRun(): RunState {
  const start = startingRun();
  const first = advanceStage(
    applyBattleResult(start, {
      units: restoreRoster(start),
      kills: new Map([
        ['alden', 2],
        ['bryn', 1],
      ]),
      elapsedMs: 60_000,
    }),
  );
  const units = restoreRoster(first);
  units.get('bryn')!.takeDamage(99);
  return applyBattleResult(first, {
    units,
    kills: new Map([['bryn', 3]]),
    bossDefeated: true,
    elapsedMs: 125_000,
  });
}

describe('summarizeRun', () => {
  it('recaps a fallen run: stages before the last cleared, kills, time and bosses', () => {
    const summary = summarizeRun(playedRun(), false);
    expect(summary.won).toBe(false);
    expect(summary.stage).toBe(2);
    expect(summary.stagesCleared).toBe(1);
    expect(summary.bossesDefeated).toBe(1);
    expect(summary.kills).toBe(6);
    expect(summary.playMs).toBe(185_000);
  });

  it('counts the last stage as cleared when the run was won', () => {
    expect(summarizeRun(playedRun(), true).stagesCleared).toBe(2);
  });

  it('names the unit with the most kills as MVP, fallen or not', () => {
    expect(summarizeRun(playedRun(), false).mvp).toEqual({
      id: 'bryn',
      name: 'Bryn',
      classId: 'archer',
      level: 1,
      kills: 4,
    });
  });

  it('breaks an MVP tie for the living, earliest on the roster', () => {
    const start = startingRun();
    const run = applyBattleResult(start, {
      units: restoreRoster(start),
      kills: new Map([
        ['cato', 2],
        ['alden', 2],
      ]),
    });
    expect(summarizeRun(run, false).mvp?.id).toBe('alden');
  });

  it('has no MVP when nobody felled anything', () => {
    expect(summarizeRun(startingRun(), false).mvp).toBeNull();
  });

  it('remembers each fallen unit with the stage it fell on', () => {
    const summary = summarizeRun(playedRun(), false);
    expect(summary.memorial).toEqual([{ id: 'bryn', name: 'Bryn', classId: 'archer', level: 1, kills: 4, stage: 2 }]);
    expect(summary.survivors.map((unit) => unit.id)).toEqual(['alden', 'cato']);
  });

  it("leaves a fallen unit's stage unknown in a run kept without a chronicle", () => {
    const run = playedRun();
    const { chronicle: _, ...old } = run;
    const summary = summarizeRun(old, false);
    expect(summary.memorial[0].stage).toBeNull();
    expect(summary.mvp).toBeNull();
    expect(summary.playMs).toBe(0);
  });

  it('lists the relics held, frozen', () => {
    const summary = summarizeRun({ ...playedRun(), relics: ['lucky-coin'] }, false);
    expect(summary.relics).toEqual(['lucky-coin']);
    expect(Object.isFrozen(summary)).toBe(true);
    expect(Object.isFrozen(summary.memorial)).toBe(true);
  });
});

describe('formatPlayTime', () => {
  it.each([
    [0, '0:00'],
    [5_999, '0:05'],
    [65_000, '1:05'],
    [3_599_000, '59:59'],
    [3_729_000, '1:02:09'],
    [-10, '0:00'],
  ])('shows %i ms as %s', (ms, text) => {
    expect(formatPlayTime(ms)).toBe(text);
  });
});
