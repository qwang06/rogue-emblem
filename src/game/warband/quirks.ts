// Recruit quirks, Darkest Dungeon style: every recruit (a drafted one or a
// guest who joins) comes with one quirk, rolled when it's rolled. A quirk
// is either a passive modifier (modifiers.ts) the unit carries into every
// battle, like a boon it was born with, or a flat bonus to its max HP baked
// into its stats as it joins. The unit keeps its quirk by id (`Unit.quirk`,
// saved on its snapshot); restoreUnit in run.ts gives it the modifiers.
// Pure.

import type { Rng } from '../combatStats.ts';
import type { Modifier } from '../modifiers.ts';
import { randomItem } from '../rng.ts';

export interface Quirk {
  id: string;
  name: string;
  description: string;
  // What the unit carries into battle.
  modifiers: readonly Modifier[];
  // Max HP added to the unit's stats when it joins (and its HP with it).
  maxHealth: number;
}

function quirk(id: string, name: string, description: string, modifiers: readonly Modifier[], maxHealth = 0): Quirk {
  return Object.freeze({
    id,
    name,
    description,
    modifiers: Object.freeze(modifiers.map((modifier) => Object.freeze(modifier))),
    maxHealth,
  });
}

// How much max HP the Sturdy quirk adds.
export const STURDY_HEALTH = 3;

export const QUIRKS: readonly Quirk[] = Object.freeze([
  quirk('brave', 'Brave', '+2 damage when it attacks.', [
    { kind: 'combat', term: 'damage', amount: 2, when: 'attacking' },
  ]),
  quirk('lucky', 'Lucky', '+10 avoid.', [{ kind: 'combat', term: 'avoid', amount: 10 }]),
  quirk('sturdy', 'Sturdy', `+${STURDY_HEALTH} max HP.`, [], STURDY_HEALTH),
  quirk('keen', 'Keen', '+10 hit.', [{ kind: 'combat', term: 'hit', amount: 10 }]),
  quirk('ruthless', 'Ruthless', '+5 crit.', [{ kind: 'combat', term: 'crit', amount: 5 }]),
  quirk('stoic', 'Stoic', 'Takes 1 less damage when attacked.', [
    { kind: 'combat', term: 'guard', amount: 1, when: 'defending' },
  ]),
  quirk('eager', 'Eager', 'Earns 25% more XP.', [{ kind: 'experience', percent: 25 }]),
]);

// The quirk with `id`, or null.
export function findQuirk(id: string): Quirk | null {
  return QUIRKS.find((entry) => entry.id === id) ?? null;
}

// The modifiers the quirk `id` gives: none for no quirk or an unknown id.
export function getQuirkModifiers(id: string | null | undefined): readonly Modifier[] {
  return (id && findQuirk(id)?.modifiers) || [];
}

// A random quirk, other than the ones in `exclude` while any are left.
export function rollQuirk(rng: Rng, exclude: readonly string[] = []): Quirk {
  const left = QUIRKS.filter((entry) => !exclude.includes(entry.id));
  return randomItem(rng, left.length > 0 ? left : QUIRKS);
}
