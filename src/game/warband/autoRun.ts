// Plays a whole Warband run without the game running: a policy decides the
// player's battles, reward picks and camp, the enemy AI (battle/ai.ts)
// plays the enemy, and every step is written down as a RunScript that
// replays the same run exactly (map and dice seeds both come from the run's
// seed). Balancing runs, tests and the in-game auto-play call this. Pure:
// no Phaser, no saving.

import { createBattleLevel, DEFAULT_CONTENT, getBattleDiceSeed, runStage, type GameContent } from '../battleSetup.ts';
import { planDeployment, planNextTurn } from '../battle/ai.ts';
import type { BattleCommand } from '../battle/commands.ts';
import { getCommands, replay } from '../battle/history.ts';
import { runBattle, type BattlePlanner } from '../battle/runner.ts';
import { createBattleState, getDeployedUnits, type BattleState } from '../battle/state.ts';
import type { ObjectiveKind } from '../objectives.ts';
import type { BattleOutcome } from '../turns.ts';
import { canRest } from './camp.ts';
import { createRun } from './run.ts';
import { applyRunCommand, finishBattle, getRewardOffers, type RunCommand, type RunSession } from './runCommands.ts';
import { createStartingWarband } from './stageLevel.ts';

// How a run starts: its seed, and the class and name of its first unit.
export interface RunStart {
  seed: number;
  classId: string;
  name: string;
}

// One step of a run: a stage's battle (every command given in it, both
// sides) or a command between battles.
export type RunStep = { type: 'battle'; commands: readonly BattleCommand[] } | RunCommand;

// A run written down: how it started and every step since. Plain JSON.
export interface RunScript {
  start: RunStart;
  steps: readonly RunStep[];
}

// Who decides for the player.
export interface RunPolicy {
  // The player's deployment, or its next unit's action.
  battle: BattlePlanner;
  // The reward pick: one of getLegalRunCommands' reward commands.
  reward: (session: RunSession) => RunCommand;
  // Camp, one command at a time until it marches.
  camp: (session: RunSession) => RunCommand;
}

// How one stage's battle went.
export interface StageRecord {
  stage: number;
  objective: ObjectiveKind;
  // Null when it ran past the turn limit undecided (a stall, lost).
  outcome: BattleOutcome | null;
  turns: number;
  losses: number;
}

export type RunEnd = 'fallen' | 'max-stages';

export interface AutoRunResult {
  script: RunScript;
  session: RunSession;
  stages: readonly StageRecord[];
  end: RunEnd;
}

export interface AutoRunOptions {
  content?: GameContent;
  // Stop once this many stages have been fought, so a run that never falls
  // ends. Default 30.
  maxStages?: number;
  // A battle still undecided once this turn is over counts as lost.
  // Default 40.
  maxTurns?: number;
  // The most commands a camp may take before it must march. Default 100.
  maxCampCommands?: number;
}

const DEFAULTS = { maxStages: 30, maxTurns: 40, maxCampCommands: 100 };

// The policy that plays like the enemy: the battle AI for the player too,
// the first recruit offered (else a rest, else the first offer), and a
// rest at camp whenever it can. What smarter policies are measured
// against.
export const BASELINE_POLICY: RunPolicy = Object.freeze({
  battle: (state: BattleState) => (state.stage === 'deployment' ? planDeployment(state) : planNextTurn(state)),
  reward: (session: RunSession): RunCommand => {
    const offers = getRewardOffers(session);
    const pick = [offers.findIndex((r) => r.kind === 'recruit'), offers.findIndex((r) => r.kind === 'rest'), 0].find(
      (index) => index >= 0,
    )!;
    return offers.length > 0 ? { type: 'pick-reward', index: pick } : { type: 'skip-reward' };
  },
  camp: (session: RunSession): RunCommand => (canRest(session.run) ? { type: 'rest' } : { type: 'march' }),
});

// A new run's session: stage 1's battle, fought by a lone level-1 unit.
export function startRun(start: RunStart): RunSession {
  return Object.freeze({
    run: createRun(start.seed, createStartingWarband(start.classId, start.name)),
    phase: 'battle' as const,
  });
}

// Plays a run from `start` with `policy` until the warband falls or
// maxStages stages have been fought.
export function playRun(start: RunStart, policy: RunPolicy, options: AutoRunOptions = {}): AutoRunResult {
  const { content = DEFAULT_CONTENT, maxStages, maxTurns, maxCampCommands } = { ...DEFAULTS, ...options };
  const steps: RunStep[] = [];
  const stages: StageRecord[] = [];
  let session = startRun(start);
  let campCommands = 0;
  const give = (command: RunCommand) => {
    session = applyRunCommand(session, command).session;
    steps.push(command);
  };

  for (;;) {
    switch (session.phase) {
      case 'battle': {
        if (stages.length >= maxStages) return done('max-stages');
        const setup = runStage(session.run);
        const { history, state } = runBattle(
          { setup, seed: getBattleDiceSeed(setup)!, commands: [] },
          { content, maxTurns, planners: { player: policy.battle } },
        );
        steps.push({ type: 'battle', commands: getCommands(history) });
        const result = finishStageBattle(session, state);
        stages.push(result.record);
        session = result.session;
        campCommands = 0;
        break;
      }
      case 'reward':
        give(policy.reward(session));
        break;
      case 'camp':
        give(campCommands++ < maxCampCommands ? policy.camp(session) : { type: 'march' });
        break;
      case 'over':
        return done('fallen');
    }
  }

  function done(end: RunEnd): AutoRunResult {
    return { script: { start, steps }, session, stages, end };
  }
}

// Plays `script` again: each battle replayed from its commands on the
// stage's map and dice, each other step applied as given. Throws at the
// first step that doesn't fit (e.g. a script from an older version).
export function replayRun(
  script: RunScript,
  options: Pick<AutoRunOptions, 'content'> = {},
): { session: RunSession; stages: StageRecord[] } {
  const { content = DEFAULT_CONTENT } = options;
  let session = startRun(script.start);
  const stages: StageRecord[] = [];
  for (const step of script.steps) {
    if (step.type !== 'battle') {
      session = applyRunCommand(session, step).session;
      continue;
    }
    if (session.phase !== 'battle') throw new Error(`A battle step while the run is at ${session.phase}`);
    const setup = runStage(session.run);
    const initial = createBattleState(createBattleLevel(setup, content), getBattleDiceSeed(setup)!);
    const history = replay(initial, step.commands);
    const state = history.entries.at(-1)?.state ?? initial;
    const result = finishStageBattle(session, state);
    stages.push(result.record);
    session = result.session;
  }
  return { session, stages };
}

// The run after a stage's battle ended in `state`; undecided counts as lost.
function finishStageBattle(session: RunSession, state: BattleState): { session: RunSession; record: StageRecord } {
  const before = session.run;
  const next = finishBattle(
    session,
    { units: getDeployedUnits(state), convoy: state.convoyLoot },
    state.outcome ?? 'defeat',
  );
  return {
    session: next,
    record: {
      stage: before.stage,
      objective: state.objective.kind,
      outcome: state.outcome,
      turns: state.turnState?.turn ?? 0,
      losses: next.run.fallen.length - before.fallen.length,
    },
  };
}
