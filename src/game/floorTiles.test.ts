import { describe, expect, it } from 'vitest';
import { getCellTones, MAX_CELL_TONE } from './floorTiles.ts';

describe('getCellTones', () => {
  it('gives every cell one tone, the same from the same seed', () => {
    const tones = getCellTones(14, 10, 3);
    expect(tones).toHaveLength(140);
    expect(new Set(tones.map(({ x, y }) => `${x},${y}`)).size).toBe(140);
    expect(getCellTones(14, 10, 3)).toEqual(tones);
    expect(getCellTones(14, 10, 4)).not.toEqual(tones);
  });

  it('keeps every tint faint', () => {
    for (const { light, alpha } of getCellTones(14, 10, 9)) {
      expect(alpha).toBeGreaterThanOrEqual(0);
      expect(alpha).toBeLessThanOrEqual(light ? MAX_CELL_TONE.light : MAX_CELL_TONE.dark);
    }
  });

  it('mixes lighter and darker cells, side-by-side ones mostly differing', () => {
    const tones = getCellTones(14, 10, 9);
    const at = (x: number, y: number) => tones[y * 14 + x];
    let differ = 0;
    let pairs = 0;
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 13; x++) {
        pairs++;
        if (at(x, y).light !== at(x + 1, y).light) differ++;
      }
    }
    expect(differ / pairs).toBeGreaterThan(0.5);
  });

  it('handles an empty grid', () => {
    expect(getCellTones(0, 0, 1)).toEqual([]);
  });
});
