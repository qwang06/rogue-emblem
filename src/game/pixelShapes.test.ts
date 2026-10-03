import { describe, expect, it } from 'vitest';
import { getEllipseSpans } from './pixelShapes.ts';

describe('getEllipseSpans', () => {
  it('has one span per row, top to bottom', () => {
    expect(getEllipseSpans(20, 6).map(({ y }) => y)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('rasterizes a flat ellipse, widest in the middle rows', () => {
    expect(getEllipseSpans(20, 6)).toEqual([
      { y: 0, x: 4, width: 12 },
      { y: 1, x: 1, width: 18 },
      { y: 2, x: 0, width: 20 },
      { y: 3, x: 0, width: 20 },
      { y: 4, x: 1, width: 18 },
      { y: 5, x: 4, width: 12 },
    ]);
  });

  it('is symmetric and stays inside the box', () => {
    const spans = getEllipseSpans(13, 7);
    spans.forEach((span, i) => {
      expect(span.x).toBeGreaterThanOrEqual(0);
      expect(span.x + span.width).toBeLessThanOrEqual(13);
      expect(span).toMatchObject({ x: spans[spans.length - 1 - i].x, width: spans[spans.length - 1 - i].width });
    });
  });

  it('is a full row for a 1-pixel-tall ellipse and empty for zero size', () => {
    expect(getEllipseSpans(8, 1)).toEqual([{ y: 0, x: 0, width: 8 }]);
    expect(getEllipseSpans(8, 0)).toEqual([]);
  });
});
