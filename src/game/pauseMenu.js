// Entries of the pause menu, opened with cancel on the map when nothing
// else is open. Selection reuses the generic menu helpers in actionMenu.js;
// carrying out a choice is the caller's job.

export const PAUSE_ACTIONS = Object.freeze([
  Object.freeze({ id: 'end-turn', label: 'End Turn' }),
  Object.freeze({ id: 'main-menu', label: 'Main Menu' }),
  Object.freeze({ id: 'settings', label: 'Settings' }),
]);
