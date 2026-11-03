import { describe, expect, it } from 'vitest';
import { tallArtDepth, UNIT_DEPTH, unitDepth } from './depthOrder.ts';

describe('unitDepth', () => {
  it('draws units further south in front', () => {
    expect(unitDepth(0)).toBe(UNIT_DEPTH);
    expect(unitDepth(3)).toBeGreaterThan(unitDepth(2));
    expect(unitDepth(2.5)).toBeGreaterThan(unitDepth(2));
  });

  it('stays under the rank badges and the attacking unit on a 100-row map', () => {
    expect(unitDepth(99)).toBeLessThan(0.76);
  });

  it('treats a sprite lifted above the top row like the top row', () => {
    expect(unitDepth(-1)).toBe(UNIT_DEPTH);
  });
});

describe('tallArtDepth', () => {
  it("covers a unit standing north of the art's base", () => {
    expect(tallArtDepth(4)).toBeGreaterThan(unitDepth(3));
  });

  it('stays behind a unit on the base cell or south of it', () => {
    expect(tallArtDepth(4)).toBeLessThan(unitDepth(4));
    expect(tallArtDepth(4)).toBeLessThan(unitDepth(5));
  });

  it("is passed halfway through a unit's step onto the base row", () => {
    expect(tallArtDepth(4)).toBeGreaterThan(unitDepth(3.4));
    expect(tallArtDepth(4)).toBeLessThan(unitDepth(3.6));
  });

  it('stays over the range highlights and intent arrows', () => {
    expect(tallArtDepth(0)).toBeGreaterThan(0.65);
  });
});
