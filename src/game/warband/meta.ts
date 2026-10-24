// Warband Mode's meta-progression: renown earned across runs, and what it
// unlocks. Every run that ends earns renown for the stages it cleared, the
// bosses it beat and a victory; reaching an unlock's renown opens it for
// every run after. Unlocks are horizontal (more starting choices), never
// stat boosts, so each run stays the challenge. Pure: the browser save
// lives in src/data/metaSave.ts.

import type { RunSummary } from './runSummary.ts';
import { UNLOCKABLE_STARTING_CLASSES } from './startingClasses.ts';

export interface MetaState {
  // Renown earned over every run.
  renown: number;
  // Runs ended, and how many of them were won.
  runs: number;
  wins: number;
  // The furthest stage a run has reached.
  bestStage: number;
}

export const NEW_META: MetaState = Object.freeze({ renown: 0, runs: 0, wins: 0, bestStage: 0 });

export const RENOWN_PER_STAGE = 10;
export const RENOWN_PER_BOSS = 20;
export const RENOWN_FOR_VICTORY = 50;

// Something renown opens: for now, a class a new run can start as.
export interface Unlock {
  id: string;
  label: string;
  // The total renown it opens at.
  renown: number;
  // The UNLOCKABLE_STARTING_CLASSES id it opens.
  startingClass: string;
}

// The renown each unlockable starting class opens at, in order.
const STARTING_CLASS_RENOWN: Readonly<Record<string, number>> = Object.freeze({
  vanguard: 40,
  guard: 120,
});

export const UNLOCKS: readonly Unlock[] = Object.freeze(
  UNLOCKABLE_STARTING_CLASSES.map(({ id, label }) =>
    Object.freeze({ id: `start-${id}`, label: `${label} start`, renown: STARTING_CLASS_RENOWN[id], startingClass: id }),
  ),
);

// One line of a run's renown: what earned it, how many, and the renown.
export interface RenownLine {
  label: string;
  count: number;
  renown: number;
}

// The renown a run earns, line by line (lines that earn nothing left out),
// and in all.
export function getRunRenown(summary: Pick<RunSummary, 'stagesCleared' | 'bossesDefeated' | 'won'>): {
  lines: readonly RenownLine[];
  total: number;
} {
  const lines = [
    { label: 'Stages cleared', count: summary.stagesCleared, renown: summary.stagesCleared * RENOWN_PER_STAGE },
    { label: 'Bosses beaten', count: summary.bossesDefeated, renown: summary.bossesDefeated * RENOWN_PER_BOSS },
    { label: 'Victory', count: summary.won ? 1 : 0, renown: summary.won ? RENOWN_FOR_VICTORY : 0 },
  ].filter((line) => line.renown > 0);
  return Object.freeze({
    lines: Object.freeze(lines.map((line) => Object.freeze(line))),
    total: lines.reduce((sum, line) => sum + line.renown, 0),
  });
}

// Whether `meta`'s renown has opened `unlock`.
export function isUnlocked(meta: MetaState, unlock: Unlock): boolean {
  return meta.renown >= unlock.renown;
}

// The unlockable starting classes `meta` has opened, by class id.
export function getUnlockedStartingClasses(meta: MetaState, unlocks: readonly Unlock[] = UNLOCKS): readonly string[] {
  return Object.freeze(unlocks.filter((unlock) => isUnlocked(meta, unlock)).map((unlock) => unlock.startingClass));
}

// The cheapest unlock `meta` hasn't opened yet, or null when all are open.
export function getNextUnlock(meta: MetaState, unlocks: readonly Unlock[] = UNLOCKS): Unlock | null {
  return [...unlocks].sort((a, b) => a.renown - b.renown).find((unlock) => !isUnlocked(meta, unlock)) ?? null;
}

// `meta` after a run ends with `summary`: its renown added, the run
// counted, and its stage kept if it's the furthest yet. `earned` is the
// run's renown line by line and `unlocked` what it newly opened.
export function recordRun(
  meta: MetaState,
  summary: Pick<RunSummary, 'stagesCleared' | 'bossesDefeated' | 'won' | 'stage'>,
  unlocks: readonly Unlock[] = UNLOCKS,
): { meta: MetaState; earned: ReturnType<typeof getRunRenown>; unlocked: readonly Unlock[] } {
  const earned = getRunRenown(summary);
  const after: MetaState = Object.freeze({
    renown: meta.renown + earned.total,
    runs: meta.runs + 1,
    wins: meta.wins + (summary.won ? 1 : 0),
    bestStage: Math.max(meta.bestStage, summary.stage),
  });
  const unlocked = unlocks.filter((unlock) => !isUnlocked(meta, unlock) && isUnlocked(after, unlock));
  return Object.freeze({ meta: after, earned, unlocked: Object.freeze(unlocked) });
}

// The meta state as JSON, for saving.
export function serializeMeta(meta: MetaState): string {
  return JSON.stringify(meta);
}

// The meta state in `text` (from serializeMeta), or null if it isn't one.
export function parseMeta(text: string): MetaState | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  const { renown, runs, wins, bestStage } = data as Record<string, unknown>;
  if (![renown, runs, wins, bestStage].every(isWholeNumber)) return null;
  if ((wins as number) > (runs as number)) return null;
  return Object.freeze({ renown, runs, wins, bestStage } as MetaState);
}

function isWholeNumber(value: unknown): boolean {
  return Number.isInteger(value) && (value as number) >= 0;
}
