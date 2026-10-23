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

// The outline around the opaque pixels of an image cut into `cell` x `cell`
// frames: 1 for every transparent pixel within `width` steps (up, down,
// left, right) of an opaque one in the same frame, else 0, row by row.
// `alpha` is the image's alpha per pixel, row by row; any alpha above 0
// counts as opaque. The outline never crosses into a neighboring frame,
// so each frame's outline is cut where its art touches the frame's edge.
export function getOutlineMask(
  alpha: ArrayLike<number>,
  imageWidth: number,
  imageHeight: number,
  cell: number,
  width: number,
): Uint8Array {
  const mask = new Uint8Array(imageWidth * imageHeight);
  const opaque = (x: number, y: number) => alpha[y * imageWidth + x] > 0;
  for (let y = 0; y < imageHeight; y++) {
    const top = y - (y % cell);
    for (let x = 0; x < imageWidth; x++) {
      if (opaque(x, y)) continue;
      const left = x - (x % cell);
      search: for (let dy = -width; dy <= width; dy++) {
        const ny = y + dy;
        if (ny < top || ny >= Math.min(top + cell, imageHeight)) continue;
        const reach = width - Math.abs(dy);
        for (let dx = -reach; dx <= reach; dx++) {
          const nx = x + dx;
          if (nx < left || nx >= Math.min(left + cell, imageWidth)) continue;
          if (opaque(nx, ny)) {
            mask[y * imageWidth + x] = 1;
            break search;
          }
        }
      }
    }
  }
  return mask;
}
