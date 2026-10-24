// Warband Mode's relics: run-long trinkets that bend a rule for the whole
// warband, like Slay the Spire's. A run starts with a pick of one of
// three (rollStartingRelics) and wins more from reward cards (rewards.ts).
// Most relics are plain modifiers (modifiers.ts) every unit of the
// warband carries into battle (getRelicModifiers); a few change a run
// rule instead, and the rule that reads them checks for them by id:
// Bounty Ledger (rewards.ts, the clear's gold), Phoenix Feather (run.ts,
// after a battle), Four-Leaf Clover (rewards.ts, the offer count) and
// Field Kitchen (camp.ts, the rest's cost). Pure data and lookups.

import type { Modifier } from '../modifiers.ts';
import type { Rng } from '../combatStats.ts';
import { createSeededRng, shuffle } from '../rng.ts';

export interface Relic {
  id: string;
  name: string;
  description: string;
  // What every unit of the warband carries into battle; empty for a
  // relic that changes a run rule instead.
  modifiers: readonly Modifier[];
}

function relic(id: string, name: string, description: string, modifiers: readonly Modifier[] = []): Relic {
  return Object.freeze({ id, name, description, modifiers: Object.freeze(modifiers.map((m) => Object.freeze(m))) });
}

// Gold Bounty Ledger pays for each enemy the warband defeats.
export const BOUNTY_GOLD_PER_KILL = 4;
// How many rewards a pick offers with the Four-Leaf Clover.
export const CLOVER_REWARD_CHOICES = 4;

export const BOUNTY_LEDGER = relic(
  'bounty-ledger',
  'Bounty Ledger',
  `Each enemy defeated pays ${BOUNTY_GOLD_PER_KILL} more gold when the stage is cleared.`,
);
export const PHOENIX_FEATHER = relic(
  'phoenix-feather',
  'Phoenix Feather',
  'The first ally to fall rises again at 1 HP after the battle. Then the feather burns away.',
);
export const FOUR_LEAF_CLOVER = relic(
  'four-leaf-clover',
  'Four-Leaf Clover',
  `Reward picks offer ${CLOVER_REWARD_CHOICES} choices instead of 3.`,
);
export const FIELD_KITCHEN = relic('field-kitchen', 'Field Kitchen', 'Resting at camp costs no gold.');

// Every relic, in the order the relic book lists them.
export const RELICS: readonly Relic[] = Object.freeze([
  relic('hawk-lens', "Hawk's Lens", 'Every unit has +15 hit.', [{ kind: 'combat', term: 'hit', amount: 15 }]),
  relic('gamblers-coin', "Gambler's Coin", 'Every unit has +15 crit but −10 hit.', [
    { kind: 'combat', term: 'crit', amount: 15 },
    { kind: 'combat', term: 'hit', amount: -10 },
  ]),
  relic('feather-cloak', 'Feather Cloak', 'Every unit has +15 avoid.', [{ kind: 'combat', term: 'avoid', amount: 15 }]),
  relic('duelists-gauntlet', "Duelist's Gauntlet", 'Units deal +2 damage when they attack.', [
    { kind: 'combat', term: 'damage', amount: 2, when: 'attacking' },
  ]),
  relic('bulwark-crest', 'Bulwark Crest', 'Units take 2 less damage when attacked.', [
    { kind: 'combat', term: 'guard', amount: 2, when: 'defending' },
  ]),
  relic('berserkers-brand', "Berserker's Brand", 'Units under half HP deal +3 damage.', [
    { kind: 'combat', term: 'damage', amount: 3, when: 'wounded' },
  ]),
  relic('hunters-charm', "Hunter's Charm", 'Units deal +2 damage to monsters.', [
    { kind: 'combat', term: 'damage', amount: 2, when: 'vs-monster' },
  ]),
  relic('winged-boots', 'Winged Boots', 'Every unit has +1 MOV.', [{ kind: 'movement', amount: 1 }]),
  relic('bloodpact', 'Bloodpact', 'A unit that defeats a foe heals 4 HP.', [{ kind: 'kill-heal', amount: 4 }]),
  relic('mending-charm', 'Mending Charm', 'Units recover 2 HP at the start of each of your phases.', [
    { kind: 'phase-heal', amount: 2 },
  ]),
  relic('mana-spring', 'Mana Spring', 'Units recover 1 MP at the start of each of your phases.', [
    { kind: 'phase-mana', amount: 1 },
  ]),
  relic('whetstone', 'Whetstone', 'A killing blow doesn’t wear the weapon.', [{ kind: 'spare-weapon-on-kill' }]),
  relic('scholars-quill', "Scholar's Quill", 'Every unit earns 50% more XP.', [{ kind: 'experience', percent: 50 }]),
  BOUNTY_LEDGER,
  PHOENIX_FEATHER,
  FOUR_LEAF_CLOVER,
  FIELD_KITCHEN,
]);

// How many relics a run starts by choosing from.
export const STARTING_RELIC_CHOICES = 3;

// The relic with `id`, or null.
export function findRelic(id: string): Relic | null {
  return RELICS.find((candidate) => candidate.id === id) ?? null;
}

// Whether the run holds the relic `relic`.
export function hasRelic(run: { relics: readonly string[] }, relic: Pick<Relic, 'id'>): boolean {
  return run.relics.includes(relic.id);
}

// Every modifier the relics `relicIds` give each unit, in order. Unknown
// ids give none.
export function getRelicModifiers(relicIds: readonly string[]): Modifier[] {
  return relicIds.flatMap((id) => findRelic(id)?.modifiers ?? []);
}

// The relics a run doesn't hold yet, in RELICS order.
export function getUnownedRelics(relicIds: readonly string[]): Relic[] {
  return RELICS.filter((candidate) => !relicIds.includes(candidate.id));
}

// Up to `count` different relics the run doesn't hold, in a random order
// from `rng`.
export function rollRelics(rng: Rng, relicIds: readonly string[], count: number): Relic[] {
  return shuffle(rng, getUnownedRelics(relicIds)).slice(0, Math.max(0, count));
}

// The relics a run started with `runSeed` offers to start with: always
// the same for the same seed.
export function rollStartingRelics(runSeed: number): Relic[] {
  return rollRelics(createSeededRng((runSeed ^ 0x7f4a7c15) >>> 0), [], STARTING_RELIC_CHOICES);
}
