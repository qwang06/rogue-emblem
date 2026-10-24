// The camp between Warband Mode stages, once the reward is taken: its menu
// (Manage Roster, Merchant, Rest, Next Stage or Travel) and the rest. Manage
// Roster opens the roster screen (rosterScreen.ts) and Merchant the
// merchant screen (merchantScreen.ts). Everything here is pure: each
// function returns a new frozen value and leaves its input alone.

import type { MenuAction } from '../actionMenu.ts';
import { FIELD_KITCHEN, hasRelic } from './relics.ts';
import type { RunState } from './run.ts';
import { isInTown, isRealmRun } from './travel.ts';

// What a rest at camp costs: every unit back to full HP and mana.
export const REST_COST = 15;

// What a rest costs the run: REST_COST, or nothing in a town (see
// travel.ts) or with the Field Kitchen.
export function getRestCost(run: Pick<RunState, 'relics' | 'route'>): number {
  return isInTown(run) || hasRelic(run, FIELD_KITCHEN) ? 0 : REST_COST;
}

export type CampActionId = 'roster' | 'merchant' | 'rest' | 'march';

export interface CampAction extends MenuAction {
  id: CampActionId;
}

// The camp menu for `run`. Rest names its cost and is disabled when the
// warband can't afford it or nobody needs it. A run on the realm (see
// travel.ts) only finds the merchant in a town, rests free there, and
// travels on rather than marching to the next stage.
export function getCampActions(run: RunState): readonly CampAction[] {
  const cost = getRestCost(run);
  return Object.freeze(
    [
      { id: 'roster', label: 'Manage Roster' },
      ...(hasMerchant(run) ? [{ id: 'merchant', label: 'Merchant' }] : []),
      { id: 'rest', label: cost > 0 ? `Rest (${cost} gold)` : 'Rest (free)', disabled: !canRest(run) },
      { id: 'march', label: isRealmRun(run) ? 'Travel' : 'Next Stage' },
    ].map((action) => Object.freeze(action as CampAction)),
  );
}

// Whether the merchant is at this camp: always on a linear run, only in a
// town on the realm.
export function hasMerchant(run: RunState): boolean {
  return !isRealmRun(run) || isInTown(run);
}

// Whether anyone on the roster is missing HP or mana.
export function needsRest(run: RunState): boolean {
  return run.roster.some((unit) => unit.health < unit.maxHealth || unit.mana < unit.maxMana);
}

// Whether the warband can rest: someone needs it and the run has the gold.
export function canRest(run: RunState): boolean {
  return needsRest(run) && run.gold >= getRestCost(run);
}

// The run after resting: getRestCost spent and every unit at full HP and
// mana. Throws when it can't rest (see canRest).
export function restAtCamp(run: RunState): RunState {
  if (!canRest(run)) throw new Error(needsRest(run) ? 'Not enough gold to rest' : 'Nobody needs rest');
  return Object.freeze({
    ...run,
    gold: run.gold - getRestCost(run),
    roster: Object.freeze(
      run.roster.map((unit) => Object.freeze({ ...unit, health: unit.maxHealth, mana: unit.maxMana })),
    ),
  });
}
