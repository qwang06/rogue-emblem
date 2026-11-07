// Entries of the pause menu, opened with cancel on the map when nothing
// else is open. Selection reuses the generic menu helpers in actionMenu.ts;
// carrying out a choice is the caller's job.

import type { MenuAction } from './actionMenu.ts';
import type { AutoSpeed } from './autoSpeed.ts';

// End Turn, Undo (greyed out unless there's a player action to take back,
// see undoLastAction in battle/history.ts), Auto Play (its state in the
// label) and its speed (picking it steps the speed), Main Menu and
// Settings.
export function getPauseActions({
  canUndo,
  autoPlay = false,
  autoSpeed = 1,
}: {
  canUndo: boolean;
  autoPlay?: boolean;
  autoSpeed?: AutoSpeed;
}): readonly MenuAction[] {
  return Object.freeze([
    Object.freeze({ id: 'end-turn', label: 'End Turn' }),
    Object.freeze({ id: 'undo', label: 'Undo', disabled: !canUndo }),
    Object.freeze({ id: 'auto-play', label: autoPlay ? 'Auto Play: On' : 'Auto Play: Off' }),
    Object.freeze({ id: 'auto-speed', label: `Auto Speed: ${autoSpeed}x` }),
    Object.freeze({ id: 'main-menu', label: 'Main Menu' }),
    Object.freeze({ id: 'settings', label: 'Settings' }),
  ]);
}
