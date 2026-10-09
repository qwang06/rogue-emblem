// Keeps the Warband Mode run in progress in the browser's localStorage, so
// a reload (or a trip back to the title) can carry on with it. A run is
// saved as each stage starts; a save that no longer parses (corrupt, or
// from a version with other classes or items) reads as no run.

import { parseRun, serializeRun, type RunState } from '../game/warband/run.ts';
import { browserStorage, createStoredText, type StoredText } from './customStorage.ts';

export const RUN_SAVE_KEY = 'rogue-emblem:warband-run';

export const runSaveStore = createStoredText(browserStorage(), RUN_SAVE_KEY);

// The saved run, or null when there's none or it doesn't parse.
export function loadSavedRun(store: StoredText = runSaveStore): RunState | null {
  const text = store.load();
  return text === null ? null : parseRun(text);
}

// Saves `run` over any earlier one. Returns false when storage couldn't be
// written (the run still plays, it just won't survive a reload).
export function saveRun(run: RunState, store: StoredText = runSaveStore): boolean {
  return store.save(serializeRun(run));
}

// Forgets the saved run, once it's over.
export function clearSavedRun(store: StoredText = runSaveStore): boolean {
  return store.clear();
}
