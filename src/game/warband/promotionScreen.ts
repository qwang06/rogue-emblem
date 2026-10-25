// The promotion screen at camp (see promotion.ts): one list of every
// promotion the warband could make, each unit that can promote with its
// class's two promotions one after the other, and the cursor on one of
// them. Up and down move it (wrapping), confirm promotes, spending a Master
// Seal, and cancel closes the screen. Every option is disabled while the
// warband holds no seal. Once nobody is left to promote the list is empty
// (isPromotionScreenDone), and the screen closes. Everything here is
// pure: each function returns a new frozen state (or null for closed) and
// leaves its input alone.

import { createActionMenu, moveSelection, selectIndex, type Menu, type MenuAction } from '../actionMenu.ts';
import { getPromotions } from '../promotions.ts';
import { UNIT_CLASSES, type UnitClass } from '../unitClasses.ts';
import { canPromoteInRun, getPromotionCandidates, promoteInRun } from './promotion.ts';
import type { RunState } from './run.ts';

// One promotion to make: the unit and the class it would become.
export interface PromotionOption extends MenuAction {
  unitId: string;
  promotionId: string;
}

export interface PromotionScreenState {
  run: RunState;
  menu: Menu<PromotionOption>;
}

// Every promotion `run` could make, unit by unit in roster order, each
// labelled "<name>: <class> → <promotion>" and disabled when the warband
// can't pay for it.
export function getPromotionOptions(
  run: RunState,
  classes: readonly UnitClass[] = UNIT_CLASSES,
): readonly PromotionOption[] {
  const label = (classId: string) => classes.find((unitClass) => unitClass.id === classId)?.label ?? classId;
  return Object.freeze(
    getPromotionCandidates(run).flatMap((unit) =>
      getPromotions(unit.classId).map((promotion) =>
        Object.freeze<PromotionOption>({
          id: `${unit.id}:${promotion.id}`,
          label: `${unit.name}: ${label(unit.classId)} → ${promotion.label}`,
          unitId: unit.id,
          promotionId: promotion.id,
          disabled: !canPromoteInRun(run, unit.id, promotion.id),
        }),
      ),
    ),
  );
}

// The screen opened on `run`, on its first option.
export function openPromotionScreen(run: RunState, classes?: readonly UnitClass[]): PromotionScreenState {
  return Object.freeze({ run, menu: createActionMenu(getPromotionOptions(run, classes)) });
}

// Moves the cursor `dy` options (wrapping).
export function movePromotionCursor(state: PromotionScreenState, dy: number): PromotionScreenState {
  const menu = moveSelection(state.menu, dy);
  return menu === state.menu ? state : Object.freeze({ ...state, menu });
}

// Points the cursor at option `index` (e.g. on mouse hover).
export function pointPromotionCursor(state: PromotionScreenState, index: number): PromotionScreenState {
  const menu = selectIndex(state.menu, index);
  return menu === state.menu ? state : Object.freeze({ ...state, menu });
}

// Confirm: promotes with the highlighted option when it's allowed, then
// lists what's left, keeping the cursor in range. A disabled option does
// nothing.
export function confirmPromotion(state: PromotionScreenState, classes?: readonly UnitClass[]): PromotionScreenState {
  const option = state.menu.actions[state.menu.selectedIndex];
  if (!option || option.disabled || !canPromoteInRun(state.run, option.unitId, option.promotionId)) return state;
  const run = promoteInRun(state.run, option.unitId, option.promotionId, classes);
  const actions = getPromotionOptions(run, classes);
  const selectedIndex = Math.max(0, Math.min(state.menu.selectedIndex, actions.length - 1));
  return Object.freeze({ run, menu: Object.freeze({ actions, selectedIndex }) });
}

// Whether nobody is left to promote, so the screen should close.
export function isPromotionScreenDone(state: PromotionScreenState): boolean {
  return state.menu.actions.length === 0;
}

// Cancel: closes the screen.
export function cancelPromotion(): null {
  return null;
}
