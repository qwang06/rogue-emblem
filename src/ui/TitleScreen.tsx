import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import type { MenuAction } from '../game/actionMenu.ts';
import { gameStore } from '../bridge/gameStore.ts';
import { createActionMenu, getSelectedAction, moveSelection, selectIndex } from '../game/actionMenu.ts';
import {
  getFirstEnabledIndex,
  getWarbandActions,
  SETTINGS_ACTIONS,
  STARTING_CLASS_ACTIONS,
  TITLE_ACTIONS,
  type StartingClassAction,
} from '../game/titleMenu.ts';
import { getTrainingActions } from '../game/trainingLevel.ts';
import { FIRST_STORY_CHAPTER, runStage } from '../game/battleSetup.ts';
import { randomSeed } from '../game/rng.ts';
import { createRun, type RunState } from '../game/warband/run.ts';
import { createStartingWarband } from '../game/warband/stageLevel.ts';
import { loadSavedRun, saveRun } from '../data/runSave.ts';
import { getUnitSprite } from '../game/tileset.ts';
import { routeHash } from './route.ts';
import { UnitSprite } from './UnitSprite.tsx';
import { KeyHint } from './KeyHint.tsx';

const MENU_KEYS = [
  ['↑↓', 'Select'],
  ['Enter', 'Confirm'],
] as const;

type View = 'main' | 'training' | 'warband' | 'new-run' | 'settings';

// The submenus title entries open: their heading, and the entries to list.
// New Run is a submenu of Warband Mode's, and Back returns there.
const SUBMENUS = {
  training: { heading: 'Training — Choose a Unit', label: 'Choose a unit to train', actions: getTrainingActions },
  warband: { heading: 'Warband Mode', label: 'Warband Mode', actions: () => getWarbandActions(loadSavedRun()) },
  'new-run': { heading: 'New Run — Choose a Class', label: 'Choose a class', actions: () => STARTING_CLASS_ACTIONS },
  settings: { heading: 'Settings', label: 'Settings', actions: () => SETTINGS_ACTIONS },
} as const;

// A fresh run with a starting warband of `classId`.
function newRun(classId?: string): RunState {
  return createRun(randomSeed(), createStartingWarband(classId));
}

function mainMenu(selectedIndex = 0) {
  return selectIndex(createActionMenu(TITLE_ACTIONS), selectedIndex);
}

// The landing screen: game title plus the Story Mode / Warband Mode /
// Training / Settings menu. Warband Mode opens a submenu to continue the
// saved run (disabled when there's none) or start a new one, and New Run
// opens one more to pick the base class the warband starts as.
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

  // Opens a submenu with `selectedId`'s entry selected, else its first
  // enabled one.
  function openSubmenu(submenu: Exclude<View, 'main'>, selectedId?: string) {
    const actions = SUBMENUS[submenu].actions();
    const selected = actions.findIndex((action) => action.id === selectedId);
    setView(submenu);
    setMenu(selectIndex(createActionMenu(actions), selected >= 0 ? selected : getFirstEnabledIndex(actions)));
  }

  // Back a level, with the entry that opened the submenu selected: from
  // New Run to Warband Mode's submenu, from the rest to the main menu.
  function goBack() {
    if (view === 'new-run') {
      openSubmenu('warband', 'new-run');
      return;
    }
    setMenu(mainMenu(TITLE_ACTIONS.findIndex((action) => action.id === view)));
    setView('main');
  }

  // Carries out a menu choice; disabled entries do nothing.
  function runAction(action: MenuAction | null) {
    if (!action || action.disabled) return;
    if (view === 'settings') {
      if (action.id === 'configs') window.location.hash = routeHash({ page: 'configs' });
    } else if (view === 'warband') {
      if (action.id === 'continue-run') {
        const saved = loadSavedRun();
        if (saved) playRun(saved);
        else openSubmenu('warband', 'new-run');
      } else if (action.id === 'new-run') openSubmenu('new-run');
    } else if (view === 'new-run') {
      playRun(newRun(action.id));
    } else if (view === 'training') {
      gameStore.setState({ screen: 'battle', battleSetup: { mode: 'training', unitClass: action.id } });
    } else if (action.id === 'story') {
      gameStore.setState({ screen: 'battle', battleSetup: FIRST_STORY_CHAPTER });
    } else if (action.id === 'warband' || action.id === 'training' || action.id === 'settings') {
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
          goBack();
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  function onContextMenu(event: ReactMouseEvent) {
    event.preventDefault();
    if (view !== 'main') goBack();
  }

  const submenu = view === 'main' ? null : SUBMENUS[view];
  // The pitch of the class selected on the New Run submenu.
  const description =
    view === 'new-run' ? (getSelectedAction(menu) as StartingClassAction | null)?.description : undefined;

  return (
    <div className="title-screen" onContextMenu={onContextMenu}>
      <header className="title-screen__header">
        <WarbandLineup />
        <h1 className="title-screen__title">Rogue Emblem</h1>
      </header>

      <nav className="panel title-menu" aria-label={submenu?.label ?? 'Main menu'}>
        {submenu && <h2 className="title-menu__heading">{submenu.heading}</h2>}
        <ul className="title-menu__list" ref={listRef}>
          {menu.actions.map((action, index) => {
            const selected = index === menu.selectedIndex;
            const classes = ['title-menu__item'];
            if (selected) classes.push('title-menu__item--selected');
            if (action.disabled) classes.push('title-menu__item--disabled');
            if (view === 'new-run') classes.push('title-menu__item--class');
            return (
              <li key={action.id}>
                <button
                  type="button"
                  className={classes.join(' ')}
                  aria-current={selected ? 'true' : undefined}
                  aria-disabled={action.disabled ? 'true' : undefined}
                  onMouseEnter={() => setMenu((current) => selectIndex(current, index))}
                  onClick={() => runAction(action)}
                >
                  {view === 'new-run' && (
                    <UnitSprite sprite={getUnitSprite(action.id)} scale={1.5} animated={selected} />
                  )}
                  {action.label}
                </button>
              </li>
            );
          })}
        </ul>
        {view === 'new-run' && (
          <p className="title-menu__description" aria-live="polite">
            {description}
          </p>
        )}
      </nav>

      <KeyHint className="title-screen__hint" entries={submenu ? [...MENU_KEYS, ['Esc', 'Back']] : MENU_KEYS} />
    </div>
  );
}

// The starting classes standing in a row on a strip of turf, idling. The
// title screen's crest, and shown on the loading screen too.
export function WarbandLineup() {
  return (
    <div className="warband-lineup" aria-hidden="true">
      {STARTING_CLASS_ACTIONS.map((action) => (
        <UnitSprite key={action.id} sprite={getUnitSprite(action.id)} scale={3} animated />
      ))}
    </div>
  );
}
