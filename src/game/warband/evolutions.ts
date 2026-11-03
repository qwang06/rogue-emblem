// Evolutions, Vampire Survivors style: certain combinations of what a
// Warband unit has collected unlock something stronger on top of them. A
// recipe names the boons the unit must have taken (boons.ts), some to a
// rank (a passive taken that many times, the rank evolutions), the relics
// the warband must hold (relics.ts) and, for some, the classes it must be
// one of (a promoted class counts, see promotions.ts). A unit that meets
// every part of a recipe has its evolution: more modifiers (modifiers.ts)
// it carries into every battle, often a skill only an evolution teaches.
// Nothing is stored: a unit's evolutions are worked out from its boons,
// its class and the run's relics whenever it's restored for a battle (see
// restoreRoster in run.ts), so losing a relic loses what it fed. Recipes
// aren't shown in the game; a boon or promotion that would complete one is
// flagged as it's offered (completesEvolution), so players find them. Pure.

import type { Modifier } from '../modifiers.ts';
import { EARTHSHAKER, INFERNO, VOLLEY } from '../skills.ts';
import { getBoonIds, getBoonRank, MAX_BOON_RANK } from './boons.ts';

export interface Evolution {
  id: string;
  name: string;
  // What it gives, for the unit info screen.
  description: string;
  // Boon ids the unit must have taken, all of them.
  boons: readonly string[];
  // Boon ids the unit must have taken to at least a rank, by id.
  ranks: Readonly<Record<string, number>>;
  // Relic ids the warband must hold, all of them.
  relics: readonly string[];
  // Class ids the unit must be one of; empty for any class.
  classes: readonly string[];
  modifiers: readonly Modifier[];
}

function evolution(
  fields: Omit<Evolution, 'boons' | 'ranks' | 'relics' | 'classes'> & {
    boons?: readonly string[];
    ranks?: Readonly<Record<string, number>>;
    relics?: readonly string[];
    classes?: readonly string[];
  },
): Evolution {
  const { boons = [], ranks = {}, relics = [], classes = [], modifiers, ...rest } = fields;
  return Object.freeze({
    ...rest,
    boons: Object.freeze([...boons]),
    ranks: Object.freeze({ ...ranks }),
    relics: Object.freeze([...relics]),
    classes: Object.freeze([...classes]),
    modifiers: Object.freeze(modifiers.map((modifier) => Object.freeze(modifier))),
  });
}

const ARCHERS = ['archer', 'siege'];
// The rank a rank evolution's passive must reach: its top one.
export const RANK_EVOLUTION_RANK = MAX_BOON_RANK;
const CASTERS = ['acolyte', 'mage', 'bishop'];

