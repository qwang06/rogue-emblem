import { describe, expect, it } from 'vitest';
import { getEllipseSpans, getOutlineMask } from './pixelShapes.ts';

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

// Rows of '#' (opaque) and '.' (transparent) as an alpha array.
function image(rows: string[]) {
  return {
    alpha: rows
      .join('')
      .split('')
      .map((c) => (c === '#' ? 255 : 0)),
    width: rows[0].length,
    height: rows.length,
  };
}

function maskRows(mask: Uint8Array, width: number): string[] {
  const rows: string[] = [];
  for (let i = 0; i < mask.length; i += width)
    rows.push([...mask.slice(i, i + width)].map((v) => (v ? 'o' : '.')).join(''));
  return rows;
}

describe('getOutlineMask', () => {
  it('rings a pixel with its four neighbors at width 1, leaving the pixel itself out', () => {
    const { alpha, width, height } = image(['.....', '.....', '..#..', '.....', '.....']);
    expect(maskRows(getOutlineMask(alpha, width, height, 5, 1), width)).toEqual([
      '.....',
      '..o..',
      '.o.o.',
      '..o..',
      '.....',
    ]);
  });

  it('reaches as many steps as its width, as a diamond', () => {
    const { alpha, width, height } = image(['.....', '.....', '..#..', '.....', '.....']);
    expect(maskRows(getOutlineMask(alpha, width, height, 5, 2), width)).toEqual([
      '..o..',
      '.ooo.',
      'oo.oo',
      '.ooo.',
      '..o..',
    ]);
  });

  it('never spills into the next frame', () => {
    const { alpha, width, height } = image(['...#....']);
    expect(maskRows(getOutlineMask(alpha, width, height, 4, 1), width)).toEqual(['..o.....']);
  });

  it('is empty for a fully transparent image, and for width 0', () => {
    const blank = image(['....', '....']);
    expect([...getOutlineMask(blank.alpha, 4, 2, 4, 1)].every((v) => v === 0)).toBe(true);
    const dot = image(['.#..']);
    expect([...getOutlineMask(dot.alpha, 4, 1, 4, 0)].every((v) => v === 0)).toBe(true);
  });
});
