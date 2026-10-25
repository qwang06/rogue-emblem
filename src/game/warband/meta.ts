// Warband Mode's meta-progression: renown earned across runs, and what it
// unlocks. Every run that ends earns renown for the stages it cleared, the
// bosses it beat and a victory (more at a higher Heat); reaching an
// unlock's renown opens it for every run after. Unlocks are horizontal
// (more origins to start as, see origins.ts), never stat boosts, so each
// run stays the challenge. Heat levels (heat.ts) open by winning rather
// than by renown: the first win opens Heat 1, and a win at the highest
// Heat open opens the next. Pure: the browser save lives in
// src/data/metaSave.ts.

import { MAX_HEAT } from './heat.ts';
import { UNLOCKABLE_ORIGINS } from './origins.ts';
import type { RunSummary } from './runSummary.ts';

export interface MetaState {
  // Renown earned over every run.
  renown: number;
  // Runs ended, and how many of them were won.
  runs: number;
  wins: number;
  // The furthest stage a run has reached.
  bestStage: number;
  // The highest Heat level a new run may pick (0 until a run is won).
  heat: number;
}

export const NEW_META: MetaState = Object.freeze({ renown: 0, runs: 0, wins: 0, bestStage: 0, heat: 0 });

export const RENOWN_PER_STAGE = 10;
export const RENOWN_PER_BOSS = 20;
export const RENOWN_FOR_VICTORY = 50;
// The share of a run's renown each Heat level adds on top, in percent.
export const RENOWN_PERCENT_PER_HEAT = 25;

// Something renown opens: an origin a new run can start as.
export interface Unlock {
  id: string;
  label: string;
  // The total renown it opens at.
  renown: number;
  // The UNLOCKABLE_ORIGINS id it opens.
  origin: string;
}

// The renown each unlockable origin opens at, in order.
const ORIGIN_RENOWN: Readonly<Record<string, number>> = Object.freeze({
  vanguard: 40,
  sellswords: 80,
  guard: 120,
  pilgrims: 200,
  'lone-wolf': 300,
});

export const UNLOCKS: readonly Unlock[] = Object.freeze(
  UNLOCKABLE_ORIGINS.map(({ id, label }) =>
    Object.freeze({ id: `start-${id}`, label: `${label} start`, renown: ORIGIN_RENOWN[id], origin: id }),
  ),
);

// One line of a run's renown: what earned it, how many, and the renown.
export interface RenownLine {
  label: string;
  count: number;
  renown: number;
}

// The renown a run earns, line by line (lines that earn nothing left out),
// and in all: its stages, bosses and victory, then at Heat
// RENOWN_PERCENT_PER_HEAT% of those for each level, rounded down.
export function getRunRenown(
  summary: Pick<RunSummary, 'stagesCleared' | 'bossesDefeated' | 'won'> & Partial<Pick<RunSummary, 'heat'>>,
): {
  lines: readonly RenownLine[];
  total: number;
} {
  const base = [
    { label: 'Stages cleared', count: summary.stagesCleared, renown: summary.stagesCleared * RENOWN_PER_STAGE },
    { label: 'Bosses beaten', count: summary.bossesDefeated, renown: summary.bossesDefeated * RENOWN_PER_BOSS },
    { label: 'Victory', count: summary.won ? 1 : 0, renown: summary.won ? RENOWN_FOR_VICTORY : 0 },
  ];
  const heat = summary.heat ?? 0;
  const baseTotal = base.reduce((sum, line) => sum + line.renown, 0);
  const heatBonus = Math.floor((baseTotal * RENOWN_PERCENT_PER_HEAT * heat) / 100);
  const lines = [...base, { label: `Heat ${heat}`, count: 1, renown: heatBonus }].filter((line) => line.renown > 0);
  return Object.freeze({
    lines: Object.freeze(lines.map((line) => Object.freeze(line))),
    total: lines.reduce((sum, line) => sum + line.renown, 0),
  });
}

// Whether `meta`'s renown has opened `unlock`.
export function isUnlocked(meta: MetaState, unlock: Unlock): boolean {
  return meta.renown >= unlock.renown;
}

// The unlockable origins `meta` has opened, by origin id.
export function getUnlockedOrigins(meta: MetaState, unlocks: readonly Unlock[] = UNLOCKS): readonly string[] {
  return Object.freeze(unlocks.filter((unlock) => isUnlocked(meta, unlock)).map((unlock) => unlock.origin));
}

// The cheapest unlock `meta` hasn't opened yet, or null when all are open.
export function getNextUnlock(meta: MetaState, unlocks: readonly Unlock[] = UNLOCKS): Unlock | null {
  return [...unlocks].sort((a, b) => a.renown - b.renown).find((unlock) => !isUnlocked(meta, unlock)) ?? null;
}

// The highest Heat open after a run at Heat `runHeat` ends: one above it
// when it was won at the highest open (or higher), up to MAX_HEAT.
export function getHeatAfterRun(meta: Pick<MetaState, 'heat'>, runHeat: number, won: boolean): number {
  return won && runHeat >= meta.heat ? Math.min(MAX_HEAT, runHeat + 1) : meta.heat;
}

// `meta` after a run ends with `summary`: its renown added, the run
// counted, its stage kept if it's the furthest yet, and the next Heat
// opened by a win at the highest. `earned` is the run's renown line by
// line, `unlocked` what its renown newly opened and `heatUnlocked` the
// Heat level it newly opened, or null.
export function recordRun(
  meta: MetaState,
  summary: Pick<RunSummary, 'stagesCleared' | 'bossesDefeated' | 'won' | 'stage'> & Partial<Pick<RunSummary, 'heat'>>,
  unlocks: readonly Unlock[] = UNLOCKS,
): {
  meta: MetaState;
  earned: ReturnType<typeof getRunRenown>;
  unlocked: readonly Unlock[];
  heatUnlocked: number | null;
} {
  const earned = getRunRenown(summary);
  const after: MetaState = Object.freeze({
    renown: meta.renown + earned.total,
    runs: meta.runs + 1,
    wins: meta.wins + (summary.won ? 1 : 0),
    bestStage: Math.max(meta.bestStage, summary.stage),
    heat: getHeatAfterRun(meta, summary.heat ?? 0, summary.won),
  });
  const unlocked = unlocks.filter((unlock) => !isUnlocked(meta, unlock) && isUnlocked(after, unlock));
  const heatUnlocked = after.heat > meta.heat ? after.heat : null;
  return Object.freeze({ meta: after, earned, unlocked: Object.freeze(unlocked), heatUnlocked });
}

// The meta state as JSON, for saving.
export function serializeMeta(meta: MetaState): string {
  return JSON.stringify(meta);
}

// The meta state in `text` (from serializeMeta), or null if it isn't one.
// A save from before Heat levels opens Heat 1 if it has a win.
export function parseMeta(text: string): MetaState | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  const { renown, runs, wins, bestStage, heat: savedHeat } = data as Record<string, unknown>;
  if (![renown, runs, wins, bestStage].every(isWholeNumber)) return null;
  if ((wins as number) > (runs as number)) return null;
  const heat = savedHeat ?? ((wins as number) > 0 ? 1 : 0);
  if (!isWholeNumber(heat) || (heat as number) > MAX_HEAT) return null;
  return Object.freeze({ renown, runs, wins, bestStage, heat } as MetaState);
}

function isWholeNumber(value: unknown): boolean {
  return Number.isInteger(value) && (value as number) >= 0;
}
