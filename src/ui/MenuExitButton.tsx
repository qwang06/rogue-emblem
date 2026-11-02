import type { MouseEvent } from 'react';
import { gameCommands } from '../bridge/commands.ts';
import { GlyphIcon } from './GlyphIcon.tsx';

// How a window is left: a step back (to the menu or choice before it) or
// shut altogether.
export type MenuExit = 'back' | 'close';

const LABELS: Record<MenuExit, string> = { back: 'Back', close: 'Close' };

// Sends cancel, the same as Esc or a right click, to whichever scene is
// listening.
function sendCancel() {
  gameCommands.send({ type: 'cancel' });
}

// The Back / Close tab on a window's top-right corner, opposite its name
// plate, so leaving a menu never takes guessing where to right click. It
// hangs off the frame like the name plate, taking no room in the window,
// and keeps one width whichever it says (see ui.css), so switching between
// Back and Close never moves anything. The click does what Esc does there
// (`onClick`, by default the scene's cancel) and goes no further, so an
// overlay that closes on a click doesn't act on it twice.
export function MenuExitButton({
  kind,
  onClick = sendCancel,
  className,
}: {
  kind: MenuExit;
  onClick?: () => void;
  className?: string;
}) {
  const label = LABELS[kind];
  return (
    <button
      type="button"
      className={className ? `header-button menu-exit ${className}` : 'header-button menu-exit'}
      title={`${label} (Esc)`}
      onClick={(event: MouseEvent) => {
        event.stopPropagation();
        onClick();
      }}
      // A right click on it is a cancel too, but just the one.
      onContextMenu={(event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
    >
      <GlyphIcon kind={kind} />
      {label}
    </button>
  );
}
