// Entries on the title screen menu. Selection state reuses the generic menu
// helpers in actionMenu.ts; carrying out a choice is the caller's job.

import type { MenuAction } from './actionMenu.ts';
import type { AudioSettings } from '../audio/settings.ts';
import { getNextUnlock, getUnlockedStartingClasses, UNLOCKS, type MetaState } from './warband/meta.ts';
import type { RunState } from './warband/run.ts';
import { STARTING_CLASSES, UNLOCKABLE_STARTING_CLASSES } from './warband/startingClasses.ts';

export const TITLE_ACTIONS: readonly MenuAction[] = Object.freeze([
  Object.freeze({ id: 'story', label: 'Story Mode' }),
  Object.freeze({ id: 'warband', label: 'Warband Mode' }),
  Object.freeze({ id: 'training', label: 'Training' }),
  Object.freeze({ id: 'settings', label: 'Settings' }),
]);

// Entries on the Settings submenu the title menu's Settings opens, which
// show the current sound settings: 'sound' turns sound on or off, 'volume'
// changes the volume, and 'configs' leads to the config editor (#/configs).
export function getSettingsActions(audio: AudioSettings): readonly MenuAction[] {
  return Object.freeze([
    Object.freeze({ id: 'sound', label: `Sound: ${audio.muted ? 'Off' : 'On'}` }),
    Object.freeze({ id: 'volume', label: `Volume: ${Math.round(audio.volume * 100)}%` }),
    Object.freeze({ id: 'configs', label: 'Game Configs' }),
  ]);
}

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

// Entries on the submenu New Run opens: one per base starting class (see
// STARTING_CLASSES), whose id is the class id.
export const STARTING_CLASS_ACTIONS: readonly StartingClassAction[] = Object.freeze(
  STARTING_CLASSES.map(({ id, label, description }) => Object.freeze({ id, label, description })),
);

// The New Run submenu for a player with `meta`'s renown: the base classes,
// then every unlockable one (UNLOCKABLE_STARTING_CLASSES), disabled until
// its renown is reached, its pitch then saying how much it takes.
export function getStartingClassActions(meta: MetaState): readonly StartingClassAction[] {
  const unlocked = getUnlockedStartingClasses(meta);
  const locked = UNLOCKABLE_STARTING_CLASSES.map(({ id, label, description }) => {
    if (unlocked.includes(id)) return Object.freeze({ id, label, description });
    const renown = UNLOCKS.find((unlock) => unlock.startingClass === id)?.renown ?? 0;
    return Object.freeze({
      id,
      label,
      description: `Unlocks at ${renown} renown (${meta.renown} so far).`,
      disabled: true,
    });
  });
  return Object.freeze([...STARTING_CLASS_ACTIONS, ...locked]);
}

// The Warband Mode submenu's renown line: the renown earned so far and
// the next unlock it leads to.
export function describeRenown(meta: MetaState): string {
  const next = getNextUnlock(meta);
  return `Renown ${meta.renown} · ${next ? `Next: ${next.label} at ${next.renown}` : 'Everything unlocked'}`;
}

// The entry to select when a menu opens: the first that isn't disabled
// (or the first, if they all are).
export function getFirstEnabledIndex(actions: readonly MenuAction[]): number {
  return Math.max(
    0,
    actions.findIndex((action) => !action.disabled),
  );
}
