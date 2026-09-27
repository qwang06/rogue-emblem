// Picks which piece of an edge set a cell draws with, so a patch of terrain
// (e.g. water) gets a border where it meets different terrain. Pieces are
// named for the edges that border other terrain: 'top-left', 'top',
// 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom',
// 'bottom-right', plus inner corners 'inner-top-left', 'inner-top-right',
// 'inner-bottom-right', 'inner-bottom-left' for other terrain touching only
// a diagonal. TERRAIN_EDGE_FRAMES in tileset.js maps them to frames.

import { getCell } from './grid.js';
import { TERRAIN_EDGE_FRAMES, TERRAIN_FRAMES } from './tileset.js';

// A neighbor borders the cell when it's on the map and holds other terrain.
// The map edge doesn't draw a border, so terrain reads as continuing past it.
function bordersAt(grid, x, y, terrain) {
  const neighbor = getCell(grid, x, y);
  return neighbor !== undefined && neighbor.terrain !== terrain;
}

// Border on one side only picks that side; on both sides or neither there's
// no edge piece for it, so the axis falls back to the middle.
function pickSide(before, after, beforeName, afterName) {
  if (before && !after) return beforeName;
  if (after && !before) return afterName;
  return null;
}

// Diagonal neighbors, named for the corner they sit at.
const CORNERS = [
  { dx: -1, dy: -1, name: 'top-left' },
  { dx: 1, dy: -1, name: 'top-right' },
  { dx: 1, dy: 1, name: 'bottom-right' },
  { dx: -1, dy: 1, name: 'bottom-left' },
];

// Returns the edge piece name for the cell at (x, y). Orthogonal neighbors
// pick the edge pieces; a cell with none that touches other terrain at
// exactly one diagonal is an inner corner ('inner-top-left', …), named for
// the corner the other terrain is in. More than one such diagonal has no
// piece, so it stays 'center'.
export function getEdgePiece(grid, x, y) {
  const { terrain } = getCell(grid, x, y);
  const vertical = pickSide(
    bordersAt(grid, x, y - 1, terrain),
    bordersAt(grid, x, y + 1, terrain),
    'top',
    'bottom',
  );
  const horizontal = pickSide(
    bordersAt(grid, x - 1, y, terrain),
    bordersAt(grid, x + 1, y, terrain),
    'left',
    'right',
  );
  if (vertical && horizontal) return `${vertical}-${horizontal}`;
  if (vertical || horizontal) return vertical ?? horizontal;

  // Only an untouched cell can be an inner corner: an edge piece already
  // draws a shoreline, and a side bordered on both sides has no piece.
  const touchesSide = [[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) => bordersAt(grid, x + dx, y + dy, terrain));
  if (touchesSide) return 'center';
  const corners = CORNERS.filter(({ dx, dy }) => bordersAt(grid, x + dx, y + dy, terrain));
  return corners.length === 1 ? `inner-${corners[0].name}` : 'center';
}

// The tileset frame a cell renders with: its edge piece for terrain that has
// an edge set (its center if the set lacks that piece), otherwise its plain
// terrain frame (grass for unknown terrain).
export function getTerrainFrame(grid, x, y, { frames = TERRAIN_FRAMES, edgeFrames = TERRAIN_EDGE_FRAMES } = {}) {
  const { terrain } = getCell(grid, x, y);
  const edges = edgeFrames[terrain];
  if (edges) return edges[getEdgePiece(grid, x, y)] ?? edges.center;
  return frames[terrain] ?? frames.grass;
}
