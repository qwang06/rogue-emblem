import type { RosterTarget } from '../game/warband/rosterScreen.ts';

// The React → Phaser direction of the bridge. React sends plain command
// objects (e.g. the player clicked a menu entry) and whichever scene is
// listening acts on them; neither side imports the other.
//
// Commands:
//   { type: 'hover-menu', menu, index }  — pointer is over entry `index` of the store menu `menu`
//   { type: 'select-menu', menu, index } — entry `index` of `menu` was clicked
//   { type: 'hover-roster', target, index }  — pointer is over entry `index` of a roster screen column (or its item actions)
//   { type: 'select-roster', target, index } — that entry was clicked
//   { type: 'confirm' }                  — same as pressing Enter/Z
//   { type: 'cancel' }                   — same as pressing Esc/X
//   { type: 'main-menu' }                — leave the battle for the title screen, whatever is going on
//   { type: 'toggle-danger-zone' }       — show or hide every enemy's reach, same as pressing D

// Store fields holding a menu React can point at.
export type MenuField =
  | 'actionMenu'
  | 'weaponMenu'
  | 'skillMenu'
  | 'itemMenu'
  | 'deploymentMenu'
  | 'rosterMenu'
  | 'pauseMenu'
  | 'rewardMenu'
  | 'campMenu';

export type Command =
  | { type: 'hover-menu'; menu: MenuField; index: number }
  | { type: 'select-menu'; menu: MenuField; index: number }
  | { type: 'hover-roster'; target: RosterTarget; index: number }
  | { type: 'select-roster'; target: RosterTarget; index: number }
  | { type: 'confirm' }
  | { type: 'cancel' }
  | { type: 'main-menu' }
  | { type: 'toggle-danger-zone' };

export type CommandHandler<C> = (command: C) => void;

export interface CommandChannel<C> {
  send(command: C): void;
  subscribe(handler: CommandHandler<C>): () => void;
}

export function createCommandChannel<C = Command>(): CommandChannel<C> {
  const handlers = new Set<CommandHandler<C>>();

  return {
    send(command) {
      for (const handler of handlers) handler(command);
    },
    subscribe(handler) {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },
  };
}

// The single app-wide channel, alongside gameStore.
export const gameCommands = createCommandChannel();
