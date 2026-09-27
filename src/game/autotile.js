// Picks terrain art for a blob autotile set: terrain drawn on the map's own
// cells, with its border inside the cells at its edge. Each cell is drawn as
// four quarter tiles, and each quarter only depends on the cell's two
// neighbors on that side and the diagonal between them — so five quarter
// shapes cover every combination of the eight neighbors:
//
//   'outer'      both side neighbors are other terrain: a rounded corner
//   'horizontal' only the row neighbor (left/right) matches: a border
//                running along the top or bottom
//   'vertical'   only the column neighbor (up/down) matches: a border
//                running down the left or right side
//   'inner'      both side neighbors match but the diagonal doesn't: a
//                small inside corner
//   'full'       all three match: open terrain
//
// The art for each shape comes from the same quarter of a tile in the set's
// plain 3x3 block (or its inside-corner tile), so textures keep lining up.
// TERRAIN_AUTOTILES in tileset.js says where those tiles are.

import { getCell } from './grid.js';

// Quarters in row-major order, each with the direction of its row
// neighbor (dx) and column neighbor (dy).
export const QUARTERS = [
  { name: 'top-left', dx: -1, dy: -1 },
  { name: 'top-right', dx: 1, dy: -1 },
  { name: 'bottom-left', dx: -1, dy: 1 },
  { name: 'bottom-right', dx: 1, dy: 1 },
];

const clamp = (value, max) => Math.min(Math.max(value, 0), max);

// Whether the cell (x, y) is `terrain`. Cells off the map take the nearest
// cell on it, so terrain reads as continuing past the edge instead of
// drawing a border there.
function holds(grid, x, y, terrain) {
  return getCell(grid, clamp(x, grid.width - 1), clamp(y, grid.height - 1)).terrain === terrain;
}

// The shape of each quarter of cell (x, y), keyed by quarter name, or null
// if the cell isn't `terrain`.
export function getQuarterShapes(grid, x, y, terrain) {
  if (!holds(grid, x, y, terrain)) return null;
  const shapes = {};
  for (const { name, dx, dy } of QUARTERS) {
    const row = holds(grid, x + dx, y, terrain);
    const column = holds(grid, x, y + dy, terrain);
    const diagonal = holds(grid, x + dx, y + dy, terrain);
    if (!row && !column) shapes[name] = 'outer';
    else if (!column) shapes[name] = 'horizontal';
    else if (!row) shapes[name] = 'vertical';
    else shapes[name] = diagonal ? 'full' : 'inner';
  }
  return shapes;
}

// The sheet tile, as [column, row], whose quarter `quarter` draws `shape`.
// Outer corners, edges and the middle come from the 3x3 block: the column
// is picked by the row neighbor's side and the row by the column neighbor's.
export function getShapeTile(autotile, shape, quarter) {
  if (shape === 'inner') return autotile.inner;
  const { dx, dy } = QUARTERS.find(({ name }) => name === quarter);
  const [column, row] = autotile.block;
  const side = (d) => (d < 0 ? 0 : 2);
  const across = shape === 'outer' || shape === 'vertical' ? side(dx) : 1;
  const down = shape === 'outer' || shape === 'horizontal' ? side(dy) : 1;
  return [column + across, row + down];
}

// Frame numbers for the four quarters of cell (x, y), in QUARTERS order, on
// the terrain sheet cut into half-size tiles (so it's `sheetColumns * 2`
// frames wide). `animationFrame` picks which copy of an animated set to
// use. Null if the cell isn't `terrain`.
export function getQuarterFrames(grid, x, y, terrain, autotile, sheetColumns, animationFrame = 0) {
  const shapes = getQuarterShapes(grid, x, y, terrain);
  if (!shapes) return null;
  const shift = animationFrame * (autotile.animation?.columnStride ?? 0);
  return QUARTERS.map(({ name, dx, dy }) => {
    const [column, row] = getShapeTile(autotile, shapes[name], name);
    const quarterColumn = (column + shift) * 2 + (dx < 0 ? 0 : 1);
    const quarterRow = row * 2 + (dy < 0 ? 0 : 1);
    return quarterRow * sheetColumns * 2 + quarterColumn;
  });
}

// Frame number of the whole tile [column, row] on a sheet `sheetColumns`
// tiles wide.
export function getTileFrame([column, row], sheetColumns) {
  return row * sheetColumns + column;
}
