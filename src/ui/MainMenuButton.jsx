import { gameCommands } from '../bridge/commands.js';
import { useGameStore } from './useGameStore.js';

// Header button that leaves the battle for the title screen at any time,
// without going through the pause menu. GridScene does the leaving, so it
// only shows once the map scene is up to hear the command.
export function MainMenuButton() {
  const mapReady = useGameStore((state) => state.mapReady);
  if (!mapReady) return null;

  return (
    <button type="button" className="header-button" onClick={() => gameCommands.send({ type: 'main-menu' })}>
      Main Menu
    </button>
  );
}
