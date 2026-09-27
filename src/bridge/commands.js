// The React → Phaser direction of the bridge. React sends plain command
// objects (e.g. the player clicked a menu entry) and whichever scene is
// listening acts on them; neither side imports the other.
//
// Commands:
//   { type: 'hover-menu', menu, index }  — pointer is over entry `index` of the store menu `menu`
//   { type: 'select-menu', menu, index } — entry `index` of `menu` was clicked
//   { type: 'confirm' }                  — same as pressing Enter/Z
//   { type: 'cancel' }                   — same as pressing Esc/X

export function createCommandChannel() {
  const handlers = new Set();

  return {
    send(command) {
      for (const handler of handlers) handler(command);
    },
    subscribe(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
  };
}

// The single app-wide channel, alongside gameStore.
export const gameCommands = createCommandChannel();
