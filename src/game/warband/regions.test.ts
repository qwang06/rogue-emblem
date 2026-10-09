import { describe, expect, it } from 'vitest';
import { getRegionStages, getRegionConfig, getStageRegion, type RegionConfig } from './regions.ts';

const region = (name: string): RegionConfig => ({
  name,
  terrain: { width: 8, height: 8 },
  enemies: [{ count: 1 }],
  treeChance: 0,
  palette: 'a-stone',
});
const [A, B, C] = ['a', 'b', 'c'].map(region);

describe('getRegionConfig', () => {
  it('moves to the next region every stage by default', () => {
    expect([1, 2, 3].map((stage) => getRegionConfig(stage, [A, B, C]))).toEqual([A, B, C]);
  });

  it('shares a region across stagesPerRegion stages in a row', () => {
    const stages = [1, 2, 3, 4, 5, 6].map((stage) => getRegionConfig(stage, [A, B, C], 2));
    expect(stages).toEqual([A, A, B, B, C, C]);
  });

  it('sticks on the last region once they run out', () => {
    expect(getRegionConfig(4, [A, B])).toBe(B);
    expect(getRegionConfig(100, [A, B], 3)).toBe(B);
    expect(getRegionConfig(1000, [A, B, C])).toBe(C);
  });

  it('works with a single region', () => {
    expect(getRegionConfig(1, [A])).toBe(A);
    expect(getRegionConfig(9, [A])).toBe(A);
  });

  it('rejects stages below 1 or between whole numbers', () => {
    expect(() => getRegionConfig(0, [A])).toThrow();
    expect(() => getRegionConfig(-1, [A])).toThrow();
    expect(() => getRegionConfig(1.5, [A])).toThrow();
  });

  it('rejects an empty region list and stagesPerRegion below 1', () => {
    expect(() => getRegionConfig(1, [])).toThrow();
    expect(() => getRegionConfig(1, [A], 0)).toThrow();
    expect(() => getRegionConfig(1, [A], 1.5)).toThrow();
  });
});

describe('getStageRegion', () => {
  it('uses the settings it is given', () => {
    const settings = { stagesPerRegion: 2, regions: [region('A'), region('B')] };
    expect(getStageRegion(2, settings).name).toBe('A');
    expect(getStageRegion(3, settings).name).toBe('B');
    expect(getStageRegion(99, settings).name).toBe('B');
  });
});

describe('getRegionStages', () => {
  it('gives each region its stretch of stages', () => {
    expect(getRegionStages(0, 3, 1)).toEqual({ first: 1, last: 1 });
    expect(getRegionStages(1, 3, 2)).toEqual({ first: 3, last: 4 });
  });

  it('leaves the last region open-ended', () => {
    expect(getRegionStages(2, 3, 2)).toEqual({ first: 5, last: null });
    expect(getRegionStages(0, 1, 1)).toEqual({ first: 1, last: null });
  });
});
