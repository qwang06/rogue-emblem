// Pure logic for the unit action menu: which actions are offered and which
// one is highlighted. Choosing an action is the caller's job — this module
// only tracks the selection. No Phaser, no rendering, no hidden state.

export const UNIT_ACTIONS = Object.freeze([
  Object.freeze({ id: 'move', label: 'Move' }),
  Object.freeze({ id: 'attack', label: 'Attack' }),
  Object.freeze({ id: 'skill', label: 'Skill' }),
  Object.freeze({ id: 'item', label: 'Item' }),
  Object.freeze({ id: 'wait', label: 'Wait' }),
]);

// The unit actions for a particular unit. Skill is disabled when the unit
// knows no skills, Item when it carries no items, and Move once the unit
// has already moved this phase; the caller decides what disabled means
// for input.
export function getUnitActions({ hasSkills, hasItems = true, hasMoved = false }) {
  const disabled = (id) =>
    (id === 'skill' && !hasSkills) || (id === 'item' && !hasItems) || (id === 'move' && hasMoved);
  return Object.freeze(
    UNIT_ACTIONS.map((action) => (disabled(action.id) ? Object.freeze({ ...action, disabled: true }) : action)),
  );
}

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

// Jumps the highlight straight to index (e.g. on mouse hover). Out-of-range
// indices and no-op changes return the same menu.
export function selectIndex(menu, index) {
  if (!Number.isInteger(index) || index < 0 || index >= menu.actions.length) return menu;
  if (index === menu.selectedIndex) return menu;
  return Object.freeze({ ...menu, selectedIndex: index });
}

export function getSelectedAction(menu) {
  return menu.actions[menu.selectedIndex] ?? null;
}
