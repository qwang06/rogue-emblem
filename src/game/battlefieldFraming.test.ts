import { describe, expect, it } from 'vitest';
import { FRAMING_FOLIAGE, FRAMING_OVERLAP, getFramingClumps } from './battlefieldFraming.ts';
import { BATTLEFIELD_KINDS, BATTLEFIELD_OBSTACLES } from './battlefields.ts';

const FLOOR = { width: 640, height: 240 };
// A wide screen showing plenty past the floor, and a tight one that shows
// almost none.
const WIDE = { x: -205, y: -205, width: 1050, height: 530 };
const TIGHT = { x: -10, y: -130, width: 660, height: 380 };

// How far a clump reaches over the floor, the lesser of across and down.
function overlap({ x, y, size }: { x: number; y: number; size: number }) {
  const across = Math.min(x + size, FLOOR.width) - Math.max(x, 0);
  const down = FLOOR.height - Math.max(y, 0);
  return Math.max(0, Math.min(across, down));
}

describe('getFramingClumps', () => {
  it('frames each field with its own kinds of obstacle', () => {
    for (const kind of BATTLEFIELD_KINDS) {
      expect(FRAMING_FOLIAGE[kind].length).toBeGreaterThan(0);
      for (const clump of getFramingClumps(kind, WIDE, FLOOR)) expect(FRAMING_FOLIAGE[kind]).toContain(clump.kind);
    }
    // Every framing kind has art, being one of the obstacles.
    const obstacles = new Set(Object.values(BATTLEFIELD_OBSTACLES).flat());
    for (const kinds of Object.values(FRAMING_FOLIAGE)) for (const k of kinds) expect(obstacles.has(k)).toBe(true);
  });

  it('puts clumps in both bottom corners of a wide view, mirrored between them', () => {
    const clumps = getFramingClumps('plains', WIDE, FLOOR);
    const left = clumps.filter((c) => c.x + c.size / 2 < FLOOR.width / 2);
    const right = clumps.filter((c) => c.x + c.size / 2 >= FLOOR.width / 2);
    expect(left.length).toBeGreaterThan(0);
    expect(right.length).toBe(left.length);
    expect(left[0].flip).not.toBe(right[0].flip);
    for (const c of clumps) expect(c.y + c.size).toBeGreaterThan(WIDE.y + WIDE.height);
  });

  it('keeps every clump on screen and off the floor but for a sliver', () => {
    for (const view of [WIDE, TIGHT]) {
      for (const c of getFramingClumps('forest', view, FLOOR)) {
        expect(overlap(c)).toBeLessThanOrEqual(FRAMING_OVERLAP + 1e-9);
        expect(c.y).toBeLessThan(view.y + view.height);
        expect(c.x + c.size).toBeGreaterThan(view.x);
        expect(c.x).toBeLessThan(view.x + view.width);
      }
    }
  });

  it('drops clumps with no room below or beside the floor', () => {
    const flush = { x: 0, y: -120, width: 640, height: 360 };
    expect(getFramingClumps('desert', flush, FLOOR)).toEqual([]);
  });
});
