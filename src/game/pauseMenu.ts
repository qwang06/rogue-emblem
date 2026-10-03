// Entries of the pause menu, opened with cancel on the map when nothing
// else is open. Selection reuses the generic menu helpers in actionMenu.ts;
// carrying out a choice is the caller's job.

import type { MenuAction } from './actionMenu.ts';

export const PAUSE_ACTIONS: readonly MenuAction[] = Object.freeze([
  Object.freeze({ id: 'end-turn', label: 'End Turn' }),
  Object.freeze({ id: 'main-menu', label: 'Main Menu' }),
  Object.freeze({ id: 'settings', label: 'Settings' }),
]);
