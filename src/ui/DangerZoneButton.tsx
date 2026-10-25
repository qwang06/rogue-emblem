import { gameCommands } from '../bridge/commands.ts';
import { GlyphIcon } from './GlyphIcon.tsx';
import { useGameStore } from './useGameStore.ts';
import './DangerZoneButton.css';

// Header button (an eye) that shades every tile an enemy could strike next
// phase, or clears it again; the D key does the same. GridScene draws the
// zone, so it only shows while a battle's map is up and undecided (not
// over the result, reward and camp screens).
export function DangerZoneButton() {
  const shown = useGameStore((state) => state.mapReady && state.screen === 'battle' && state.battleOutcome === null);
  const visible = useGameStore((state) => state.dangerZoneVisible);
  if (!shown) return null;

  return (
    <button
      type="button"
      className="header-button header-button--icon danger-zone-button"
      aria-pressed={visible}
      aria-label="Danger zone"
      title="Show every tile an enemy could hit next turn (D)"
      onClick={() => gameCommands.send({ type: 'toggle-danger-zone' })}
    >
      <GlyphIcon kind="danger" />
    </button>
  );
}
