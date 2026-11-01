import { useEffect, useMemo, useState } from 'react';
import { toRosterScreenView } from '../bridge/rosterView.ts';
import { saveRun } from '../data/runSave.ts';
import type { RunState } from '../game/warband/run.ts';
import {
  cancelRoster,
  confirmRoster,
  moveRosterCursor,
  openRosterScreen,
  pointRosterCursor,
  type RosterScreenState,
} from '../game/warband/rosterScreen.ts';
import { RosterScreenPanel, type RosterPointer } from './RosterScreen.tsx';

const CONFIRM_KEYS = ['Enter', 'z', 'Z', ' '];
const CANCEL_KEYS = ['Escape', 'x', 'X'];
const MOVES: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

// The roster screen (RosterScreen.tsx) opened from the overworld, while
// choosing where to go next. No scene runs here, so this drives the pure
// roster state (src/game/warband/rosterScreen.ts) itself, with the same
// keys and mouse as at camp, saving the run whenever an item changes hands
// and handing it to `onRun`. Leaving the unit list (Esc) closes it.
export function OverworldRoster({
  run,
  onRun,
  onClose,
}: {
  run: RunState;
  onRun: (run: RunState) => void;
  onClose: () => void;
}) {
  const [state, setState] = useState<RosterScreenState>(() => openRosterScreen(run));
  const view = useMemo(() => toRosterScreenView(state), [state]);

  function apply(next: RosterScreenState | null) {
    if (!next) {
      onClose();
      return;
    }
    if (next.run !== state.run) {
      saveRun(next.run);
      onRun(next.run);
    }
    setState(next);
  }

  const pointer: RosterPointer = {
    hover: (target, index) => apply(pointRosterCursor(state, target, index)),
    select: (target, index) => {
      const pointed = pointRosterCursor(state, target, index);
      // Clicking a tab only opens it.
      apply(target === 'tabs' ? pointed : confirmRoster(pointed));
    },
  };

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement) return;
      const move = MOVES[event.key];
      if (move) apply(moveRosterCursor(state, move[0], move[1]));
      else if (CONFIRM_KEYS.includes(event.key)) apply(confirmRoster(state));
      else if (CANCEL_KEYS.includes(event.key)) apply(cancelRoster(state));
      else return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <div
      className="overworld-roster"
      onContextMenu={(event) => {
        event.preventDefault();
        apply(cancelRoster(state));
      }}
    >
      <RosterScreenPanel view={view} pointer={pointer} />
    </div>
  );
}
