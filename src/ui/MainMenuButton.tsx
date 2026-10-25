import { gameCommands } from '../bridge/commands.ts';
import { gameStore } from '../bridge/gameStore.ts';
import { GlyphIcon } from './GlyphIcon.tsx';
import { useGameStore } from './useGameStore.ts';

// Header button (a house) that leaves the battle for the title screen at
// any time, without going through the pause menu, or leaves the overworld
// the same way. In a battle GridScene does the leaving, so it waits
// (disabled) until the map scene is up to hear the command.
export function MainMenuButton() {
  const waiting = useGameStore((state) => state.screen === 'battle' && !state.mapReady);

  return (
    <button
      type="button"
      className="header-button header-button--icon"
      aria-label="Main menu"
      title="Main menu"
      disabled={waiting}
      onClick={() =>
        gameStore.getState().screen === 'battle'
          ? gameCommands.send({ type: 'main-menu' })
          : gameStore.setState({ screen: 'title' })
      }
    >
      <GlyphIcon kind="home" />
    </button>
  );
}
