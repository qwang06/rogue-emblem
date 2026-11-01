import { describe, expect, it } from 'vitest';
import { dashPolyline, DEFAULT_INTENT_ARROW_STYLE, getIntentArrowShape, roundCorners } from './intentArrow.ts';

const length = (points: { x: number; y: number }[]) =>
  points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - points[i].x, p.y - points[i].y), 0);

describe('roundCorners', () => {
  it('leaves a straight line alone', () => {
    const line = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
    ];
    expect(roundCorners(line, 5)).toEqual(line);
  });

  it('cuts a corner into a curve that starts and ends radius px away', () => {
    const corner = [
      { x: 0, y: 0 },
      { x: 32, y: 0 },
      { x: 32, y: 32 },
    ];
    const rounded = roundCorners(corner, 8, 4);
    expect(rounded[0]).toEqual({ x: 0, y: 0 });
    expect(rounded[1]).toEqual({ x: 24, y: 0 });
    expect(rounded[rounded.length - 2]).toEqual({ x: 32, y: 8 });
    expect(rounded[rounded.length - 1]).toEqual({ x: 32, y: 32 });
    // The curve stays inside the corner.
    for (const p of rounded) expect(p.x <= 32 && p.y >= 0).toBe(true);
  });

  it('never cuts more than half of a short leg', () => {
    const corner = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 40 },
    ];
    expect(roundCorners(corner, 8, 2)[1]).toEqual({ x: 2, y: 0 });
  });

  it('copies paths too short to have a corner', () => {
    expect(roundCorners([{ x: 1, y: 2 }], 8)).toEqual([{ x: 1, y: 2 }]);
  });
});

describe('dashPolyline', () => {
  it('cuts a line into dashes with gaps between', () => {
    const dashes = dashPolyline(
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
      ],
      6,
      4,
    );
    expect(dashes).toEqual([
      [
        { x: 0, y: 0 },
        { x: 6, y: 0 },
      ],
      [
        { x: 10, y: 0 },
        { x: 16, y: 0 },
      ],
    ]);
  });

  it('keeps the corner a dash runs through', () => {
    const [first] = dashPolyline(
      [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 10 },
      ],
      6,
      4,
    );
    expect(first).toEqual([
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 3 },
    ]);
  });

  it('ends on a partial dash', () => {
    const dashes = dashPolyline(
      [
        { x: 0, y: 0 },
        { x: 12, y: 0 },
      ],
      6,
      4,
    );
    expect(dashes[dashes.length - 1]).toEqual([
      { x: 10, y: 0 },
      { x: 12, y: 0 },
    ]);
  });

  it('has no dashes for a single point', () => {
    expect(dashPolyline([{ x: 0, y: 0 }], 6, 4)).toEqual([]);
  });
});

describe('getIntentArrowShape', () => {
  it('runs a strike arrow onto an adjacent target, spanning the gap between the tiles', () => {
    const shape = getIntentArrowShape([{ x: 2, y: 0 }], { x: 1, y: 0 }, 32);
    expect(shape.routeDashes).toEqual([]);
    expect(shape.end).toEqual({ x: 80, y: 16 });
    const { from, base, head } = shape.strike!;
    expect(from).toEqual({ x: 80 - 32 * 0.3, y: 16 });
    expect(head[0]).toEqual({ x: 48 + 32 * 0.2, y: 16 });
    expect(base).toEqual({ x: head[0].x + DEFAULT_INTENT_ARROW_STYLE.headLength, y: 16 });
    expect(head[1].y - head[2].y).toBe(-2 * DEFAULT_INTENT_ARROW_STYLE.headHalfWidth);
  });

  it('starts the strike where the route ends after a walk', () => {
    const shape = getIntentArrowShape(
      [
        { x: 3, y: 0 },
        { x: 2, y: 0 },
      ],
      { x: 1, y: 0 },
      32,
    );
    expect(shape.strike!.from).toEqual({ x: 80, y: 16 });
    expect(shape.routeDashes.length).toBeGreaterThan(0);
  });

  it('dashes the route the enemy walks, about as long as the route', () => {
    const shape = getIntentArrowShape(
      [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
      ],
      null,
      32,
    );
    expect(shape.strike).toBeNull();
    const drawn = shape.routeDashes.reduce((sum, dash) => sum + length(dash), 0);
    expect(drawn).toBeGreaterThan(96 * 0.55);
    expect(drawn).toBeLessThan(96 * 0.65);
    expect(shape.end).toEqual({ x: 112, y: 16 });
  });

  it('aims a ranged strike straight at its target', () => {
    const { strike } = getIntentArrowShape([{ x: 0, y: 0 }], { x: 2, y: 2 }, 32);
    const { from, head } = strike!;
    expect(from.x).toBeCloseTo(from.y);
    expect(head[0].x).toBeCloseTo(head[0].y);
    expect(head[0].x).toBeLessThan(80);
  });
});
