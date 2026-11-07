import type { ReactNode } from 'react';
import { gameCommands, type MenuField } from '../bridge/commands.ts';
import type { GameState } from '../bridge/gameStore.ts';
import type { Menu, MenuAction } from '../game/actionMenu.ts';
import type { ItemAction } from '../game/items.ts';
import type { SkillAction } from '../game/skills.ts';
import type { WeaponAction } from '../game/weapons.ts';
import { isOnField } from './dock.tsx';
import { ItemIcon } from './ItemIcon.tsx';
import { KeyHint, type KeyHintEntry } from './KeyHint.tsx';
import { MenuIcon } from './MenuIcon.tsx';
import { menuItemPointerProps } from './menuPointer.ts';
import { useGameStore } from './useGameStore.ts';

// What the player can do right now, for the bar's key hints: whether a
// menu or the unit info sheet owns the input, a tile is being picked, or
// the cursor roams the map.
type Mode =
  'deploy-menu' | 'deploy-roster' | 'placing' | 'info' | 'pause' | 'menu' | 'move' | 'target' | 'roam' | 'waiting';

function getMode(state: GameState): Mode {
  if (state.unitInfo) return 'info';
  if (state.phase === 'deployment') {
    if (state.deploymentStep === 'placing') return 'placing';
    return state.deploymentStep === 'roster' ? 'deploy-roster' : 'deploy-menu';
  }
  if (state.turn?.team !== 'player' || state.autoPlay) return 'waiting';
  if (state.pauseMenu) return 'pause';
  if (state.actionMenu || state.weaponMenu || state.skillMenu || state.itemMenu) return 'menu';
  if (state.targeting === 'move') return 'move';
  if (state.targeting) return 'target';
  return 'roam';
}

