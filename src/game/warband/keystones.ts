// Keystones, Path of Exile style: a rule-breaking pact for the whole
// warband, offered as the reward for every KEYSTONE_INTERVAL stages
// cleared (rollStageRewards in rewards.ts), in place of the usual pick.
// The warband holds one at a time (`RunState.keystone`); taking another
// replaces it. A keystone gives every unit its modifiers (modifiers.ts),
// and pays for them by making the enemy side stronger: its curses
// (curses.ts) go to every unit, marked `shared` so they fall on the
// enemies once per battle however many units are deployed. Pure data and
// lookups.
import type { Rng } from '../combatStats.ts';
import type { Curse } from '../curses.ts';
import type { Modifier } from '../modifiers.ts';
import { shuffle } from '../rng.ts';

export interface Keystone {
  id: string;
  name: string;
  // The upside and the cost, for the reward card and the run screens.
  description: string;
  modifiers: readonly Modifier[];
  curses: readonly Curse[];
}

// A keystone is offered after every this many stages cleared.
export const KEYSTONE_INTERVAL = 10;
// How many keystones the offer shows.
export const KEYSTONE_CHOICES = 3;

function keystone(
  id: string,
  name: string,
  description: string,
  modifiers: readonly Modifier[],
  curses: readonly Curse[],
): Keystone {
  return Object.freeze({
    id,
    name,
    description,
    modifiers: Object.freeze(modifiers.map((modifier) => Object.freeze(modifier))),
    curses: Object.freeze(curses.map((curse) => Object.freeze({ ...curse, shared: `keystone-${id}` }))),
  });
}

export const KEYSTONES: readonly Keystone[] = Object.freeze([
  keystone(
    'frenzy-pact',
    'Frenzy Pact',
    'Every unit strikes twice in every exchange. Enemies are 15% stronger.',
    [{ kind: 'always-double' }],
    [{ kind: 'enemy-surge', percent: 15 }],
  ),
  keystone(
    'glass-lens',
    'Glass Lens',
    'Every unit has +20 crit and its crits deal ×5 damage. Enemies are Keen (+10 hit, +15 crit).',
    [
      { kind: 'combat', term: 'crit', amount: 20 },
      { kind: 'crit-multiplier', amount: 5 },
    ],
    [{ kind: 'enemy-affix', affixId: 'keen' }],
  ),
  keystone(
    'avatar-of-war',
    'Avatar of War',
    "A unit's first kill in its own attack each phase lets it act again. The strongest enemy besides the boss is an elite with 2 affixes.",
    [{ kind: 'encore' }],
    [{ kind: 'elite-enemy', affixes: 2 }],
  ),
  keystone(
    'vampire-court',
    'Vampire Court',
    'Every unit heals 35% of the damage it deals. Enemies are Regenerating (3 HP each phase).',
    [{ kind: 'lifesteal', percent: 35 }],
    [{ kind: 'enemy-affix', affixId: 'regenerating' }],
  ),
  keystone(
    'iron-legion',
    'Iron Legion',
    'A foe that strikes a unit from the next tile takes 4 damage, and 30% of every hit goes back to the striker. Enemies are Brutal (+2 damage when they attack).',
    [
      { kind: 'thorns', amount: 4 },
      { kind: 'reflect', percent: 30 },
    ],
    [{ kind: 'enemy-affix', affixId: 'brutal' }],
  ),
  keystone(
    'plague-host',
    'Plague Host',
    "Every unit's hits Mark the foe, it deals 25% more damage to a debuffed foe, and a foe it fells passes its debuffs on. Enemies are Swift (+1 MOV, +20 avoid).",
    [
      { kind: 'status-on-hit', status: 'marked' },
      { kind: 'combat', term: 'damage-percent', amount: 25, when: 'vs-debuffed' },
      { kind: 'contagion' },
    ],
    [{ kind: 'enemy-affix', affixId: 'swift' }],
  ),
]);

// The keystone with `id`, or null.
export function findKeystone(id: string | null | undefined): Keystone | null {
  return (id && KEYSTONES.find((entry) => entry.id === id)) || null;
}

// Whether clearing `stage` earns a keystone pick: every KEYSTONE_INTERVAL
// stages.
export function isKeystoneStage(stage: number): boolean {
  return stage > 0 && stage % KEYSTONE_INTERVAL === 0;
}

// Up to `count` keystones to offer, at random, never the one the warband
// already holds (`held`).
export function rollKeystones(rng: Rng, held: string | null | undefined, count = KEYSTONE_CHOICES): Keystone[] {
  return shuffle(
    rng,
    KEYSTONES.filter(({ id }) => id !== held),
  ).slice(0, count);
}
