import { describe, expect, it } from 'vitest';
import { BASELINE_POLICY } from './autoRun.ts';
import { formatSummary, getSimStarts, simulate } from './simulate.ts';

describe('getSimStarts', () => {
  it('seeds each starting class the same way', () => {
    expect(getSimStarts(2, ['soldier', 'archer'])).toEqual([
      { seed: 1, classId: 'soldier', name: 'Lead' },
      { seed: 2, classId: 'soldier', name: 'Lead' },
      { seed: 1, classId: 'archer', name: 'Lead' },
      { seed: 2, classId: 'archer', name: 'Lead' },
    ]);
  });
});

describe('simulate', () => {
  const { byClass, worst } = simulate(getSimStarts(2, ['soldier']), BASELINE_POLICY, { maxStages: 2 });

  it('sums the runs up per class', () => {
    const summary = byClass.soldier;
    expect(summary.runs).toBe(2);
    expect(summary.cleared).toHaveLength(2);
    expect(summary.cleared.every((won) => won >= 1 && won <= 2)).toBe(true);
    const fell = Object.values(summary.fallenAt).reduce((sum, count) => sum + count, 0);
    expect(fell + summary.survived).toBe(2);
    expect(summary.won).toBeLessThanOrEqual(summary.survived);
  });

  it('keeps the run that won the fewest stages', () => {
    expect(worst?.script.start.classId).toBe('soldier');
  });

  it('prints a row per class under a header', () => {
    const lines = formatSummary(byClass).split('\n');
    expect(lines[0]).toMatch(/^class\s+runs/);
    expect(lines[1]).toMatch(/^soldier\s+2\s/);
    expect(lines.every((line) => line === line.trimEnd())).toBe(true);
  });
});
