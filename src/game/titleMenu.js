// Entries on the title screen menu. Selection state reuses the generic menu
// helpers in actionMenu.js; carrying out a choice is the caller's job.

export const TITLE_ACTIONS = Object.freeze([
  Object.freeze({ id: 'play', label: 'Play' }),
  Object.freeze({ id: 'settings', label: 'Settings' }),
]);
