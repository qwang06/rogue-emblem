// Entries on the title screen menu. Selection state reuses the generic menu
// helpers in actionMenu.ts; carrying out a choice is the caller's job.

import type { MenuAction } from './actionMenu.ts';

export const TITLE_ACTIONS: readonly MenuAction[] = Object.freeze([
  Object.freeze({ id: 'play', label: 'Play' }),
  Object.freeze({ id: 'training', label: 'Training' }),
  Object.freeze({ id: 'settings', label: 'Settings' }),
]);
