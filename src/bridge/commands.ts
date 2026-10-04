// The React → Phaser direction of the bridge. React sends plain command
// objects (e.g. the player clicked a menu entry) and whichever scene is
// listening acts on them; neither side imports the other.
//
// Commands:
//   { type: 'hover-menu', menu, index }  — pointer is over entry `index` of the store menu `menu`
//   { type: 'select-menu', menu, index } — entry `index` of `menu` was clicked
//   { type: 'confirm' }                  — same as pressing Enter/Z
//   { type: 'cancel' }                   — same as pressing Esc/X
//   { type: 'main-menu' }                — leave the battle for the title screen, whatever is going on

// Store fields holding a menu React can point at.
export type MenuField =
  'actionMenu' | 'weaponMenu' | 'skillMenu' | 'itemMenu' | 'deploymentMenu' | 'rosterMenu' | 'pauseMenu';

export type Command =
  | { type: 'hover-menu'; menu: MenuField; index: number }
  | { type: 'select-menu'; menu: MenuField; index: number }
  | { type: 'confirm' }
  | { type: 'cancel' }
  | { type: 'main-menu' };

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
