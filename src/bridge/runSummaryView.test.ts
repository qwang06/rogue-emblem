import { describe, expect, it } from 'vitest';
import { getUnitSprite } from '../game/tileset.ts';
import { NEW_META, recordRun, UNLOCKS } from '../game/warband/meta.ts';
import type { RunSummary } from '../game/warband/runSummary.ts';
import { humanizeId, toRunSummaryView } from './runSummaryView.ts';

const summary: RunSummary = {
  won: false,
  stage: 5,
  stagesCleared: 4,
  bossesDefeated: 0,
  playMs: 754_000,
  kills: 7,
  mvp: { id: 'alden', name: 'Alden', classId: 'soldier', level: 4, kills: 5 },
  survivors: [],
  memorial: [
    { id: 'alden', name: 'Alden', classId: 'soldier', level: 4, kills: 5, stage: 5 },
    { id: 'bryn', name: 'Bryn', classId: 'archer', level: 3, kills: 2, stage: null },
  ],
  relics: ['lucky-coin'],
};

describe('toRunSummaryView', () => {
  it('names units by class and sprite, and shows the time as text', () => {
    const view = toRunSummaryView(summary, recordRun(NEW_META, summary));
    expect(view.playTime).toBe('12:34');
    expect(view.mvp).toEqual({
      key: 'alden',
      name: 'Alden',
      classLabel: 'Soldier',
      level: 4,
      kills: 5,
      sprite: getUnitSprite('soldier'),
    });
    expect(view.memorial.map((unit) => [unit.name, unit.classLabel, unit.stage])).toEqual([
      ['Alden', 'Soldier', 5],
      ['Bryn', 'Archer', null],
    ]);
    expect(view.survivors).toBe(0);
    expect(view.relics).toEqual(['Lucky Coin']);
    expect(Object.isFrozen(view)).toBe(true);
  });

  it("carries the run's renown, what it unlocked and what comes next", () => {
    const view = toRunSummaryView(summary, recordRun(NEW_META, summary));
    expect(view.renown.earned).toBe(40);
    expect(view.renown.total).toBe(40);
    expect(view.renown.unlocked).toEqual([UNLOCKS[0].label]);
    expect(view.renown.next).toEqual({ label: UNLOCKS[1].label, renown: UNLOCKS[1].renown });
    const maxed = toRunSummaryView(summary, recordRun({ ...NEW_META, renown: 10_000 }, summary));
    expect(maxed.renown.unlocked).toEqual([]);
    expect(maxed.renown.next).toBeNull();
  });

  it('names relics with the lookup it is given', () => {
    expect(toRunSummaryView(summary, recordRun(NEW_META, summary), () => 'Coin').relics).toEqual(['Coin']);
  });
});

describe('humanizeId', () => {
  it('turns an id into words', () => {
    expect(humanizeId('lucky-coin')).toBe('Lucky Coin');
    expect(humanizeId('war_horn')).toBe('War Horn');
  });
});
