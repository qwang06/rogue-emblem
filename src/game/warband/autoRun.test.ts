import { describe, expect, it } from 'vitest';
import { DEFAULT_CONTENT } from '../battleSetup.ts';
import { BASELINE_POLICY, playRun, replayRun, startRun, type RunPolicy, type RunStart } from './autoRun.ts';

const START: RunStart = { seed: 11, classId: 'soldier', name: 'Alden' };

describe('startRun', () => {
  it('starts on the relic pick, at home on its realm, with a lone unit of the class', () => {
    const session = startRun(START);
    expect(session.phase).toBe('relic');
    expect(session.run.route?.visited).toEqual(['0-0']);
    expect(session.run.roster.map((unit) => [unit.name, unit.classId])).toEqual([['Alden', 'soldier']]);
  });
});

describe('playRun', () => {
  const played = playRun(START, BASELINE_POLICY, { maxStages: 3 });

  it('fights site after site, deeper each time, until the warband falls or the stage limit', () => {
    const stages = played.stages.map((record) => record.stage);
    expect(stages.length).toBeGreaterThan(0);
    expect(stages.length).toBeLessThanOrEqual(3);
    expect(stages[0]).toBe(1);
    stages.slice(1).forEach((stage, i) => expect(stage).toBeGreaterThan(stages[i]));
    if (played.end === 'fallen') expect(played.session.phase).toBe('over');
    else expect(played.session.run.stage).toBeGreaterThan(stages.at(-1)!);
  });

  it('wins the first stage, a quick fight for the lone starting unit', () => {
    expect(played.stages[0]).toMatchObject({
      stage: 1,
      objective: 'rout',
      outcome: 'victory',
      stalled: false,
      losses: 0,
    });
  });

  it('writes down a battle per stage and the commands between them', () => {
    const battles = played.script.steps.filter((step) => step.type === 'battle');
    expect(battles).toHaveLength(played.stages.length);
    expect(played.script.steps.slice(0, 3).map((step) => step.type)).toEqual(['pick-relic', 'travel', 'battle']);
    expect(played.script.steps[0]).toEqual({ type: 'pick-relic', index: 0 });
    // Stage 1's clear levels the lone unit up, so a boon comes before the reward.
    expect(played.script.steps[3].type).toBe('pick-boon');
    expect(played.script.steps[4].type).toBe('pick-reward');
    expect(played.session.run.relics.length).toBeGreaterThan(0);
  });

  it('plays the same run every time for a start', () => {
    expect(playRun(START, BASELINE_POLICY, { maxStages: 3 }).script).toEqual(played.script);
  });

  it('stops when the run is won on the final stage', () => {
    const content = { ...DEFAULT_CONTENT, regions: { ...DEFAULT_CONTENT.regions, finalStage: 1 } };
    const won = playRun(START, BASELINE_POLICY, { maxStages: 3, content });
    expect(won.end).toBe('won');
    expect(won.session.phase).toBe('won');
    expect(won.stages.map((record) => record.stage)).toEqual([1]);
  });

  it('marches on from a camp that never would', () => {
    const lingering: RunPolicy = { ...BASELINE_POLICY, camp: () => ({ type: 'buy', itemId: 'nothing' }) };
    expect(() => playRun(START, lingering, { maxStages: 2 })).toThrow(/merchant/);
    const idle: RunPolicy = { ...BASELINE_POLICY, camp: () => ({ type: 'skip-reward' }) };
    expect(() => playRun(START, idle, { maxStages: 2, maxCampCommands: 0 })).not.toThrow();
  });
});

describe('replayRun', () => {
  it('replays a run from its script, through JSON', () => {
    const played = playRun({ ...START, seed: 5 }, BASELINE_POLICY, { maxStages: 3 });
    const script = JSON.parse(JSON.stringify(played.script));
    const replayed = replayRun(script);
    expect(replayed.session).toEqual(played.session);
    expect(replayed.stages).toEqual(played.stages);
  });

  it('refuses a step that does not fit the run', () => {
    expect(() => replayRun({ start: START, steps: [{ type: 'march' }] })).toThrow(/relic/);
    expect(() => replayRun({ start: START, steps: [{ type: 'battle', commands: [] }] })).toThrow(/battle/);
  });
});
