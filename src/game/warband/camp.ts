// The camp between Warband Mode stages, once the reward is taken: its menu
// (Manage Roster, Merchant, Rest, Next Stage) and the paid rest. Manage
// Roster opens the roster screen (rosterScreen.ts) and Merchant the
// merchant screen (merchantScreen.ts). Everything here is pure: each
// function returns a new frozen value and leaves its input alone.

import type { MenuAction } from '../actionMenu.ts';
import type { RunState } from './run.ts';

// What a rest at camp costs: every unit back to full HP and mana.
export const REST_COST = 15;

export type CampActionId = 'roster' | 'merchant' | 'rest' | 'march';

export interface CampAction extends MenuAction {
  id: CampActionId;
}

// The camp menu for `run`. Rest names its cost and is disabled when the
// warband can't afford it or nobody needs it.
export function getCampActions(run: RunState): readonly CampAction[] {
  return Object.freeze(
    [
      { id: 'roster', label: 'Manage Roster' },
      { id: 'merchant', label: 'Merchant' },
      { id: 'rest', label: `Rest (${REST_COST} gold)`, disabled: !canRest(run) },
      { id: 'march', label: 'Next Stage' },
    ].map((action) => Object.freeze(action as CampAction)),
  );
}

// Whether anyone on the roster is missing HP or mana.
export function needsRest(run: RunState): boolean {
  return run.roster.some((unit) => unit.health < unit.maxHealth || unit.mana < unit.maxMana);
}

// Whether the warband can rest: someone needs it and the run has the gold.
export function canRest(run: RunState): boolean {
  return needsRest(run) && run.gold >= REST_COST;
}

// The run after resting: REST_COST spent and every unit at full HP and
// mana. Throws when it can't rest (see canRest).
export function restAtCamp(run: RunState): RunState {
  if (!canRest(run)) throw new Error(needsRest(run) ? 'Not enough gold to rest' : 'Nobody needs rest');
  return Object.freeze({
    ...run,
    gold: run.gold - REST_COST,
    roster: Object.freeze(
      run.roster.map((unit) => Object.freeze({ ...unit, health: unit.maxHealth, mana: unit.maxMana })),
    ),
  });
}
