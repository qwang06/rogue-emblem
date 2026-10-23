import { gameCommands } from '../bridge/commands.ts';
import { useGameStore } from './useGameStore.ts';
import './AutoPlayButton.css';

// Header button that lets the player's side play itself (its turns, and in
// a Warband run its reward picks and camp too), or hands control back; the
// A key does the same. Beside it, − and + set the game speed, which plays
// the map's animations faster with Auto on or off. GridScene does the
// playing, so it only shows once a battle's map is up to hear the command.
export function AutoPlayButton() {
  const shown = useGameStore((state) => state.mapReady && state.screen === 'battle');
  const on = useGameStore((state) => state.autoPlay);
  const speed = useGameStore((state) => state.autoSpeed);
  if (!shown) return null;

  return (
    <div className="auto-play-controls" aria-label="Auto play controls">
      <button
        type="button"
        className="header-button auto-play-button"
        aria-pressed={on}
        title="Let the AI play your side (A)"
        onClick={() => gameCommands.send({ type: 'toggle-auto-play' })}
      >
        Auto
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
      <output className="auto-speed-value" aria-label={`Game speed ${speed} times`}>
        {speed}×
      </output>
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
