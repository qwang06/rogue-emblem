// Entries on the title screen menu. Selection state reuses the generic menu
// helpers in actionMenu.ts; carrying out a choice is the caller's job.

import type { MenuAction } from './actionMenu.ts';
import type { RunState } from './warband/run.ts';
import { STARTING_CLASSES } from './warband/startingClasses.ts';

export const TITLE_ACTIONS: readonly MenuAction[] = Object.freeze([
  Object.freeze({ id: 'story', label: 'Story Mode' }),
  Object.freeze({ id: 'warband', label: 'Warband Mode' }),
  Object.freeze({ id: 'training', label: 'Training' }),
  Object.freeze({ id: 'settings', label: 'Settings' }),
]);

// Entries on the Settings submenu the title menu's Settings opens.
// 'configs' leads to the config editor (#/configs).
export const SETTINGS_ACTIONS: readonly MenuAction[] = Object.freeze([
  Object.freeze({ id: 'configs', label: 'Game Configs' }),
]);

// Entries on the submenu Warband Mode opens: carry on with the saved run
// from the stage it's on, or start a new one (in its place, if there is
// one). With no run saved, Continue Run is shown but disabled.
export function getWarbandActions(savedRun: RunState | null): readonly MenuAction[] {
  const continueRun = savedRun
    ? { id: 'continue-run', label: `Continue Run (Stage ${savedRun.stage})` }
    : { id: 'continue-run', label: 'Continue Run', disabled: true };
  return Object.freeze([Object.freeze(continueRun), Object.freeze({ id: 'new-run', label: 'New Run' })]);
}

// An entry on the New Run submenu: a base class to start the run with, and
// its pitch.
export interface StartingClassAction extends MenuAction {
  description: string;
}

// Entries on the submenu New Run opens: one per starting class (see
// STARTING_CLASSES), whose id is the class id.
export const STARTING_CLASS_ACTIONS: readonly StartingClassAction[] = Object.freeze(
  STARTING_CLASSES.map(({ id, label, description }) => Object.freeze({ id, label, description })),
);

// The entry to select when a menu opens: the first that isn't disabled
// (or the first, if they all are).
export function getFirstEnabledIndex(actions: readonly MenuAction[]): number {
  return Math.max(
    0,
    actions.findIndex((action) => !action.disabled),
  );
}
