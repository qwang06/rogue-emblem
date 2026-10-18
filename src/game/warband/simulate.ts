// Many automated runs at once, summed up for balancing: how far runs get
// from each starting class, where they fall, and how often a battle
// stalls. `npm run sim` prints it (scripts/sim.ts). Pure apart from what
// autoRun does: the same starts and policy always give the same summary.

import { playRun, type AutoRunOptions, type AutoRunResult, type RunPolicy, type RunStart } from './autoRun.ts';
import { STARTING_CLASSES } from './startingClasses.ts';

export interface SimSummary {
  runs: number;
  // Stages won per run, as a list (index = run).
  cleared: readonly number[];
  // Runs that were still going at the stage limit.
  survived: number;
  // How many runs fell on each stage, by stage number.
  fallenAt: Readonly<Record<number, number>>;
  // Battles that ran past the turn limit undecided.
  stalls: number;
  // Units lost across every run.
  losses: number;
}

// `count` starts per starting class, seeded 1..count, named "Lead".
export function getSimStarts(count: number, classIds: readonly string[] = STARTING_CLASSES.map(({ id }) => id)) {
  return classIds.flatMap((classId) =>
    Array.from({ length: count }, (_, index): RunStart => ({ seed: index + 1, classId, name: 'Lead' })),
  );
}

// Plays every start with `policy` and sums the runs up, per class.
export function simulate(
  starts: readonly RunStart[],
  policy: RunPolicy,
  options: AutoRunOptions = {},
): { byClass: Record<string, SimSummary>; worst: AutoRunResult | null } {
  const byClass: Record<string, SimSummary> = {};
  let worst: AutoRunResult | null = null;
  for (const start of starts) {
    const result = playRun(start, policy, options);
    byClass[start.classId] = addRun(byClass[start.classId] ?? emptySummary(), result);
    if (!worst || clearedOf(result) < clearedOf(worst)) worst = result;
  }
  return { byClass, worst };
}

// A plain-text table of `byClass`: runs, average and median stages won,
// how many lasted to the limit, stalls, losses and the stages runs fell on.
export function formatSummary(byClass: Record<string, SimSummary>): string {
  const rows = Object.entries(byClass).map(([classId, s]) => {
    const sorted = [...s.cleared].sort((a, b) => a - b);
    const average = s.cleared.reduce((sum, n) => sum + n, 0) / Math.max(1, s.runs);
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
    const fell = Object.entries(s.fallenAt)
      .map(([stage, count]) => `${stage}×${count}`)
      .join(' ');
    return [classId, s.runs, average.toFixed(1), median, s.survived, s.stalls, s.losses, fell || '-'];
  });
  const header = ['class', 'runs', 'avg won', 'median', 'survived', 'stalls', 'losses', 'fell on stage×runs'];
  const table = [header, ...rows].map((row) => row.map(String));
  const widths = header.map((_, column) => Math.max(...table.map((row) => row[column].length)));
  return table
    .map((row) =>
      row
        .map((cell, column) => cell.padEnd(widths[column]))
        .join('  ')
        .trimEnd(),
    )
    .join('\n');
}

function emptySummary(): SimSummary {
  return { runs: 0, cleared: [], survived: 0, fallenAt: {}, stalls: 0, losses: 0 };
}

function clearedOf(result: AutoRunResult): number {
  return result.stages.filter((record) => record.outcome === 'victory').length;
}

function addRun(summary: SimSummary, result: AutoRunResult): SimSummary {
  const last = result.stages.at(-1);
  const fallenAt = { ...summary.fallenAt };
  if (result.end === 'fallen' && last) fallenAt[last.stage] = (fallenAt[last.stage] ?? 0) + 1;
  return {
    runs: summary.runs + 1,
    cleared: [...summary.cleared, clearedOf(result)],
    survived: summary.survived + (result.end === 'max-stages' ? 1 : 0),
    fallenAt,
    stalls: summary.stalls + result.stages.filter((record) => record.outcome === null).length,
    losses: summary.losses + result.stages.reduce((sum, record) => sum + record.losses, 0),
  };
}
