import { gameCommands } from '../bridge/commands.ts';
import { useGameStore } from './useGameStore.ts';
import './AutoPlayButton.css';

// Header button that lets the player's side play itself (its turns, and in
// a Warband run its reward picks and camp too), or hands control back; the
// A key does the same. GridScene does the playing, so it only shows once a
// battle's map is up to hear the command.
export function AutoPlayButton() {
  const shown = useGameStore((state) => state.mapReady && state.screen === 'battle');
  const on = useGameStore((state) => state.autoPlay);
  if (!shown) return null;

  return (
    <button
      type="button"
      className="header-button auto-play-button"
      aria-pressed={on}
      title="Let the AI play your side (A)"
      onClick={() => gameCommands.send({ type: 'toggle-auto-play' })}
    >
      Auto
    </button>
  );
}
