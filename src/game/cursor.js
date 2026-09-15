// Pure logic for the map cursor: a single grid position clamped to stay
// in bounds. No Phaser, no rendering, no hidden state.

export function createCursor(x = 0, y = 0) {
  return { x, y };
}

export function moveCursor(grid, cursor, dx, dy) {
  const x = Math.min(Math.max(cursor.x + dx, 0), grid.width - 1);
  const y = Math.min(Math.max(cursor.y + dy, 0), grid.height - 1);
  return { x, y };
}
