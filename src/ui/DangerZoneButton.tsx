import { gameCommands } from '../bridge/commands.ts';
import { useGameStore } from './useGameStore.ts';
import './DangerZoneButton.css';

// Header button that shades every tile an enemy could strike next phase,
// or clears it again; the D key does the same. GridScene draws the zone, so
// it only shows once a battle's map is up to hear the command.
export function DangerZoneButton() {
  const shown = useGameStore((state) => state.mapReady && state.screen === 'battle');
  const visible = useGameStore((state) => state.dangerZoneVisible);
  if (!shown) return null;

  return (
    <button
      type="button"
      className="header-button danger-zone-button"
      aria-pressed={visible}
      title="Show every tile an enemy could hit next turn (D)"
      onClick={() => gameCommands.send({ type: 'toggle-danger-zone' })}
    >
      Danger
    </button>
  );
}
