// Entries of the pause menu, opened with cancel on the map when nothing
// else is open. Selection reuses the generic menu helpers in actionMenu.ts;
// carrying out a choice is the caller's job.

import type { MenuAction } from './actionMenu.ts';

// End Turn, Undo (greyed out unless there's a player action to take back,
// see undoLastAction in battle/history.ts), Main Menu and Settings.
export function getPauseActions({ canUndo }: { canUndo: boolean }): readonly MenuAction[] {
  return Object.freeze([
    Object.freeze({ id: 'end-turn', label: 'End Turn' }),
    Object.freeze({ id: 'undo', label: 'Undo', disabled: !canUndo }),
    Object.freeze({ id: 'main-menu', label: 'Main Menu' }),
    Object.freeze({ id: 'settings', label: 'Settings' }),
  ]);
}
