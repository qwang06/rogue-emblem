// Entries on the title screen menu. Selection state reuses the generic menu
// helpers in actionMenu.ts; carrying out a choice is the caller's job.

import type { MenuAction } from './actionMenu.ts';

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
