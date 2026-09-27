// Pure logic for which way a unit faces: 'up' | 'down' | 'left' | 'right',
// matching the rows of a unit sheet (UNIT_SHEET.rows in tileset.js).

export const FACINGS = Object.freeze(['down', 'left', 'right', 'up']);

// The facing for a step from tile `from` to tile `to`. Steps are orthogonal,
// but a diagonal offset favors the horizontal. Returns null when the two
// tiles are the same, so the caller keeps its current facing.
export function getStepFacing(from, to) {
  if (to.x > from.x) return 'right';
  if (to.x < from.x) return 'left';
  if (to.y > from.y) return 'down';
  if (to.y < from.y) return 'up';
  return null;
}

// The facing for each step of path (path[0] is where the unit starts), one
// entry per tile after the first. A step that doesn't move keeps the facing
// before it (starting from `initial`).
export function getPathFacings(path, initial = 'down') {
  const facings = [];
  let facing = initial;
  for (let i = 1; i < path.length; i += 1) {
    facing = getStepFacing(path[i - 1], path[i]) ?? facing;
    facings.push(facing);
  }
  return facings;
}
