import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import type { MenuAction } from '../game/actionMenu.ts';
import { gameStore } from '../bridge/gameStore.ts';
import { changeVolume, cycleVolume, toggleMute, type AudioSettings, type VolumeChannel } from '../audio/settings.ts';
import { createActionMenu, getSelectedAction, moveSelection, selectIndex } from '../game/actionMenu.ts';
import {
  describeRenown,
  getFirstEnabledIndex,
  getStartingClassActions,
  getWarbandActions,
  getSettingsActions,
  STARTING_CLASS_ACTIONS,
  TITLE_ACTIONS,
  type StartingClassAction,
} from '../game/titleMenu.ts';
import { getTrainingActions } from '../game/trainingLevel.ts';
import { FIRST_STORY_CHAPTER } from '../game/battleSetup.ts';
import { createSeededRng, randomSeed } from '../game/rng.ts';
import { generateName } from '../game/warband/names.ts';
import { createRun, type RunState } from '../game/warband/run.ts';
import { applyRunCommand, getRelicOffers, startRunSession } from '../game/warband/runCommands.ts';
import { createStartingWarband } from '../game/warband/stageLevel.ts';
import { loadSavedRun } from '../data/runSave.ts';
import { enterRun } from '../bridge/warbandFlow.ts';
import { startRoute } from '../game/warband/travel.ts';
import { loadMeta } from '../data/metaSave.ts';
import { getUnitSprite } from '../game/tileset.ts';
import { routeHash } from './route.ts';
import { UnitSprite } from './UnitSprite.tsx';
import { Frame } from './Frame.tsx';
import { KeyHint } from './KeyHint.tsx';
import { NameField } from './NameField.tsx';

const MENU_KEYS = [
  ['↑↓', 'Select'],
  ['Enter', 'Confirm'],
] as const;

type View = 'main' | 'training' | 'warband' | 'new-run' | 'relic' | 'settings';

// The submenus title entries open: their heading, and the entries to list.
// New Run is a submenu of Warband Mode's, and Back returns there.
const SUBMENUS = {
  training: { heading: 'Training — Choose a Unit', label: 'Choose a unit to train', actions: getTrainingActions },
  warband: { heading: 'Warband Mode', label: 'Warband Mode', actions: () => getWarbandActions(loadSavedRun()) },
  'new-run': {
    heading: 'New Run — Choose a Class',
    label: 'Choose a class',
    actions: () => getStartingClassActions(loadMeta()),
  },
  // Filled in from the new run (relicActions), which the class pick makes.
  relic: { heading: 'New Run — Choose a Relic', label: 'Choose a relic', actions: () => [] },
  settings: { heading: 'Settings', label: 'Settings', actions: () => getSettingsActions(gameStore.getState().audio) },
} as const;

const VOLUME_KEYS = [['←→', 'Volume']] as const;

// Whether a Settings entry is one of the volumes (its id names the field).
function isVolumeChannel(id: string | undefined): id is VolumeChannel {
  return id === 'volume' || id === 'musicVolume';
}

const NAME_KEYS = [
  ['R', 'New name'],
  ['E', 'Rename'],
] as const;

// A fresh run with a starting warband of `classId` named `name`, at home
// on its realm.
function newRun(classId: string, name: string): RunState {
  return startRoute(createRun(randomSeed(), createStartingWarband(classId, name)));
}

// A generated name for the unit a new run starts with, other than `current`.
function rollName(current?: string): string {
  return generateName(createSeededRng(randomSeed()), current);
}

// The starting relics `run` offers (see rollStartingRelics), as entries
// whose description is the relic's.
function relicActions(run: RunState): StartingClassAction[] {
  return getRelicOffers(startRunSession(run)).map(({ id, name, description }) => ({ id, label: name, description }));
}

function mainMenu(selectedIndex = 0) {
  return selectIndex(createActionMenu(TITLE_ACTIONS), selectedIndex);
}

