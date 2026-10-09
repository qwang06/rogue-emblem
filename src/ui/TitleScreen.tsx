import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import type { MenuAction } from '../game/actionMenu.ts';
import { gameStore } from '../bridge/gameStore.ts';
import { createActionMenu, getSelectedAction, moveSelection, selectIndex } from '../game/actionMenu.ts';
import { getWarbandActions, SETTINGS_ACTIONS, TITLE_ACTIONS } from '../game/titleMenu.ts';
import { getTrainingActions } from '../game/trainingLevel.ts';
import { FIRST_STORY_CHAPTER, runStage } from '../game/battleSetup.ts';
import { randomSeed } from '../game/rng.ts';
import { createRun, type RunState } from '../game/warband/run.ts';
import { createStartingWarband } from '../game/warband/stageLevel.ts';
import { loadSavedRun, saveRun } from '../data/runSave.ts';
import { routeHash } from './route.ts';

type View = 'main' | 'training' | 'warband' | 'settings';

// The submenus title entries open: their heading, and the entries to list.
const SUBMENUS = {
  training: { heading: 'Training — Choose a Unit', label: 'Choose a unit to train', actions: getTrainingActions },
  warband: {
    heading: 'Warband Mode',
    label: 'Warband Mode',
    actions: () => {
      const saved = loadSavedRun();
      return saved ? getWarbandActions(saved) : [];
    },
  },
  settings: { heading: 'Settings', label: 'Settings', actions: () => SETTINGS_ACTIONS },
} as const;

// A fresh run with the starting warband.
function newRun(): RunState {
  return createRun(randomSeed(), createStartingWarband());
}

function mainMenu(selectedIndex = 0) {
  return selectIndex(createActionMenu(TITLE_ACTIONS), selectedIndex);
}

// The landing screen: game title plus the Story Mode / Warband Mode /
// Training / Settings menu. Warband Mode starts a new run, or with one
// saved opens a submenu to continue it or start a new one.
// Training swaps in a second menu listing the unit classes; picking one
// starts a small practice battle with that unit. Settings swaps in the
// settings menu, whose Game Configs opens the config editor (#/configs). Works with the keyboard
// (arrows + Enter/Z to choose, Esc/X to go back — same keys as the map) and
// the mouse (right click goes back).
export function TitleScreen() {
  const [view, setView] = useState<View>('main');
  const [menu, setMenu] = useState(() => mainMenu());
  const listRef = useRef<HTMLUListElement>(null);

  // On short windows the screen scrolls; keep the selected entry in view as
  // the keyboard moves it (the mouse can only select what's already visible).
  useEffect(() => {
    listRef.current?.children[menu.selectedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [menu.selectedIndex, view]);

  function openSubmenu(submenu: Exclude<View, 'main'>) {
    setView(submenu);
    setMenu(createActionMenu(SUBMENUS[submenu].actions()));
  }

  // Back to the main menu, with the entry that opened the submenu selected.
  function backToMain() {
    setMenu(mainMenu(TITLE_ACTIONS.findIndex((action) => action.id === view)));
    setView('main');
  }

  // Carries out a menu choice. Warband Mode starts a new run, or with a run
  // saved opens a submenu to continue it or start over.
  function runAction(action: MenuAction | null) {
    if (!action) return;
    if (view === 'settings') {
      if (action.id === 'configs') window.location.hash = routeHash({ page: 'configs' });
    } else if (view === 'warband') {
      if (action.id === 'continue-run') playRun(loadSavedRun() ?? newRun());
      else if (action.id === 'new-run') playRun(newRun());
    } else if (view === 'training') {
      gameStore.setState({ screen: 'battle', battleSetup: { mode: 'training', unitClass: action.id } });
    } else if (action.id === 'story') {
      gameStore.setState({ screen: 'battle', battleSetup: FIRST_STORY_CHAPTER });
    } else if (action.id === 'warband') {
      if (loadSavedRun()) openSubmenu('warband');
      else playRun(newRun());
    } else if (action.id === 'training' || action.id === 'settings') {
      openSubmenu(action.id);
    }
  }

  // Saves `run` and starts its current stage.
  function playRun(run: RunState) {
    saveRun(run);
    gameStore.setState({ screen: 'battle', battleSetup: runStage(run) });
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        setMenu((current) => moveSelection(current, event.key === 'ArrowUp' ? -1 : 1));
      } else if (event.key === 'Enter' || event.key === 'z' || event.key === 'Z') {
        event.preventDefault();
        runAction(getSelectedAction(menu));
      } else if (event.key === 'Escape' || event.key === 'x' || event.key === 'X') {
        if (view !== 'main') {
          event.preventDefault();
          backToMain();
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  function onContextMenu(event: ReactMouseEvent) {
    event.preventDefault();
    if (view !== 'main') backToMain();
  }

  const submenu = view === 'main' ? null : SUBMENUS[view];

  return (
    <div className="title-screen" onContextMenu={onContextMenu}>
      <header className="title-screen__header">
        <Crest />
        <h1 className="title-screen__title">Rogue Emblem</h1>
        <div className="title-screen__rule" aria-hidden="true">
          <span>◆</span>
        </div>
      </header>

      <nav className="title-menu" aria-label={submenu?.label ?? 'Main menu'}>
        {submenu && <h2 className="title-menu__heading">{submenu.heading}</h2>}
        <ul className="title-menu__list" ref={listRef}>
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
        {submenu ? '↑↓ Select · Enter Confirm · Esc Back' : '↑↓ Select · Enter Confirm'}
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
