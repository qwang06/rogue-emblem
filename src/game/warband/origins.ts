// Warband Mode's origins: the warband a new run starts as, like Into the
// Breach's squads. An origin is the units it starts with, the gold in its
// purse and how many starting relics it picks. Each base starting class is
// an origin of one unit (with the class's id, so older runs and scripts
// naming a class still start the same), and renown unlocks the rest (see
// meta.ts's UNLOCKS): two more lone classes and three bands with a twist.
// Pure: createOriginRun builds a new run from one.

import { createUnitOfClass } from '../unitClasses.ts';
import type { Unit } from '../Unit.ts';
import { createSeededRng } from '../rng.ts';
import { generateName } from './names.ts';
import { createRun, type RunState } from './run.ts';
import { STARTING_CLASSES, UNLOCKABLE_STARTING_CLASSES, type StartingClass } from './startingClasses.ts';

export interface Origin {
  id: string;
  label: string;
  description: string;
  // The classes of the units it starts with, by UNIT_CLASSES id. The first
  // is the leader, whom the player names; the rest get generated names.
  units: readonly string[];
  gold: number;
  // How many starting relics the run picks, each one of three.
  relicPicks: number;
}

function origin(fields: Omit<Origin, 'gold' | 'relicPicks'> & Partial<Origin>): Origin {
  return Object.freeze({ gold: 0, relicPicks: 1, ...fields, units: Object.freeze([...fields.units]) });
}

function classOrigin({ id, label, description }: StartingClass): Origin {
  return origin({ id, label, description, units: [id] });
}

// The origins every player can start as: one per base starting class.
export const BASE_ORIGINS: readonly Origin[] = Object.freeze(STARTING_CLASSES.map(classOrigin));

export const SELLSWORDS = origin({
  id: 'sellswords',
  label: 'Sellswords',
  description: 'A Soldier and an Archer for hire, with 30 gold in the purse.',
  units: ['soldier', 'archer'],
  gold: 30,
});
export const PILGRIMS = origin({
  id: 'pilgrims',
  label: 'Pilgrims',
  description: 'A Guard escorting an Acolyte who heals, but not a coin between them.',
  units: ['guard', 'acolyte'],
});
export const LONE_WOLF = origin({
  id: 'lone-wolf',
  label: 'Lone Wolf',
  description: 'One Warrior alone, who picks two starting relics.',
  units: ['warrior'],
  relicPicks: 2,
});

// The origins renown unlocks, in the order they unlock (see meta.ts).
export const UNLOCKABLE_ORIGINS: readonly Origin[] = Object.freeze([
  classOrigin(UNLOCKABLE_STARTING_CLASSES[0]),
  SELLSWORDS,
  classOrigin(UNLOCKABLE_STARTING_CLASSES[1]),
  PILGRIMS,
  LONE_WOLF,
]);

// Every origin: the base ones, then the unlockable ones.
export const ORIGINS: readonly Origin[] = Object.freeze([...BASE_ORIGINS, ...UNLOCKABLE_ORIGINS]);

// The origin with `id`, or null.
export function findOrigin(id: string | undefined): Origin | null {
  return ORIGINS.find((candidate) => candidate.id === id) ?? null;
}

// How many starting relics `run` picks: its origin's count, else one.
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
// `name`, at Heat `heat`: its warband, its gold, and the origin and Heat
// kept on the run. Throws on an unknown origin.
export function createOriginRun(seed: number, originId: string, name: string, heat = 0): RunState {
  const origin = findOrigin(originId);
  if (!origin) throw new Error(`Unknown origin: ${originId}`);
  const run = createRun(seed, createOriginWarband(origin, name, seed));
  return Object.freeze({ ...run, gold: origin.gold, origin: origin.id, ...(heat > 0 && { heat }) });
}
