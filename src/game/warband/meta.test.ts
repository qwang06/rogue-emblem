import { describe, expect, it } from 'vitest';
import {
  getNextUnlock,
  getRunRenown,
  getUnlockedOrigins,
  isUnlocked,
  NEW_META,
  parseMeta,
  recordRun,
  RENOWN_FOR_VICTORY,
  RENOWN_PER_BOSS,
  RENOWN_PER_STAGE,
  RENOWN_PERCENT_PER_HEAT,
  serializeMeta,
  UNLOCKS,
  type MetaState,
} from './meta.ts';
import { MAX_HEAT } from './heat.ts';
import { UNLOCKABLE_ORIGINS } from './origins.ts';

const meta = (renown: number): MetaState => ({ ...NEW_META, renown });

describe('getRunRenown', () => {
  it('pays for stages cleared, bosses beaten and a victory', () => {
    const { lines, total } = getRunRenown({ stagesCleared: 10, bossesDefeated: 2, won: true });
    expect(lines).toEqual([
      { label: 'Stages cleared', count: 10, renown: 10 * RENOWN_PER_STAGE },
      { label: 'Bosses beaten', count: 2, renown: 2 * RENOWN_PER_BOSS },
      { label: 'Victory', count: 1, renown: RENOWN_FOR_VICTORY },
    ]);
    expect(total).toBe(10 * RENOWN_PER_STAGE + 2 * RENOWN_PER_BOSS + RENOWN_FOR_VICTORY);
  });

  it('leaves out what earned nothing', () => {
    expect(getRunRenown({ stagesCleared: 3, bossesDefeated: 0, won: false }).lines.map((line) => line.label)).toEqual([
      'Stages cleared',
    ]);
  });

  it('earns nothing for a run that fell on stage 1', () => {
    expect(getRunRenown({ stagesCleared: 0, bossesDefeated: 0, won: false })).toEqual({ lines: [], total: 0 });
  });
});

describe('UNLOCKS', () => {
  it('opens each unlockable origin once, cheapest first', () => {
    expect(UNLOCKS.map((unlock) => unlock.origin)).toEqual(UNLOCKABLE_ORIGINS.map(({ id }) => id));
    const costs = UNLOCKS.map((unlock) => unlock.renown);
    expect(costs).toEqual([...costs].sort((a, b) => a - b));
    expect(costs.every((cost) => Number.isInteger(cost) && cost > 0)).toBe(true);
  });

  it('puts the first unlock within one decent run', () => {
    expect(UNLOCKS[0].renown).toBeLessThanOrEqual(
      getRunRenown({ stagesCleared: 4, bossesDefeated: 0, won: false }).total,
    );
  });

  it('opens everything within a couple of won runs', () => {
    const won = getRunRenown({ stagesCleared: 10, bossesDefeated: 1, won: true }).total;
    expect(UNLOCKS.at(-1)!.renown).toBeLessThanOrEqual(2 * won);
  });
});

describe('isUnlocked, getUnlockedOrigins and getNextUnlock', () => {
  it('opens an unlock at exactly its renown', () => {
    const [first] = UNLOCKS;
    expect(isUnlocked(meta(first.renown - 1), first)).toBe(false);
    expect(isUnlocked(meta(first.renown), first)).toBe(true);
  });

  it('lists the origins renown has opened, and what comes next', () => {
    const [first, second] = UNLOCKS;
    expect(getUnlockedOrigins(NEW_META)).toEqual([]);
    expect(getNextUnlock(NEW_META)).toBe(first);
    expect(getUnlockedOrigins(meta(first.renown))).toEqual([first.origin]);
    expect(getNextUnlock(meta(first.renown))).toBe(second);
    expect(getUnlockedOrigins(meta(10_000))).toEqual(UNLOCKS.map((unlock) => unlock.origin));
    expect(getNextUnlock(meta(10_000))).toBeNull();
  });
});

