// The shape of an enemy intent's arrow on the map, in pixels: a dashed,
// round-cornered line along the route the enemy walks, then a solid shaft
// from where it stops onto the unit it'll strike, ending in an arrowhead
// just inside that unit's tile. Pure geometry; GridScene draws it.

import type { Point } from './grid.ts';

export interface IntentArrowShape {
  // Dashes along the route, each a short polyline (its rounded corners
  // sampled). Empty when the enemy stays put.
  routeDashes: Point[][];
  // Where the route ends: the attacker's tile centre.
  end: Point;
  // The strike: shaft from `from` to the arrowhead's base, and the head as
  // [tip, left, right]. Null when the enemy only moves.
  strike: { from: Point; base: Point; head: [Point, Point, Point] } | null;
}

export interface IntentArrowStyle {
  // How far each route corner is cut and rounded, in px.
  cornerRadius: number;
  dash: number;
  gap: number;
  // Arrowhead length and half width, in px.
  headLength: number;
  headHalfWidth: number;
  // How far from the attacker's centre the shaft starts when it strikes
  // from where it stands, and how far short of the target's centre the tip
  // stops, as fractions of a tile, so the arrow spans the gap between the
  // two units, just overlapping each.
  startInset: number;
  tipInset: number;
}

export const DEFAULT_INTENT_ARROW_STYLE: IntentArrowStyle = Object.freeze({
  cornerRadius: 8,
  dash: 6,
  gap: 4,
  headLength: 9,
  headHalfWidth: 6,
  startInset: 0.3,
  tipInset: 0.2,
});

const tileCenter = ({ x, y }: Point, tileSize: number): Point => ({
  x: (x + 0.5) * tileSize,
  y: (y + 0.5) * tileSize,
});

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

// A polyline with each interior corner replaced by a quadratic curve that
// starts and ends `radius` px (at most half of either leg) from it, sampled
// at `samples` points. Straight runs pass through untouched.
export function roundCorners(points: readonly Point[], radius: number, samples = 6): Point[] {
  if (points.length < 3 || radius <= 0) return points.map((p) => ({ ...p }));
  const out: Point[] = [{ ...points[0] }];
  for (let i = 1; i < points.length - 1; i++) {
    const [prev, corner, next] = [points[i - 1], points[i], points[i + 1]];
    const inLen = distance(prev, corner);
    const outLen = distance(corner, next);
    const cross = (corner.x - prev.x) * (next.y - corner.y) - (corner.y - prev.y) * (next.x - corner.x);
    if (cross === 0 || inLen === 0 || outLen === 0) {
      out.push({ ...corner });
      continue;
    }
    const r = Math.min(radius, inLen / 2, outLen / 2);
    const start = lerp(corner, prev, r / inLen);
    const end = lerp(corner, next, r / outLen);
    for (let s = 0; s <= samples; s++) {
      const t = s / samples;
      const a = lerp(start, corner, t);
      const b = lerp(corner, end, t);
      out.push(lerp(a, b, t));
    }
  }
  out.push({ ...points[points.length - 1] });
  return out;
}

// Cuts a polyline into dashes `dash` px long with `gap` px between them,
// starting with a dash. Each dash keeps the corners it runs through.
export function dashPolyline(points: readonly Point[], dash: number, gap: number): Point[][] {
  if (points.length < 2 || dash <= 0) return [];
  const dashes: Point[][] = [];
  let drawing = true;
  let left = dash;
  let current: Point[] = [{ ...points[0] }];
  for (let i = 1; i < points.length; i++) {
    let from = points[i - 1];
    const to = points[i];
    let segment = distance(from, to);
    while (segment > 0) {
      if (segment < left) {
        if (drawing) current.push({ ...to });
        left -= segment;
        segment = 0;
        continue;
      }
      const cut = lerp(from, to, left / segment);
      if (drawing) {
        current.push(cut);
        dashes.push(current);
      } else {
        current = [cut];
      }
      segment -= left;
      from = cut;
      drawing = !drawing;
      left = drawing ? dash : gap;
    }
  }
  if (drawing && current.length > 1) dashes.push(current);
  return dashes;
}

// The arrow for an intent: `path` the tiles it walks (its first tile where
// it stands), `target` the tile it strikes or null.
export function getIntentArrowShape(
  path: readonly Point[],
  target: Point | null,
  tileSize: number,
  style: IntentArrowStyle = DEFAULT_INTENT_ARROW_STYLE,
): IntentArrowShape {
  const centers = path.map((tile) => tileCenter(tile, tileSize));
  const end = centers[centers.length - 1];
  const routeDashes =
    centers.length > 1 ? dashPolyline(roundCorners(centers, style.cornerRadius), style.dash, style.gap) : [];
  if (!target) return { routeDashes, end, strike: null };

  const aim = tileCenter(target, tileSize);
  const length = distance(end, aim);
  const dir = length === 0 ? { x: 1, y: 0 } : { x: (aim.x - end.x) / length, y: (aim.y - end.y) / length };
  const tip = { x: aim.x - dir.x * tileSize * style.tipInset, y: aim.y - dir.y * tileSize * style.tipInset };
  const base = { x: tip.x - dir.x * style.headLength, y: tip.y - dir.y * style.headLength };
  const side = { x: -dir.y * style.headHalfWidth, y: dir.x * style.headHalfWidth };
  const head: [Point, Point, Point] = [
    tip,
    { x: base.x + side.x, y: base.y + side.y },
    { x: base.x - side.x, y: base.y - side.y },
  ];
  // After a walk the shaft carries straight on from the route's end, on
  // an empty tile; from where the attacker stands it clears its sprite.
  const inset = centers.length > 1 ? 0 : tileSize * style.startInset;
  const from = { x: end.x + dir.x * inset, y: end.y + dir.y * inset };
  return { routeDashes, end, strike: { from, base, head } };
}
