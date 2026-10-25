import { gameCommands } from '../bridge/commands.ts';
import { GlyphIcon } from './GlyphIcon.tsx';
import { useGameStore } from './useGameStore.ts';
import './AutoPlayButton.css';

// Header button (a play arrow and the word Auto, since the arrow alone
// reads as play/pause) that lets the player's side play itself
// (its turns, and in a Warband run its reward picks and camp too), or
// hands control back; the A key does the same. Beside it, − and + set the
// game speed, which plays the map's animations faster with Auto on or off;
// on phones the − and + make way and the speed readout itself steps
// through the speeds. GridScene does the playing, so it only shows once a
// battle's map is up to hear the command.
export function AutoPlayButton() {
  const shown = useGameStore((state) => state.mapReady && state.screen === 'battle');
  const on = useGameStore((state) => state.autoPlay);
  const speed = useGameStore((state) => state.autoSpeed);
  if (!shown) return null;

  return (
    <div className="auto-play-controls" aria-label="Auto play controls">
      <button
        type="button"
        className="header-button header-button--icon auto-play-button"
        aria-pressed={on}
        title="Let the AI play your side (A)"
        onClick={() => gameCommands.send({ type: 'toggle-auto-play' })}
      >
        <GlyphIcon kind="auto" />
        <span className="auto-play-button__label">Auto</span>
      </button>
      <button
        type="button"
        className="header-button auto-speed-button"
        aria-label="Decrease game speed"
        title="Decrease game speed"
        disabled={speed === 1}
        onClick={() => gameCommands.send({ type: 'change-auto-speed', direction: -1 })}
      >
        −
      </button>
      <button
        type="button"
        className="header-button auto-speed-value"
        aria-label={`Game speed ${speed} times`}
        title="Game speed (click to change)"
        onClick={() => gameCommands.send({ type: 'cycle-auto-speed' })}
      >
        {speed}×
      </button>
      <button
        type="button"
        className="header-button auto-speed-button"
        aria-label="Increase game speed"
        title="Increase game speed"
        disabled={speed === 8}
        onClick={() => gameCommands.send({ type: 'change-auto-speed', direction: 1 })}
      >
        +
      </button>
    </div>
  );
}
