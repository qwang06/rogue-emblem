// Warband Mode's origins: the warband a new run starts as, like Into the
// Breach's squads. An origin is the units it starts with, the gold in its
// purse and how many starting relics it picks. The starting class (the
// villager) is an origin of one unit (with the class's id, so older runs
// and scripts naming it still start the same), and renown unlocks the
// rest (see meta.ts's UNLOCKS): bands that bring more units or a twist,
// none of them stronger at the start than a Villager or two.
// Pure: createOriginRun builds a new run from one.

import { createUnitOfClass } from '../unitClasses.ts';
import type { Unit } from '../Unit.ts';
import { createSeededRng } from '../rng.ts';
import { generateName } from './names.ts';
import { HEALTH_POTION, MANA_POTION } from '../items.ts';
import { WHELP_GROWN_LEVEL } from '../Whelp.ts';
import { createRun, type ItemSnapshot, type RunState } from './run.ts';
import { STARTING_CLASSES, type StartingClass } from './startingClasses.ts';

export interface Origin {
  id: string;
  label: string;
  description: string;
  // The classes of the units it starts with, by UNIT_CLASSES id. The first
  // is the leader, whom the player names; the rest get generated names.
  units: readonly string[];
  gold: number;
  // How many starting relics the run picks, each one of three (none for
  // an origin that starts without).
  relicPicks: number;
  // The items it starts with in the convoy.
  convoy: readonly ItemSnapshot[];
}

function origin(fields: Omit<Origin, 'gold' | 'relicPicks' | 'convoy'> & Partial<Origin>): Origin {
  return Object.freeze({
    gold: 0,
    relicPicks: 1,
    ...fields,
    units: Object.freeze([...fields.units]),
    convoy: Object.freeze((fields.convoy ?? []).map((entry) => Object.freeze({ ...entry }))),
  });
}

function classOrigin({ id, label, description }: StartingClass): Origin {
  return origin({ id, label, description, units: [id] });
}

// The origins every player can start as: one per base starting class.
export const BASE_ORIGINS: readonly Origin[] = Object.freeze(STARTING_CLASSES.map(classOrigin));

export const MILITIA = origin({
  id: 'militia',
  label: 'Militia',
  description: 'Two Villagers from the same village, with 20 gold in the purse.',
  units: ['villager', 'villager'],
  gold: 20,
});
export const BEAST_TAMER = origin({
  id: 'beast-tamer',
  label: 'Beast Tamer',
  description: `A Villager and the Whelp it raised, which grows into a winged Beast at level ${WHELP_GROWN_LEVEL}. Not a coin between them.`,
  units: ['villager', 'whelp'],
});
export const PEDDLERS = origin({
  id: 'peddlers',
  label: 'Peddlers',
  description: 'One Villager with 60 gold and a pack of potions, to buy its strength at the first merchant.',
  units: ['villager'],
  gold: 60,
  convoy: [
    { itemId: HEALTH_POTION.id, quantity: 1 },
    { itemId: HEALTH_POTION.id, quantity: 1 },
    { itemId: MANA_POTION.id, quantity: 1 },
  ],
});
export const SURVIVORS = origin({
  id: 'survivors',
  label: 'Survivors',
  description: 'Three Villagers who escaped a burning village, with no gold and no starting relic.',
  units: ['villager', 'villager', 'villager'],
  relicPicks: 0,
});

// The origins renown unlocks, in the order they unlock (see meta.ts).
export const UNLOCKABLE_ORIGINS: readonly Origin[] = Object.freeze([MILITIA, BEAST_TAMER, PEDDLERS, SURVIVORS]);

// Every origin: the base ones, then the unlockable ones.
export const ORIGINS: readonly Origin[] = Object.freeze([...BASE_ORIGINS, ...UNLOCKABLE_ORIGINS]);

// The origin with `id`, or null.
export function findOrigin(id: string | undefined): Origin | null {
  return ORIGINS.find((candidate) => candidate.id === id) ?? null;
}

// How many starting relics `run` picks: its origin's count, else one (a
// run from before origins, or from one since retired).
export function getRelicPicks(run: Pick<RunState, 'origin'>): number {
  return findOrigin(run.origin)?.relicPicks ?? 1;
}

// The warband `origin` starts with: a level-1 unit of each of its classes,
// by unitId `<classId>-<n>` (n counting that class's units from 1), the
// first named `name` and the rest given names drawn from `seed`, none
// repeating.
export function createOriginWarband(origin: Origin, name: string, seed: number): Map<string, Unit> {
  const rng = createSeededRng((seed ^ 0x6f726967) >>> 0);
  const names = [name];
  const warband = new Map<string, Unit>();
  origin.units.forEach((classId, index) => {
    const unitName = index === 0 ? name : pickName(rng, names);
    names.push(unitName);
    const count = origin.units.slice(0, index + 1).filter((id) => id === classId).length;
    warband.set(`${classId}-${count}`, createUnitOfClass(classId, { name: unitName, team: 'player' }));
  });
  return warband;
}

function pickName(rng: () => number, taken: readonly string[]): string {
  for (;;) {
    const candidate = generateName(rng, taken.at(-1));
    if (!taken.includes(candidate)) return candidate;
  }
}

// A new run with `seed` started as origin `originId`, its leader named
// `name`, at Heat `heat`: its warband, its gold and convoy, and the origin
// and Heat kept on the run. Throws on an unknown origin.
export function createOriginRun(seed: number, originId: string, name: string, heat = 0): RunState {
  const origin = findOrigin(originId);
  if (!origin) throw new Error(`Unknown origin: ${originId}`);
  const run = createRun(seed, createOriginWarband(origin, name, seed));
  return Object.freeze({
    ...run,
    gold: origin.gold,
    convoy: Object.freeze(origin.convoy.map((entry) => Object.freeze({ ...entry }))),
    origin: origin.id,
    ...(heat > 0 && { heat }),
  });
}
