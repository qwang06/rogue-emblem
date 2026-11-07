import { describe, expect, it } from 'vitest';
import { getPips, pointsPerPip } from './pips.ts';

describe('getPips', () => {
  it('lights one block per point at small maximums', () => {
    expect(getPips(3, 5)).toEqual(['on', 'on', 'on', 'off', 'off']);
  });

  it('marks the points about to be lost', () => {
    expect(getPips(5, 5, 2)).toEqual(['on', 'on', 'on', 'lost', 'lost']);
  });

  it('caps the lost points at the current value', () => {
    expect(getPips(2, 4, 9)).toEqual(['lost', 'lost', 'off', 'off']);
  });

  it('packs two points per block past the limit, rounding an odd maximum up', () => {
    expect(pointsPerPip(12)).toBe(1);
    expect(pointsPerPip(13)).toBe(2);
    expect(getPips(21, 21)).toHaveLength(11);
    // 7 of 14: blocks for points 0, 2, 4, 6 are lit, 8, 10, 12 dark.
    expect(getPips(7, 14)).toEqual(['on', 'on', 'on', 'on', 'off', 'off', 'off']);
  });

  it('is empty at a zero maximum and never negative', () => {
    expect(getPips(0, 0)).toEqual([]);
    expect(getPips(-1, 2)).toEqual(['off', 'off']);
  });
});
