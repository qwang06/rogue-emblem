// Picks terrain art for a corner (Wang) tileset: 16 tiles per pair of
// terrains, each tile keyed by which of its four corners are the set's
// "upper" terrain (PixelLab's create_topdown_tileset makes these). Such
// sets are drawn on a dual grid, one tile centered on each point where four
// cells meet, with each corner taking the terrain of the cell it sits in.
//
// The map still draws on its own cells: each cell is four quarter tiles,
// and its top-left quarter is the bottom-right quarter of the tile centered
// on the cell's top-left corner (and so on round the cell). So a cell's
// quarter only depends on the cell, its two neighbors on that side and the
// diagonal between them, like the blob autotile in autotile.ts.

import { QUARTERS, type SheetTile } from './autotile.ts';
import { getCell, type Grid } from './grid.ts';

// A Wang set on a sheet of whole tiles: tile index i (0–15) is at
// [i, row]. index = NW*8 + NE*4 + SW*2 + SE*1, where a corner is 1 when it's
// the set's upper terrain. The set paints `terrains` (grass is the other
// one), as its upper or its lower terrain (`terrainIs`). A `base` set draws
// every quarter: it's the ground under everything. Any other set only draws
// quarters showing some of its terrain.
export interface WangSet {
  row: number;
  terrains: readonly string[];
  terrainIs: 'upper' | 'lower';
  base?: boolean;
}

const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);

// Whether cell (x, y) is one of `terrains`. Cells off the map take the
// nearest cell on it, so terrain reads as running on past the edge.
function isOneOf(grid: Grid, x: number, y: number, terrains: readonly string[]): boolean {
  const terrain = getCell(grid, clamp(x, grid.width - 1), clamp(y, grid.height - 1))!.terrain;
  return terrain !== null && terrains.includes(terrain);
}

// The Wang index of `set`'s tile centered on the point where cells
// (cx - 1 .. cx, cy - 1 .. cy) meet, i.e. the top-left corner of cell
// (cx, cy).
export function getWangIndex(grid: Grid, cx: number, cy: number, set: WangSet): number {
  const corner = (x: number, y: number) => (isOneOf(grid, x, y, set.terrains) === (set.terrainIs === 'upper') ? 1 : 0);
  return corner(cx - 1, cy - 1) * 8 + corner(cx, cy - 1) * 4 + corner(cx - 1, cy) * 2 + corner(cx, cy);
}

// The Wang index for each quarter of cell (x, y), in QUARTERS order.
export function getWangQuarters(grid: Grid, x: number, y: number, set: WangSet): number[] {
  return QUARTERS.map(({ dx, dy }) => getWangIndex(grid, x + (dx < 0 ? 0 : 1), y + (dy < 0 ? 0 : 1), set));
}

// Whether a quarter showing Wang tile `index` is drawn for `set`: always
// for a base set, else when some corner is its terrain.
function draws(set: WangSet, index: number): boolean {
  return set.base === true || index !== (set.terrainIs === 'upper' ? 0 : 15);
}

// The frame of quarter (qx, qy) (0 or 1 each) of sheet tile [column, row],
// on a sheet `sheetColumns` whole tiles wide cut into half-size tiles.
export function getQuarterFrame([column, row]: SheetTile, qx: number, qy: number, sheetColumns: number): number {
  return (row * 2 + qy) * sheetColumns * 2 + column * 2 + qx;
}

// The whole map's quarter frames for one Wang set, as rows of half-size
// tiles (`grid.height * 2` rows of `grid.width * 2`), -1 where the set
// draws nothing. A cell's top-left quarter is its corner tile's
// bottom-right quarter, so the quarter taken is the opposite one.
export function getWangFrameMap(grid: Grid, set: WangSet, sheetColumns: number): number[][] {
  const data = Array.from({ length: grid.height * 2 }, () => Array<number>(grid.width * 2).fill(-1));
  for (const { x, y } of grid.cells) {
    getWangQuarters(grid, x, y, set).forEach((index, q) => {
      if (!draws(set, index)) return;
      const { dx, dy } = QUARTERS[q];
      data[y * 2 + (q >> 1)][x * 2 + (q & 1)] = getQuarterFrame(
        [index, set.row],
        dx < 0 ? 1 : 0,
        dy < 0 ? 1 : 0,
        sheetColumns,
      );
    });
  }
  return data;
}
