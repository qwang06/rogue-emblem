// The header's relic bar (src/ui/RelicBar.tsx) shows the relics a Warband
// run holds, keystone first, through every screen of the run: the map
// scene publishes them when a battle starts and whenever it saves the run
// (GridScene.keepRun), and the overworld whenever its run changes.

import type { RunState } from '../game/warband/run.ts';
import { gameStore } from './gameStore.ts';
import { toRelicViews } from './views.ts';

// Publishes `run`'s relics for the relic bar, or clears the bar with null.
export function publishRunRelics(run: RunState | null): void {
  gameStore.setState({ runRelics: run ? toRelicViews(run.relics, run.stage, run.keystone) : null });
}
