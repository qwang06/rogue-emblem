// Pure logic for the unit action menu: which actions are offered and which
// one is highlighted. Choosing an action is the caller's job — this module
// only tracks the selection. No Phaser, no rendering, no hidden state.

export const UNIT_ACTIONS = Object.freeze([
  Object.freeze({ id: 'move', label: 'Move' }),
  Object.freeze({ id: 'attack', label: 'Attack' }),
  Object.freeze({ id: 'item', label: 'Item' }),
  Object.freeze({ id: 'wait', label: 'Wait' }),
]);

export function createActionMenu(actions = UNIT_ACTIONS) {
  return Object.freeze({ actions, selectedIndex: 0 });
}

// Moves the highlight by delta, wrapping around both ends of the list.
export function moveSelection(menu, delta) {
  const count = menu.actions.length;
  if (count === 0) return menu;
  const selectedIndex = (((menu.selectedIndex + delta) % count) + count) % count;
  if (selectedIndex === menu.selectedIndex) return menu;
  return Object.freeze({ ...menu, selectedIndex });
}

export function getSelectedAction(menu) {
  return menu.actions[menu.selectedIndex] ?? null;
}
