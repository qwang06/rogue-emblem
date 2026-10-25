import { gameCommands, type Command } from '../bridge/commands.ts';
import { gameStore } from '../bridge/gameStore.ts';
import { changeAutoSpeed, cycleAutoSpeed } from '../game/autoSpeed.ts';
import { GlyphIcon } from './GlyphIcon.tsx';
import { useGameStore } from './useGameStore.ts';
import './AutoPlayButton.css';

// Header button (a play arrow and the word Auto, since the arrow alone
// reads as play/pause) that lets the player's side play itself
// (its turns, and in a Warband run its reward picks and camp too), or
// hands control back; the A key does the same. Beside it, − and + set the
// game speed, which plays the map's animations faster with Auto on or off;
// on phones the − and + make way and the speed readout itself steps
// through the speeds. It's in the header on every screen, so the bar
// never changes: in a battle GridScene does the playing, so the buttons
// wait (disabled) until the map is up to hear the command; on the
// overworld they set the store straight, where it picks roads and walks
// at that speed. A region's read-only preview plays nothing.
export function AutoPlayButton() {
  const waiting = useGameStore((state) => state.screen === 'preview' || (state.screen === 'battle' && !state.mapReady));
  const on = useGameStore((state) => state.autoPlay);
  const speed = useGameStore((state) => state.autoSpeed);

  return (
    <div className="auto-play-controls" aria-label="Auto play controls">
      <button
        type="button"
        className="header-button header-button--icon auto-play-button"
        aria-pressed={on}
        title="Let the AI play your side (A)"
        disabled={waiting}
        onClick={() => send({ type: 'toggle-auto-play' })}
      >
        <GlyphIcon kind="auto" />
        <span className="auto-play-button__label">Auto</span>
      </button>
      <button
        type="button"
        className="header-button auto-speed-button"
        aria-label="Decrease game speed"
        title="Decrease game speed"
        disabled={waiting || speed === 1}
        onClick={() => send({ type: 'change-auto-speed', direction: -1 })}
      >
        −
      </button>
      <button
        type="button"
        className="header-button auto-speed-value"
        aria-label={`Game speed ${speed} times`}
        title="Game speed (click to change)"
        disabled={waiting}
        onClick={() => send({ type: 'cycle-auto-speed' })}
      >
        {speed}×
      </button>
      <button
        type="button"
        className="header-button auto-speed-button"
        aria-label="Increase game speed"
        title="Increase game speed"
        disabled={waiting || speed === 8}
        onClick={() => send({ type: 'change-auto-speed', direction: 1 })}
      >
        +
      </button>
    </div>
  );
}

type AutoCommand = Extract<Command, { type: 'toggle-auto-play' | 'change-auto-speed' | 'cycle-auto-speed' }>;

// To GridScene in a battle, which also clears its queued moves and speeds
// up its clocks; anywhere else, straight to the store.
function send(command: AutoCommand) {
  if (gameStore.getState().screen === 'battle') {
    gameCommands.send(command);
    return;
  }
  gameStore.setState((state) => {
    if (command.type === 'toggle-auto-play') return { autoPlay: !state.autoPlay };
    if (command.type === 'change-auto-speed') return { autoSpeed: changeAutoSpeed(state.autoSpeed, command.direction) };
    return { autoSpeed: cycleAutoSpeed(state.autoSpeed) };
  });
}
