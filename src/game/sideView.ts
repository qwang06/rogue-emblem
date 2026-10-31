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
