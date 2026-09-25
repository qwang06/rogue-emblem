import { useEffect, useState } from 'react';
import { gameStore } from '../bridge/gameStore.js';
import { createActionMenu, getSelectedAction, moveSelection, selectIndex } from '../game/actionMenu.js';
import { TITLE_ACTIONS } from '../game/titleMenu.js';

// Carries out a title menu choice. Settings is a placeholder for now.
function runTitleAction(action) {
  if (action?.id === 'play') gameStore.setState({ screen: 'battle' });
}

// The landing screen: game title plus the Play / Settings menu. Works with
// the keyboard (arrows + Enter/Z, same keys as the map) and the mouse.
export function TitleScreen() {
  const [menu, setMenu] = useState(() => createActionMenu(TITLE_ACTIONS));

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        setMenu((current) => moveSelection(current, event.key === 'ArrowUp' ? -1 : 1));
      } else if (event.key === 'Enter' || event.key === 'z' || event.key === 'Z') {
        event.preventDefault();
        runTitleAction(getSelectedAction(menu));
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menu]);

  return (
    <div className="title-screen">
      <header className="title-screen__header">
        <Crest />
        <h1 className="title-screen__title">Rogue Emblem</h1>
        <div className="title-screen__rule" aria-hidden="true">
          <span>◆</span>
        </div>
      </header>

      <nav className="title-menu" aria-label="Main menu">
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
                  onClick={() => runTitleAction(action)}
                >
                  {action.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <p className="title-screen__hint">↑↓ Select · Enter Confirm</p>
    </div>
  );
}

// A simple heraldic mark: a sword laid over a diamond.
function Crest() {
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
