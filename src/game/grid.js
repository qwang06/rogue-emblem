// Pure grid data structure: no Phaser, no rendering, no hidden state.
// Cells are stored row-major in a flat array. Every mutation-shaped
// function returns a new grid rather than modifying the one it was given.

export function createGrid(width, height, terrain = null) {
  const cells = new Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      cells[y * width + x] = { x, y, terrain, unitId: null };
    }
  }
  return { width, height, cells };
}

export function isInBounds(grid, x, y) {
  return x >= 0 && y >= 0 && x < grid.width && y < grid.height;
}

function indexOf(grid, x, y) {
  return y * grid.width + x;
}

export function getCell(grid, x, y) {
  if (!isInBounds(grid, x, y)) return undefined;
  return grid.cells[indexOf(grid, x, y)];
}

function withCell(grid, x, y, changes) {
  if (!isInBounds(grid, x, y)) {
    throw new RangeError(`(${x}, ${y}) is out of bounds for a ${grid.width}x${grid.height} grid`);
  }
  const cells = grid.cells.slice();
  const i = indexOf(grid, x, y);
  cells[i] = { ...cells[i], ...changes };
  return { ...grid, cells };
}

export function setTerrain(grid, x, y, terrain) {
  return withCell(grid, x, y, { terrain });
}

export function setUnit(grid, x, y, unitId) {
  return withCell(grid, x, y, { unitId });
}

// Moves the unit on `from` to `to`, leaving `from` empty. Throws if there's
// no unit to move or `to` is already occupied — callers should only ask
// for moves the movement rules allow.
export function moveUnit(grid, from, to) {
  const unitId = getCell(grid, from.x, from.y)?.unitId;
  if (!unitId) {
    throw new Error(`No unit at (${from.x}, ${from.y}) to move`);
  }
  if (from.x === to.x && from.y === to.y) return grid;
  if (getCell(grid, to.x, to.y)?.unitId) {
    throw new Error(`(${to.x}, ${to.y}) is already occupied`);
  }
  return setUnit(setUnit(grid, from.x, from.y, null), to.x, to.y, unitId);
}

// Where unitId currently stands as { x, y }, or null if it isn't on the grid.
export function findUnit(grid, unitId) {
  const cell = grid.cells.find((c) => c.unitId === unitId);
  return cell ? { x: cell.x, y: cell.y } : null;
}

// The first `count` tiles in reading order from a corner, as [{ x, y }]:
// 'top-left' walks rows left to right from the top, 'bottom-right' takes the
// last `count` tiles of the grid (still returned in reading order). Clamps
// to the grid's size.
export function getCornerTiles(grid, corner, count) {
  const n = Math.max(0, Math.min(count, grid.cells.length));
  let cells;
  if (corner === 'top-left') cells = grid.cells.slice(0, n);
  else if (corner === 'bottom-right') cells = grid.cells.slice(grid.cells.length - n);
  else throw new Error(`Unknown corner: ${corner}`);
  return cells.map(({ x, y }) => ({ x, y }));
}

// Orthogonal neighbors only — this is a Fire Emblem/Advance Wars style
// grid, not one with diagonal movement.
export function getNeighbors(grid, x, y) {
  const offsets = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];
  return offsets
    .map(([dx, dy]) => ({ x: x + dx, y: y + dy }))
    .filter(({ x: nx, y: ny }) => isInBounds(grid, nx, ny));
}

export function gridToWorld(x, y, tileSize) {
  return { x: x * tileSize, y: y * tileSize };
}

export function worldToGrid(px, py, tileSize) {
  return { x: Math.floor(px / tileSize), y: Math.floor(py / tileSize) };
}