describe('recordRun', () => {
  it('adds the renown, counts the run and keeps the best stage', () => {
    const fell = recordRun(NEW_META, { stage: 5, stagesCleared: 4, bossesDefeated: 1, won: false });
    expect(fell.meta).toEqual({
      renown: 4 * RENOWN_PER_STAGE + RENOWN_PER_BOSS,
      runs: 1,
      wins: 0,
      bestStage: 5,
      heat: 0,
    });
    expect(fell.earned.total).toBe(fell.meta.renown);
    const won = recordRun(fell.meta, { stage: 10, stagesCleared: 10, bossesDefeated: 1, won: true });
    expect(won.meta.runs).toBe(2);
    expect(won.meta.wins).toBe(1);
    expect(won.meta.bestStage).toBe(10);
    expect(recordRun(won.meta, { stage: 2, stagesCleared: 1, bossesDefeated: 0, won: false }).meta.bestStage).toBe(10);
  });

  it('reports only the unlocks the run newly opened', () => {
    const [first, second] = UNLOCKS;
    const before = meta(first.renown);
    const { unlocked } = recordRun(before, { stage: 20, stagesCleared: 20, bossesDefeated: 0, won: false });
    expect(unlocked).not.toContain(first);
    expect(unlocked).toContain(second);
    expect(recordRun(NEW_META, { stage: 1, stagesCleared: 0, bossesDefeated: 0, won: false }).unlocked).toEqual([]);
  });

  it('leaves its input alone and returns frozen state', () => {
    const before = meta(0);
    const { meta: after } = recordRun(before, { stage: 3, stagesCleared: 2, bossesDefeated: 0, won: false });
    expect(before.renown).toBe(0);
    expect(Object.isFrozen(after)).toBe(true);
  });
});

describe('Heat', () => {
  const won = { stage: 10, stagesCleared: 10, bossesDefeated: 1, won: true };
  const fell = { stage: 4, stagesCleared: 3, bossesDefeated: 0, won: false };

  it('opens Heat 1 with the first win, and the next with a win at the highest open', () => {
    const first = recordRun(NEW_META, won);
    expect(first.meta.heat).toBe(1);
    expect(first.heatUnlocked).toBe(1);
    const second = recordRun(first.meta, { ...won, heat: 1 });
    expect(second.meta.heat).toBe(2);
    expect(second.heatUnlocked).toBe(2);
  });

  it('opens nothing for a loss, or a win below the highest Heat open', () => {
    const at = (heat: number) => ({ ...NEW_META, heat });
    expect(recordRun(at(2), { ...fell, heat: 2 }).meta.heat).toBe(2);
    expect(recordRun(at(2), { ...won, heat: 1 }).meta.heat).toBe(2);
    expect(recordRun(at(2), { ...won, heat: 1 }).heatUnlocked).toBeNull();
    expect(recordRun(NEW_META, fell).heatUnlocked).toBeNull();
  });

  it('stops at the highest Heat', () => {
    const top = recordRun({ ...NEW_META, heat: MAX_HEAT }, { ...won, heat: MAX_HEAT });
    expect(top.meta.heat).toBe(MAX_HEAT);
    expect(top.heatUnlocked).toBeNull();
  });

  it('pays a share more renown for each Heat level', () => {
    const base = getRunRenown(won).total;
    const hot = getRunRenown({ ...won, heat: 2 });
    expect(hot.total).toBe(base + Math.floor((base * RENOWN_PERCENT_PER_HEAT * 2) / 100));
    expect(hot.lines.at(-1)).toEqual({ label: 'Heat 2', count: 1, renown: hot.total - base });
    expect(getRunRenown({ ...won, heat: 0 }).lines.map((line) => line.label)).not.toContain('Heat 0');
  });
});

describe('serializeMeta and parseMeta', () => {
  it('round-trips', () => {
    const state = { renown: 140, runs: 3, wins: 1, bestStage: 10, heat: 2 };
    expect(parseMeta(serializeMeta(state))).toEqual(state);
  });

  it('opens Heat 1 for a save from before Heat that has a win', () => {
    expect(parseMeta('{"renown": 140, "runs": 3, "wins": 1, "bestStage": 10}')?.heat).toBe(1);
    expect(parseMeta('{"renown": 40, "runs": 3, "wins": 0, "bestStage": 5}')?.heat).toBe(0);
  });

  it.each([
    ['not JSON', '{oops'],
    ['a list', '[]'],
    ['null', 'null'],
    ['missing fields', '{"renown": 10}'],
    ['negative renown', '{"renown": -1, "runs": 0, "wins": 0, "bestStage": 0}'],
    ['fractional runs', '{"renown": 0, "runs": 1.5, "wins": 0, "bestStage": 0}'],
    ['more wins than runs', '{"renown": 0, "runs": 1, "wins": 2, "bestStage": 0}'],
    ['a Heat past the highest', `{"renown": 0, "runs": 1, "wins": 1, "bestStage": 0, "heat": ${MAX_HEAT + 1}}`],
    ['a fractional Heat', '{"renown": 0, "runs": 1, "wins": 1, "bestStage": 0, "heat": 1.5}'],
  ])('rejects %s', (_, text) => {
    expect(parseMeta(text)).toBeNull();
  });
});
