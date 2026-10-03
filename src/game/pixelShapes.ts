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
