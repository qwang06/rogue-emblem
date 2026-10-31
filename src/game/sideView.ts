// Pure layout rules for the side view: the floor is a grid of CELL-sized
// cells (wider than tall), and units, trees and other things standing on it
// are TILE_SIZE square art whose feet rest on their cell, so their bodies
// rise over the cells behind them. Things further down the screen (nearer
// the camera) draw over things behind them.

import { gridToWorld, type Point } from './grid.ts';
import { CELL, TILE_SIZE, UNIT_SHADOW } from './tileset.ts';

// Where in its art a standing sprite's feet are, in world pixels from the
// art's top edge: the line its shadow (UNIT_SHADOW) is centered on.
export const ART_FEET_Y = UNIT_SHADOW.centerY * TILE_SIZE;

// Where in its cell a standing sprite's feet rest, as a fraction of the
// cell's height from its top edge: a little below the middle, so the
// shadow sits inside the cell.
export const CELL_FEET = 0.7;

// The top-left corner, in world pixels, of a TILE_SIZE square sprite
// standing on cell (x, y).
export function getStandingPosition(x: number, y: number): Point {
  const cell = gridToWorld(x, y, CELL);
  return {
    x: cell.x + (CELL.width - TILE_SIZE) / 2,
    y: cell.y + CELL_FEET * CELL.height - ART_FEET_Y,
  };
}

// Where a piece of a standing prop is drawn (see MapSprite.base in
// mapArt.ts): a piece on its prop's row stands like a unit; a piece
// `base - y` rows behind it is stacked that many whole tiles above, so the
// prop's art joins up instead of being spread over the floor's shorter
// rows. Returns the piece's top-left corner and the row it sorts on.
export function getPropPlacement({ x, y, base = y }: { x: number; y: number; base?: number }): Point & {
  row: number;
} {
  const foot = getStandingPosition(x, base);
  return { x: foot.x, y: foot.y - (base - y) * TILE_SIZE, row: base };
}

// The lowest and highest depth a standing sprite gets (the band between
// the floor's highlights and arrows, and the cursor), so they never draw
// under the floor or over the cursor.
export const STANDING_DEPTH_MIN = 0.7;
export const STANDING_DEPTH_MAX = 0.79;
// A nudge far smaller than a row's step, to order things on the same row
// (a unit's outline just under it, its badge just over it).
export const STANDING_DEPTH_HAIR = 0.0005;
// How far a standing sprite's depth climbs per floor row.
const DEPTH_PER_ROW = 0.002;

// The depth for a standing sprite whose top edge is at world y `spriteY`:
// one step deeper per floor row its feet are on (fractional while it walks
// between rows), so sprites nearer the camera draw over those behind.
// Things on the same row tie; callers nudge by a hair to order them (a unit
// stands in front of the tree on its own cell).
export function getStandingDepth(spriteY: number): number {
  const row = Math.max(0, (spriteY + ART_FEET_Y) / CELL.height);
  return Math.min(STANDING_DEPTH_MIN + 0.005 + row * DEPTH_PER_ROW, STANDING_DEPTH_MAX);
}

// How far a TILE_SIZE square sprite standing on the top row pokes above
// the floor, in world pixels: the camera leaves room for it.
export const STANDING_OVERHANG = Math.max(0, ART_FEET_Y - CELL_FEET * CELL.height);

// How much bigger than a tile painted single-image units are drawn, so
// their detail reads on a painted battlefield. Their feet stay on their
// cell; the extra height rises over the cells behind.
export const PAINTED_UNIT_SCALE = 1.5;

// The origin (fractions of the drawn image) to draw TILE_SIZE square art
// `scale` times its size with, so a sprite positioned by its tile's
// top-left corner (getStandingPosition) keeps its feet where they'd be at
// 1x: centered across the tile, ART_FEET_Y down it. Every tween and
// follower can then keep working with the tile-anchored position.
export function getScaledArtOrigin(scale: number): Point {
  const feet = ART_FEET_Y / TILE_SIZE;
  return { x: (scale - 1) / (2 * scale), y: ((scale - 1) * feet) / scale };
}

// A painted unit's shadow cast on the ground by light from the upper left:
// each point of its silhouette `h` above its feet lands `h * lean` to the
// right of them and `h * drop` below, so the shadow falls from its feet
// toward the lower right. At `alpha`.
export const CAST_SHADOW = Object.freeze({ lean: 0.6, drop: 0.28, alpha: 0.32 });

// How to draw a `size`-square image whose feet are `feetY` down it as its
// cast shadow (CAST_SHADOW): the canvas it fits in, the 2D transform that
// lays the image down onto it (canvas setTransform's a, b, c, d, e, f), and
// where on that canvas the feet land, as fractions, to anchor it by.
export function getCastShadowLayout(
  size: number,
  feetY: number,
  { lean, drop }: { lean: number; drop: number } = CAST_SHADOW,
): {
  width: number;
  height: number;
  transform: [number, number, number, number, number, number];
  anchor: Point;
} {
  const pad = 4;
  // The art below its feet is pressed down the other way, back up and to
  // the left, so leave room for it there.
  const below = size - feetY;
  const left = pad + below * lean;
  const top = pad + below * drop;
  const width = Math.ceil(left + size + feetY * lean + pad);
  const height = Math.ceil(top + feetY * drop + pad);
  // x' = x - (y - feetY) * lean + left, y' = -(y - feetY) * drop + top.
  const transform: [number, number, number, number, number, number] = [
    1,
    0,
    -lean,
    -drop,
    feetY * lean + left,
    feetY * drop + top,
  ];
  return { width, height, transform, anchor: { x: (size / 2 + left) / width, y: top / height } };
}
