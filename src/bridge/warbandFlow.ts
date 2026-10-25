// Where the game goes for a Warband run as it stands: the overworld while
// it's choosing where to travel (see warband/travel.ts), else the map
// scene with its current stage (a battle, or a town or shrine visit, or a
// reward still owed). The title screen, the overworld and the map scene
// all hand a run on through here, so they agree.

import { saveRun } from '../data/runSave.ts';
import { runStage } from '../game/battleSetup.ts';
import type { RunState } from '../game/warband/run.ts';
import { resumeRunSession } from '../game/warband/runCommands.ts';
import { BATTLE_STATE_DEFAULTS, gameStore } from './gameStore.ts';

// The screen `run` continues on: 'overworld' or 'battle'.
export function getRunScreen(run: RunState): 'overworld' | 'battle' {
  const { phase } = resumeRunSession(run);
  return phase === 'travel' || phase === 'event' ? 'overworld' : 'battle';
}

// Saves `run` and shows the screen it continues on.
export function enterRun(run: RunState): void {
  saveRun(run);
  if (getRunScreen(run) === 'overworld') {
    gameStore.setState({ ...BATTLE_STATE_DEFAULTS, screen: 'overworld', battleSetup: null });
  } else {
    gameStore.setState({ ...BATTLE_STATE_DEFAULTS, screen: 'battle', battleSetup: runStage(run) });
  }
}
