import { gameCommands } from '../bridge/commands.ts';
import type { GameState } from '../bridge/gameStore.ts';
import { isOnField } from './BattleDock.tsx';
import { KeyHint, type KeyHintEntry } from './KeyHint.tsx';
import { MenuIcon } from './MenuIcon.tsx';
import { useGameStore } from './useGameStore.ts';

// What the player can do right now, for the bar's key hints: whether a
// menu owns the input, a tile is being picked, or the cursor roams the map.
type Mode = 'deploy-menu' | 'placing' | 'menu' | 'targeting' | 'roam' | 'waiting';

function getMode(state: GameState): Mode {
  if (state.phase === 'deployment') return state.deploymentStep === 'placing' ? 'placing' : 'deploy-menu';
  if (state.turn?.team !== 'player' || state.autoPlay) return 'waiting';
  if (state.pauseMenu || state.actionMenu || state.weaponMenu || state.skillMenu || state.itemMenu) return 'menu';
  if (state.targeting) return 'targeting';
  return 'roam';
}

const HINTS: Readonly<Record<Mode, readonly KeyHintEntry[]>> = {
  'deploy-menu': [
    ['↑↓', 'Choose'],
    ['Enter', 'Confirm'],
  ],
  placing: [
    ['←↑↓→', 'Tile'],
    ['Enter', 'Place'],
    ['Esc', 'Back'],
  ],
  menu: [
    ['↑↓', 'Choose'],
    ['Enter', 'Confirm'],
    ['Esc', 'Back'],
  ],
  targeting: [
    ['←↑↓→', 'Tile'],
    ['Enter', 'Confirm'],
    ['Esc', 'Back'],
  ],
  roam: [
    ['Enter', 'Select'],
    ['I', 'Info'],
    ['D', 'Danger'],
    ['Esc', 'Menu'],
  ],
  waiting: [],
};

// The strip under the board all through a battle: the keys that matter in
// the current mode on the left, and on the right the player phase's two
// big commands, Undo and End Turn (what the pause menu also offers), which
// GridScene carries out when the map is idle. During the enemy phase the
// right side says whose turn it is instead.
export function BattleBar() {
  const onField = useGameStore(isOnField);
  const mode = useGameStore(getMode);
  const turn = useGameStore((state) => state.turn);
  const phase = useGameStore((state) => state.phase);
  if (!onField) return null;

  const idle = mode === 'roam';
  return (
    <footer className="battle-bar">
      <KeyHint className="battle-bar__hints" entries={HINTS[mode]} />
      <div className="battle-bar__commands">
        {phase === 'battle' && turn?.team === 'player' ? (
          <>
            <button
              type="button"
              className="header-button battle-bar__button"
              disabled={!idle}
              onClick={() => gameCommands.send({ type: 'undo' })}
            >
              <MenuIcon id="undo" />
              Undo
            </button>
            <button
              type="button"
              className="header-button battle-bar__button battle-bar__button--end"
              disabled={!idle}
              onClick={() => gameCommands.send({ type: 'end-turn' })}
            >
              <MenuIcon id="end-turn" />
              End Turn
            </button>
          </>
        ) : phase === 'battle' && turn ? (
          <span className={`battle-bar__phase battle-bar__phase--${turn.team}`}>{turn.label}</span>
        ) : null}
      </div>
    </footer>
  );
}