const HINTS: Readonly<Record<Mode, readonly KeyHintEntry[]>> = {
  'deploy-menu': [
    ['←→', 'Choose'],
    ['Enter', 'Confirm'],
  ],
  'deploy-roster': [
    ['↑↓', 'Choose'],
    ['Enter', 'Confirm'],
    ['Esc', 'Back'],
  ],
  placing: [
    ['←↑↓→', 'Tile'],
    ['Enter', 'Place'],
    ['Esc', 'Back'],
  ],
  info: [
    ['I', 'Close'],
    ['Esc', 'Close'],
  ],
  pause: [
    ['↑↓', 'Choose'],
    ['Enter', 'Confirm'],
    ['Esc', 'Back'],
  ],
  // The chips carry their number keys, so the row needs no Choose hint
  // and keeps its width for the entries.
  menu: [
    ['Enter', 'Confirm'],
    ['Esc', 'Back'],
  ],
  move: [
    ['←↑↓→', 'Tile'],
    ['Enter', 'Move'],
    ['Esc', 'Back'],
  ],
  target: [
    ['←↑↓→', 'Target'],
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

// Browsing a Warband run's relics (RelicBar), while the map is idle.
const RELICS_HINT: KeyHintEntry = ['Q', 'Relics'];

// One line on what the mode expects, under the hints (while the other
// side moves, that it is).
const PROMPTS: Readonly<Record<Mode, string>> = {
  'deploy-menu': 'Start the battle, or place units to move or swap them',
  'deploy-roster': 'Pick a unit to place',
  placing: 'Pick a highlighted tile for the unit',
  info: "The unit's full sheet",
  pause: '',
  menu: '',
  move: 'Pick where the unit moves',
  target: 'Pick a target',
  roam: 'Pick a unit to move it',
  waiting: 'The other side is moving',
};

// What each entry of the action and deployment menus does, for the
// detail line under the chips.
const ACTION_DETAILS: Readonly<Record<string, string>> = {
  attack: 'Strike a foe in reach with a weapon',
  heal: 'Mend a wounded ally in reach',
  skill: 'Use a learned skill',
  item: 'Use a potion from the bag',
  wait: "End this unit's turn where it stands",
  'place-units': 'Pick a unit, then a tile in the deployment zone',
  start: 'Begin the battle with the units placed',
};

// A menu that owns the bar's command row: its store field, so hovering
// and clicking a chip reach GridScene, plus how each entry draws and what
// the detail line says for the chosen one.
interface OpenMenu {
  field: MenuField;
  actions: readonly MenuAction[];
  selectedIndex: number;
  chip: (action: MenuAction) => ReactNode;
  detail: (action: MenuAction) => ReactNode;
}

function openMenu<T extends MenuAction>(
  field: MenuField,
  menu: Menu<T>,
  chip: (action: T) => ReactNode,
  detail: (action: T) => ReactNode,
): OpenMenu {
  return {
    field,
    actions: menu.actions,
    selectedIndex: menu.selectedIndex,
    chip: (action) => chip(action as T),
    detail: (action) => detail(action as T),
  };
}

const iconChip = (action: MenuAction) => (
  <>
    <MenuIcon id={action.id} />
    <span className="command-chip__label">{action.label}</span>
  </>
);

// The menus the row can show, picked from the store one by one (a selector
// building a fresh object each time would never settle).
type OpenMenus = Pick<
  GameState,
  'weaponMenu' | 'skillMenu' | 'itemMenu' | 'actionMenu' | 'deploymentMenu' | 'deploymentStep'
>;

function getOpenMenu(state: OpenMenus): OpenMenu | null {
  if (state.weaponMenu) {
    return openMenu<WeaponAction>(
      'weaponMenu',
      state.weaponMenu,
      (weapon) => (
        <>
          <ItemIcon itemId={weapon.itemId} />
          <span className="command-chip__label command-chip__label--name">{weapon.label}</span>
        </>
      ),
      (weapon) => (
        <dl className="command-detail__numbers">
          <Number label="Pow" value={weapon.power} />
          <Number label="Hit" value={weapon.hit} />
          <Number label="Crt" value={weapon.crit} />
          <Number label="Wt" value={weapon.weight} />
          <Number label="Rng" value={weapon.range} />
          <span className="command-detail__type">{weapon.type}</span>
        </dl>
      ),
    );
  }
  if (state.skillMenu) {
    return openMenu<SkillAction>(
      'skillMenu',
      state.skillMenu,
      (skill) => (
        <>
          <span className="command-chip__label">{skill.label}</span>
          <span className="command-chip__note">{skill.manaCost} MP</span>
        </>
      ),
      (skill) => skill.description,
    );
  }
  if (state.itemMenu) {
    return openMenu<ItemAction>(
      'itemMenu',
      state.itemMenu,
      (item) => (
        <>
          <ItemIcon itemId={item.id} />
          <span className="command-chip__label command-chip__label--name">{item.label}</span>
          <span className="command-chip__note">×{item.quantity}</span>
        </>
      ),
      (item) => (item.disabled ? 'Nothing to restore right now' : 'Use it on this unit'),
    );
  }
  if (state.actionMenu) {
    return openMenu('actionMenu', state.actionMenu, iconChip, (action) => ACTION_DETAILS[action.id] ?? '');
  }
  if (state.deploymentMenu && state.deploymentStep === 'menu') {
    return openMenu('deploymentMenu', state.deploymentMenu, iconChip, (action) => ACTION_DETAILS[action.id] ?? '');
  }
  return null;
}

function Number({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="command-detail__number">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

// The strip under the board all through a battle. On the left, the
// command row: while a unit's menu (action, weapon, skill, item) or the
// deployment menu is open, its entries as a row of chips with the chosen
// one's detail on the line under them (GridScene drives the choice; the
// mouse is forwarded to it), otherwise the keys that matter in the
// current mode and a line on what it expects. On the right, the two big
// commands, Undo and End Turn (what the pause menu also offers), which
// GridScene carries out when the map is idle in the player's phase (they
// stay, dimmed, through the other sides' phases). Both rows are always
// laid out, so the board never resizes as the mode changes.
export function BattleBar() {
  const onField = useGameStore(isOnField);
  const mode = useGameStore(getMode);
  const weaponMenu = useGameStore((state) => state.weaponMenu);
  const skillMenu = useGameStore((state) => state.skillMenu);
  const itemMenu = useGameStore((state) => state.itemMenu);
  const actionMenu = useGameStore((state) => state.actionMenu);
  const deploymentMenu = useGameStore((state) => state.deploymentMenu);
  const deploymentStep = useGameStore((state) => state.deploymentStep);
  const menu = getOpenMenu({ weaponMenu, skillMenu, itemMenu, actionMenu, deploymentMenu, deploymentStep });
  const turn = useGameStore((state) => state.turn);
  const phase = useGameStore((state) => state.phase);
  const hasRelics = useGameStore((state) => (state.runRelics?.length ?? 0) > 0);
  if (!onField) return null;

  const idle = mode === 'roam';
  const hints = mode === 'roam' && hasRelics ? [...HINTS.roam, RELICS_HINT] : HINTS[mode];
  const chosen = menu?.actions[menu.selectedIndex] ?? null;
  return (
    <footer className="battle-bar">
      <div className="battle-bar__main">
        {menu ? (
          <ul className="command-row" aria-label="Commands">
            {menu.actions.map((action, index) => {
              const selected = index === menu.selectedIndex;
              const classes = ['command-chip'];
              if (selected) classes.push('command-chip--selected');
              if (action.disabled) classes.push('command-chip--disabled');
              return (
                <li
                  key={action.id}
                  className={classes.join(' ')}
                  aria-current={selected ? 'true' : undefined}
                  aria-disabled={action.disabled ? 'true' : undefined}
                  {...menuItemPointerProps(menu.field, index)}
                >
                  {index < 9 && <kbd className="command-chip__key">{index + 1}</kbd>}
                  {menu.chip(action)}
                </li>
              );
            })}
          </ul>
        ) : (
          <KeyHint className="battle-bar__hints" entries={hints} />
        )}
        <div className="command-detail">{menu && chosen ? menu.detail(chosen) : PROMPTS[mode]}</div>
      </div>
      <div className="battle-bar__commands">
        {menu ? (
          <KeyHint className="battle-bar__hints" entries={hints} />
        ) : phase === 'battle' && turn ? (
          <>
            <button
              type="button"
              className="battle-bar__button"
              disabled={!idle}
              onClick={() => gameCommands.send({ type: 'undo' })}
            >
              <MenuIcon id="undo" />
              Undo
            </button>
            <button
              type="button"
              className="battle-bar__button battle-bar__button--end"
              disabled={!idle}
              onClick={() => gameCommands.send({ type: 'end-turn' })}
            >
              <MenuIcon id="end-turn" />
              End Turn
            </button>
          </>
        ) : null}
      </div>
    </footer>
  );
}