// The landing screen: the logo over a castle landscape, plus the Story Mode / Warband Mode /
// Training / Settings menu. Warband Mode opens a submenu to continue the
// saved run (disabled when there's none) or start a new one, and New Run
// opens one more to pick the base class the warband starts as, and the
// name of its unit: generated, with buttons (and R / E) to roll another
// or type one. Then the run's starting relic is picked from three, and
// the run begins.
// Training swaps in a second menu listing the unit classes; picking one
// starts a small practice battle with that unit. Settings swaps in the
// settings menu, whose Game Configs opens the config editor (#/configs). Works with the keyboard
// (arrows + Enter/Z to choose, Esc/X to go back — same keys as the map) and
// the mouse (right click goes back).
export function TitleScreen() {
  const [view, setView] = useState<View>('main');
  const [menu, setMenu] = useState(() => mainMenu());
  const [unitName, setUnitName] = useState(rollName);
  const [editingName, setEditingName] = useState(false);
  // The run the class pick made, while its starting relic is picked.
  const [pendingRun, setPendingRun] = useState<RunState | null>(null);
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
    if (submenu === 'new-run') setUnitName(rollName);
    setEditingName(false);
    setView(submenu);
    setMenu(selectIndex(createActionMenu(actions), selected >= 0 ? selected : getFirstEnabledIndex(actions)));
  }

  // Back a level, with the entry that opened the submenu selected: from
  // New Run to Warband Mode's submenu, from the rest to the main menu.
  function goBack() {
    if (view === 'relic') {
      // Back to the class pick, keeping the name.
      const actions = STARTING_CLASS_ACTIONS;
      const selected = actions.findIndex((action) => action.id === pendingRun?.roster[0]?.classId);
      setPendingRun(null);
      setView('new-run');
      setMenu(selectIndex(createActionMenu(actions), Math.max(0, selected)));
      return;
    }
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
      if (action.id === 'sound') changeAudio(toggleMute);
      else if (isVolumeChannel(action.id)) {
        const channel = action.id;
        changeAudio((settings) => cycleVolume(settings, channel));
      } else if (action.id === 'configs') window.location.hash = routeHash({ page: 'configs' });
    } else if (view === 'warband') {
      if (action.id === 'continue-run') {
        const saved = loadSavedRun();
        if (saved) playRun(saved);
        else openSubmenu('warband', 'new-run');
      } else if (action.id === 'new-run') openSubmenu('new-run');
    } else if (view === 'new-run') {
      const run = newRun(action.id, unitName);
      setPendingRun(run);
      setView('relic');
      setMenu(createActionMenu(relicActions(run)));
    } else if (view === 'relic' && pendingRun) {
      const index = menu.actions.findIndex((entry) => entry.id === action.id);
      playRun(applyRunCommand(startRunSession(pendingRun), { type: 'pick-relic', index }).session.run);
    } else if (view === 'training') {
      gameStore.setState({ screen: 'battle', battleSetup: { mode: 'training', unitClass: action.id } });
    } else if (action.id === 'story') {
      gameStore.setState({ screen: 'battle', battleSetup: FIRST_STORY_CHAPTER });
    } else if (action.id === 'warband' || action.id === 'training' || action.id === 'settings') {
      openSubmenu(action.id);
    }
  }

  // Changes the sound settings (src/audio/index.ts plays and saves them)
  // and relabels the settings menu to match, keeping its selection.
  function changeAudio(update: (settings: AudioSettings) => AudioSettings) {
    const audio = update(gameStore.getState().audio);
    gameStore.setState({ audio });
    setMenu((current) => selectIndex(createActionMenu(getSettingsActions(audio)), current.selectedIndex));
  }

  // Saves `run` and carries on with it: the overworld, or its stage.
  function playRun(run: RunState) {
    enterRun(run);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const selectedId = getSelectedAction(menu)?.id;
      // The name box handles its own keys.
      if (editingName || event.target instanceof HTMLInputElement) return;
      if (view === 'new-run' && (event.key === 'r' || event.key === 'R')) {
        event.preventDefault();
        setUnitName(rollName);
      } else if (view === 'new-run' && (event.key === 'e' || event.key === 'E')) {
        event.preventDefault();
        setEditingName(true);
      } else if (
        view === 'settings' &&
        isVolumeChannel(selectedId) &&
        (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
      ) {
        event.preventDefault();
        changeAudio((settings) => changeVolume(settings, event.key === 'ArrowLeft' ? -1 : 1, selectedId));
      } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
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
    if (editingName) return;
    event.preventDefault();
    if (view !== 'main') goBack();
  }

  const submenu = view === 'main' ? null : SUBMENUS[view];
  // The pitch of the class or relic selected on the New Run submenus.
  const description =
    view === 'new-run' || view === 'relic'
      ? (getSelectedAction(menu) as StartingClassAction | null)?.description
      : undefined;

  return (
    <div className="title-screen" onContextMenu={onContextMenu}>
      <Corners className="title-screen__frame" />

      <header className="title-screen__header">
        <h1 className="title-logo" aria-label="Rogue Emblem">
          <span className="title-logo__sword" aria-hidden="true" />
          <LogoLine className="title-logo__rogue" text="Rogue" />
          <LogoLine className="title-logo__emblem" text="Emblem" />
        </h1>
      </header>

      <Frame as="nav" className="title-menu" aria-label={submenu?.label ?? 'Main menu'}>
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
          <NameField
            name={unitName}
            editing={editingName}
            onReroll={() => setUnitName(rollName)}
            onEdit={() => setEditingName(true)}
            onRename={(name) => {
              setUnitName(name);
              setEditingName(false);
            }}
            onCancel={() => setEditingName(false)}
          />
        )}
        {view === 'warband' && <p className="title-menu__renown">{describeRenown(loadMeta())}</p>}
        {(view === 'new-run' || view === 'relic') && (
          <p className="title-menu__description" aria-live="polite">
            {description}
          </p>
        )}
      </Frame>

      <KeyHint
        className="title-screen__hint"
        entries={
          view === 'new-run'
            ? [...MENU_KEYS, ...NAME_KEYS, ['Esc', 'Back']]
            : view === 'settings'
              ? [...MENU_KEYS, ...VOLUME_KEYS, ['Esc', 'Back']]
              : submenu
                ? [...MENU_KEYS, ['Esc', 'Back']]
                : MENU_KEYS
        }
      />
    </div>
  );
}

// One line of the logo: the word three times over, stacked, so it can be
// drawn as a dark outline, a gold rim and a blue fill (see ui.css).
function LogoLine({ text, className }: { text: string; className: string }) {
  return (
    <span className={`title-logo__line ${className}`} aria-hidden="true">
      <span className="title-logo__outline">{text}</span>
      <span className="title-logo__rim">{text}</span>
      <span className="title-logo__fill">{text}</span>
    </span>
  );
}

// Gold ornaments on the screen frame's four corners, laid over its border.
function Corners({ className }: { className: string }) {
  return (
    <span className={`title-corners ${className}`} aria-hidden="true">
      <span className="title-corners__piece title-corners__piece--tl" />
      <span className="title-corners__piece title-corners__piece--tr" />
      <span className="title-corners__piece title-corners__piece--bl" />
      <span className="title-corners__piece title-corners__piece--br" />
    </span>
  );
}

// The starting classes standing in a row, idling, on the loading screen.
export function WarbandLineup() {
  return (
    <div className="warband-lineup" aria-hidden="true">
      {STARTING_CLASS_ACTIONS.map((action) => (
        <UnitSprite key={action.id} sprite={getUnitSprite(action.id)} scale={3} animated />
      ))}
    </div>
  );
}
