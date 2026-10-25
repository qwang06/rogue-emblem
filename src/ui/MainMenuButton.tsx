import { gameCommands } from '../bridge/commands.ts';
import { GlyphIcon } from './GlyphIcon.tsx';
import { useGameStore } from './useGameStore.ts';

// Header button (a house) that leaves the battle for the title screen at
// any time, without going through the pause menu. GridScene does the
// leaving, so it only shows once the map scene is up to hear the command.
export function MainMenuButton() {
  const mapReady = useGameStore((state) => state.mapReady);
  if (!mapReady) return null;

  return (
    <button
      type="button"
      className="header-button header-button--icon"
      aria-label="Main menu"
      title="Main menu"
      onClick={() => gameCommands.send({ type: 'main-menu' })}
    >
      <GlyphIcon kind="home" />
    </button>
  );
}
