// Pure pixel-art shape rasterizing: which pixels a shape covers, as
// horizontal runs, so a scene can draw it with crisp rectangles instead of
// an anti-aliased curve.

export interface Span {
  y: number;
  x: number;
  width: number;
}

// An ellipse filling a width x height box, one span per row:
// [{ y, x, width }], rows top to bottom, symmetric left/right and
// top/bottom. Each row's span is as wide as the ellipse at the row's middle.
export function getEllipseSpans(width: number, height: number): Span[] {
  const spans: Span[] = [];
  const rx = width / 2;
  const ry = height / 2;
  for (let y = 0; y < height; y++) {
    const dy = (y + 0.5 - ry) / ry;
    const half = rx * Math.sqrt(1 - dy * dy);
    const x = Math.round(rx - half);
    spans.push({ y, x, width: width - 2 * x });
  }
  return spans;
}

// Pixel art written out as text: one string per row, each character a
// pixel, `palette` giving the color (0xRRGGBB) of each character it names;
// any other character ('.') is transparent.
export interface PixelArt {
  rows: readonly string[];
  palette: Readonly<Record<string, number>>;
}

export interface ColorSpan extends Span {
  color: number;
}

// The opaque pixels of `art`, as runs of one color along each row, top to
// bottom and left to right, so it can be drawn as a few crisp rectangles.
export function getPixelArtSpans({ rows, palette }: PixelArt): ColorSpan[] {
  const spans: ColorSpan[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const color = palette[row[x]];
      let end = x + 1;
      while (end < row.length && row[end] === row[x]) end++;
      if (color !== undefined) spans.push({ y, x, width: end - x, color });
      x = end;
    }
  });
  return spans;
}
