import { useEffect, useState } from 'react';
import { gameStore } from '../bridge/gameStore.js';
import { createActionMenu, getSelectedAction, moveSelection, selectIndex } from '../game/actionMenu.js';
import { TITLE_ACTIONS } from '../game/titleMenu.js';
import { getTrainingActions } from '../game/trainingLevel.js';

const TRAINING_INDEX = TITLE_ACTIONS.findIndex((action) => action.id === 'training');

function mainMenu(selectedIndex = 0) {
  return selectIndex(createActionMenu(TITLE_ACTIONS), selectedIndex);
}

// The landing screen: game title plus the Play / Training / Settings menu.
// Training swaps in a second menu listing the unit classes; picking one
// starts a small practice battle with that unit. Works with the keyboard
// (arrows + Enter/Z to choose, Esc/X to go back — same keys as the map) and
// the mouse (right click goes back).
export function TitleScreen() {
  const [view, setView] = useState('main'); // 'main' | 'training'
  const [menu, setMenu] = useState(() => mainMenu());

  function openTraining() {
    setView('training');
    setMenu(createActionMenu(getTrainingActions()));
  }

  function backToMain() {
    setView('main');
    setMenu(mainMenu(TRAINING_INDEX));
  }

  // Carries out a menu choice. Settings is a placeholder for now.
  function runAction(action) {
    if (!action) return;
    if (view === 'training') {
      gameStore.setState({ screen: 'battle', battleSetup: { mode: 'training', unitClass: action.id } });
    } else if (action.id === 'play') {
      gameStore.setState({ screen: 'battle', battleSetup: { mode: 'demo' } });
    } else if (action.id === 'training') {
      openTraining();
    }
  }

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        setMenu((current) => moveSelection(current, event.key === 'ArrowUp' ? -1 : 1));
      } else if (event.key === 'Enter' || event.key === 'z' || event.key === 'Z') {
        event.preventDefault();
        runAction(getSelectedAction(menu));
      } else if (event.key === 'Escape' || event.key === 'x' || event.key === 'X') {
        if (view === 'training') {
          event.preventDefault();
          backToMain();
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  function onContextMenu(event) {
    event.preventDefault();
    if (view === 'training') backToMain();
  }

  const training = view === 'training';

  return (
    <div className="title-screen" onContextMenu={onContextMenu}>
      <header className="title-screen__header">
        <Crest />
        <h1 className="title-screen__title">Rogue Emblem</h1>
        <div className="title-screen__rule" aria-hidden="true">
          <span>◆</span>
        </div>
      </header>

      <nav className="title-menu" aria-label={training ? 'Choose a unit to train' : 'Main menu'}>
        {training && <h2 className="title-menu__heading">Training — Choose a Unit</h2>}
        <ul className="title-menu__list">
          {menu.actions.map((action, index) => {
            const selected = index === menu.selectedIndex;
            return (
              <li key={action.id}>
                <button
                  type="button"
                  className={selected ? 'title-menu__item title-menu__item--selected' : 'title-menu__item'}
                  aria-current={selected ? 'true' : undefined}
                  onMouseEnter={() => setMenu((current) => selectIndex(current, index))}
                  onClick={() => runAction(action)}
                >
                  {action.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <p className="title-screen__hint">
        {training ? '↑↓ Select · Enter Confirm · Esc Back' : '↑↓ Select · Enter Confirm'}
      </p>
    </div>
  );
}

// A simple heraldic mark: a sword laid over a diamond. Also shown on the
// loading screen.
export function Crest() {
  return (
    <svg className="title-screen__crest" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M32 4 L58 32 L32 60 L6 32 Z" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M32 12 L50 32 L32 52 L14 32 Z" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <path d="M32 10 L35 16 L35 40 L29 40 L29 16 Z" fill="currentColor" />
      <rect x="23" y="40" width="18" height="3" fill="currentColor" />
      <rect x="30.5" y="43" width="3" height="8" fill="currentColor" />
      <circle cx="32" cy="53" r="2.5" fill="currentColor" />
    </svg>
  );
}
