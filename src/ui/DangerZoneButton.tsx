import { gameCommands } from '../bridge/commands.ts';
import { GlyphIcon } from './GlyphIcon.tsx';
import { useGameStore } from './useGameStore.ts';
import './DangerZoneButton.css';

// Header button (an eye) that shades every tile an enemy could strike next
// phase, or clears it again; the D key does the same. GridScene draws the
// zone, so it's only enabled while a battle's map is up and undecided (not
// on the overworld, or over the result, reward and camp screens); it stays
// in the header regardless, so the bar never changes.
export function DangerZoneButton() {
  const usable = useGameStore((state) => state.mapReady && state.screen === 'battle' && state.battleOutcome === null);
  const visible = useGameStore((state) => state.dangerZoneVisible);

  return (
    <button
      type="button"
      className="header-button header-button--icon danger-zone-button"
      aria-pressed={usable && visible}
      disabled={!usable}
      aria-label="Danger zone"
      title="Show every tile an enemy could hit next turn (D)"
      onClick={() => gameCommands.send({ type: 'toggle-danger-zone' })}
    >
      <GlyphIcon kind="danger" />
    </button>
  );
}
