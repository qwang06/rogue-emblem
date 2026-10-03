// Pure layout of multi-tile structures (see STRUCTURE_SPRITES in tileset.ts):
// which map tile each piece of a structure's image covers, and whether it
// draws over units.

import type { Point } from './grid.ts';

export interface StructureLayout {
  width: number;
  height: number;
  roofRows?: number;
}

export interface StructureTile extends Point {
  frame: number;
  overUnits: boolean;
}

// The tiles of `sprite` placed with its top-left tile at (x, y), in reading
// order, each as { x, y, frame, overUnits }: `frame` is the piece's frame on
// the image cut into one-tile frames, and `overUnits` is true for the top
// `roofRows` rows.
export function getStructureTiles(sprite: StructureLayout, x: number, y: number): StructureTile[] {
  const { width, height, roofRows = 0 } = sprite;
  const tiles: StructureTile[] = [];
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      tiles.push({ x: x + column, y: y + row, frame: row * width + column, overUnits: row < roofRows });
    }
  }
  return tiles;
}
