import { gameCommands } from '../bridge/commands.js';

// Mouse handlers for an entry of a map menu that GridScene drives. `menu`
// is the menu's store field (e.g. 'actionMenu'): hovering an entry
// highlights it and clicking picks it, exactly as the keyboard would.
export function menuItemPointerProps(menu, index) {
  return {
    onMouseEnter: () => gameCommands.send({ type: 'hover-menu', menu, index }),
    onClick: () => gameCommands.send({ type: 'select-menu', menu, index }),
  };
}
