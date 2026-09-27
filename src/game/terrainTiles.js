// Picks terrain frames for a dual-grid tileset. Terrain tiles aren't drawn
// on the map's cells: they sit on a second grid shifted half a tile up and
// left, so each terrain tile covers the meeting point of four cells, one in
// each of its corners. A tile's frame depends only on which of those four
// cells hold the terrain being drawn (e.g. water over grass), which gives 16
// pieces — named for the corners that hold it, 'top-left+bottom-right' and
// so on, plus 'none' and 'all'. TERRAIN_CORNER_FRAMES in tileset.js maps
// them to frames.
//
// The terrain grid is one tile wider and taller than the map: terrain tile
// (x, y) has cell (x - 1, y - 1) in its top-left corner and cell (x, y) in
// its bottom-right.

import { getCell } from './grid.js';
import { TERRAIN_CORNER_FRAMES } from './tileset.js';

// Terrain tile corners, in piece-name order, as offsets from the tile's
// bottom-right cell.
const CORNERS = [
  { dx: -1, dy: -1, name: 'top-left' },
  { dx: 0, dy: -1, name: 'top-right' },
  { dx: -1, dy: 0, name: 'bottom-left' },
  { dx: 0, dy: 0, name: 'bottom-right' },
];

const clamp = (value, max) => Math.min(Math.max(value, 0), max);

// Size of the terrain grid for a map: one more tile in each direction.
export function getTerrainGridSize(grid) {
  return { width: grid.width + 1, height: grid.height + 1 };
}

// Names the piece terrain tile (x, y) needs: which of its corners hold
// `terrain`. Corners off the map take the nearest cell on it, so terrain
// reads as continuing past the map edge instead of drawing a border there.
export function getCornerPiece(grid, x, y, terrain) {
  const corners = CORNERS.filter(({ dx, dy }) => {
    const cell = getCell(grid, clamp(x + dx, grid.width - 1), clamp(y + dy, grid.height - 1));
    return cell.terrain === terrain;
  }).map(({ name }) => name);
  if (corners.length === 0) return 'none';
  if (corners.length === CORNERS.length) return 'all';
  return corners.join('+');
}

// The frame terrain tile (x, y) renders with. Only water has a corner set,
// drawn over grass; any other terrain draws as grass.
export function getTerrainFrame(grid, x, y, { terrain = 'water', cornerFrames = TERRAIN_CORNER_FRAMES } = {}) {
  return cornerFrames[terrain][getCornerPiece(grid, x, y, terrain)];
}
