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
