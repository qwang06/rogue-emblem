// Pure logic for the unit action menu: which actions are offered and which
// one is highlighted. Choosing an action is the caller's job — this module
// only tracks the selection. No Phaser, no rendering, no hidden state.

// A menu entry. `disabled` entries are shown but can't be chosen; extra
// fields (a quantity, a mana cost) ride along for the UI.
export interface MenuAction {
  id: string;
  label: string;
  disabled?: boolean;
}

export interface Menu<A extends MenuAction = MenuAction> {
  actions: readonly A[];
  selectedIndex: number;
}

// Units move before the menu opens (selecting a unit shows its move range
// right away), so moving isn't one of the actions.
export const UNIT_ACTIONS: readonly MenuAction[] = Object.freeze([
  Object.freeze({ id: 'attack', label: 'Attack' }),
  Object.freeze({ id: 'skill', label: 'Skill' }),
  Object.freeze({ id: 'item', label: 'Item' }),
  Object.freeze({ id: 'wait', label: 'Wait' }),
]);

// The unit actions for a particular unit. Skill is disabled when the unit
// knows no skills and Item when it carries no items; the caller decides
// what disabled means for input.
export function getUnitActions({
  hasSkills,
  hasItems = true,
}: {
  hasSkills: boolean;
  hasItems?: boolean;
}): readonly MenuAction[] {
  const disabled = (id: string) => (id === 'skill' && !hasSkills) || (id === 'item' && !hasItems);
  return Object.freeze(
    UNIT_ACTIONS.map((action) => (disabled(action.id) ? Object.freeze({ ...action, disabled: true }) : action)),
  );
}

export function createActionMenu<A extends MenuAction = MenuAction>(
  actions: readonly A[] = UNIT_ACTIONS as readonly A[],
): Menu<A> {
  return Object.freeze({ actions, selectedIndex: 0 });
}

// Moves the highlight by delta, wrapping around both ends of the list.
export function moveSelection<M extends Menu<MenuAction>>(menu: M, delta: number): M {
  const count = menu.actions.length;
  if (count === 0) return menu;
  const selectedIndex = (((menu.selectedIndex + delta) % count) + count) % count;
  if (selectedIndex === menu.selectedIndex) return menu;
  return Object.freeze({ ...menu, selectedIndex });
}

// Jumps the highlight straight to index (e.g. on mouse hover). Out-of-range
// indices and no-op changes return the same menu.
export function selectIndex<M extends Menu<MenuAction>>(menu: M, index: number): M {
  if (!Number.isInteger(index) || index < 0 || index >= menu.actions.length) return menu;
  if (index === menu.selectedIndex) return menu;
  return Object.freeze({ ...menu, selectedIndex: index });
}

export function getSelectedAction<A extends MenuAction>(menu: Menu<A>): A | null {
  return menu.actions[menu.selectedIndex] ?? null;
}