// Every evolution, in the order the unit info screen lists them.
export const EVOLUTIONS: readonly Evolution[] = Object.freeze([
  evolution({
    id: 'volley',
    name: 'Volley',
    description: 'Learns Volley, a 3 MP arrow storm with +3 power from up to 3 tiles away.',
    boons: ['keen-eye', 'deadly'],
    classes: ARCHERS,
    modifiers: [{ kind: 'skill', skill: VOLLEY }],
  }),
  evolution({
    id: 'inferno',
    name: 'Inferno',
    description: 'Learns Inferno, a 4 MP blaze with +5 power from up to 3 tiles away.',
    boons: ['focus'],
    relics: ['mana-spring'],
    classes: CASTERS,
    modifiers: [{ kind: 'skill', skill: INFERNO }],
  }),
  evolution({
    id: 'earthshaker',
    name: 'Earthshaker',
    description: 'Learns Earthshaker, a 4 MP blow with +8 power against an adjacent foe.',
    boons: ['brawler'],
    classes: ['vanguard', 'beast-rider'],
    modifiers: [{ kind: 'skill', skill: EARTHSHAKER }],
  }),
  evolution({
    id: 'vampiric',
    name: 'Vampiric',
    description: 'Heals 4 more HP on a kill, and deals +2 damage.',
    boons: ['bloodthirst'],
    relics: ['bloodpact'],
    modifiers: [
      { kind: 'kill-heal', amount: 4 },
      { kind: 'combat', term: 'damage', amount: 2 },
    ],
  }),
  evolution({
    id: 'juggernaut',
    name: 'Juggernaut',
    description: 'Takes 2 less damage from every hit, its own counters included.',
    boons: ['stalwart'],
    relics: ['bulwark-crest'],
    modifiers: [{ kind: 'combat', term: 'guard', amount: 2 }],
  }),
  evolution({
    id: 'wind-dancer',
    name: 'Wind Dancer',
    description: '+1 MOV and +10 avoid.',
    boons: ['nimble', 'fleet'],
    modifiers: [
      { kind: 'movement', amount: 1 },
      { kind: 'combat', term: 'avoid', amount: 10 },
    ],
  }),
  evolution({
    id: 'executioner',
    name: 'Executioner',
    description: '+20 crit while under half HP.',
    boons: ['brawler', 'wrath'],
    modifiers: [{ kind: 'combat', term: 'crit', amount: 20, when: 'wounded' }],
  }),
  evolution({
    id: 'slayer',
    name: 'Slayer',
    description: '+15 crit and +2 damage against monsters.',
    boons: ['monster-hunter'],
    relics: ['hunters-charm'],
    modifiers: [
      { kind: 'combat', term: 'crit', amount: 15, when: 'vs-monster' },
      { kind: 'combat', term: 'damage', amount: 2, when: 'vs-monster' },
    ],
  }),
  evolution({
    id: 'prodigy',
    name: 'Prodigy',
    description: 'Earns 50% more XP again.',
    boons: ['quick-study'],
    relics: ['scholars-quill'],
    modifiers: [{ kind: 'experience', percent: 50 }],
  }),
  // Rank evolutions: a passive at its top rank and the relic that matches.
  evolution({
    id: 'berserk',
    name: 'Berserk',
    description: 'Strikes twice in every exchange, fast enough or not.',
    ranks: { brawler: RANK_EVOLUTION_RANK },
    relics: ['duelists-gauntlet'],
    modifiers: [{ kind: 'always-double' }],
  }),
  evolution({
    id: 'troll-blood',
    name: 'Troll Blood',
    description: 'Recovers 25% of its max HP at the start of each of your phases.',
    ranks: { regeneration: RANK_EVOLUTION_RANK },
    relics: ['mending-charm'],
    modifiers: [{ kind: 'phase-heal-percent', percent: 25 }],
  }),
  evolution({
    id: 'eagle-eye',
    name: 'Eagle Eye',
    description: 'Never misses, and its crits deal ×4 damage.',
    ranks: { 'keen-eye': RANK_EVOLUTION_RANK },
    relics: ['hawk-lens'],
    modifiers: [{ kind: 'sure-hit' }, { kind: 'crit-multiplier', amount: 4 }],
  }),
  evolution({
    id: 'vampire-lord',
    name: 'Vampire Lord',
    description: 'Heals half the damage it deals.',
    ranks: { bloodthirst: RANK_EVOLUTION_RANK },
    relics: ['bloodpact'],
    modifiers: [{ kind: 'lifesteal', percent: 50 }],
  }),
  evolution({
    id: 'blink',
    name: 'Blink',
    description: 'Moves over any terrain and through any unit, as if it vanished and reappeared.',
    // Fleet's top rank is 2.
    ranks: { fleet: 2 },
    relics: ['winged-boots'],
    modifiers: [{ kind: 'blink' }],
  }),
  evolution({
    id: 'evergreen',
    name: 'Evergreen',
    description: 'Recovers 2 more HP and 1 more MP at the start of each of your phases.',
    boons: ['regeneration', 'focus'],
    modifiers: [
      { kind: 'phase-heal', amount: 2 },
      { kind: 'phase-mana', amount: 1 },
    ],
  }),
]);

// What a recipe is checked against: a unit's class and boons, and the
// run's relics.
export interface EvolutionHolder {
  classId: string;
  boons?: readonly string[];
}

// The evolution with `id`, or null.
export function findEvolution(id: string): Evolution | null {
  return EVOLUTIONS.find((candidate) => candidate.id === id) ?? null;
}

// Whether `unit`, in a warband holding `relics`, meets every part of
// `evolution`'s recipe.
export function hasEvolution(unit: EvolutionHolder, relics: readonly string[], evolution: Evolution): boolean {
  const boons = getBoonIds(unit.boons ?? []);
  return (
    evolution.boons.every((id) => boons.includes(id)) &&
    Object.entries(evolution.ranks).every(([id, rank]) => getBoonRank(unit.boons ?? [], id) >= rank) &&
    evolution.relics.every((id) => relics.includes(id)) &&
    (evolution.classes.length === 0 || evolution.classes.includes(unit.classId))
  );
}

// The evolutions `unit` has in a warband holding `relics`, in EVOLUTIONS
// order.
export function getEvolutions(unit: EvolutionHolder, relics: readonly string[]): Evolution[] {
  return EVOLUTIONS.filter((candidate) => hasEvolution(unit, relics, candidate));
}

// The evolutions `after` has that `before` didn't (the same unit before
// and after a boon, a promotion or a new relic), in EVOLUTIONS order.
export function getNewEvolutions(
  before: EvolutionHolder,
  after: EvolutionHolder,
  relicsBefore: readonly string[],
  relicsAfter: readonly string[] = relicsBefore,
): Evolution[] {
  const had = new Set(getEvolutions(before, relicsBefore).map(({ id }) => id));
  return getEvolutions(after, relicsAfter).filter(({ id }) => !had.has(id));
}

// Whether `change` (more boons, a new class, or both) would complete an
// evolution `unit` doesn't have yet, in a warband holding `relics`: what
// the boon cards and the promotion screen flag.
export function completesEvolution(
  unit: EvolutionHolder,
  relics: readonly string[],
  change: { boon?: string; classId?: string },
): boolean {
  const after = {
    classId: change.classId ?? unit.classId,
    boons: change.boon ? [...(unit.boons ?? []), change.boon] : unit.boons,
  };
  return getNewEvolutions(unit, after, relics).length > 0;
}
