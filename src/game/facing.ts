// Pure logic for which way a unit faces. The battlefield is seen from the
// side, so units only ever face 'left' or 'right' (the rows of a unit sheet
// they use, UNIT_SHEET.rows in tileset.ts): stepping toward or away from
// the camera keeps the way they faced before.

import type { Team } from './turns.ts';

export type Facing = 'left' | 'right';

export interface Tile {
  x: number;
  y: number;
}

export const FACINGS: readonly Facing[] = Object.freeze(['left', 'right']);

// The way a unit of `team` faces before it has moved: the player's side
// (and its guests) starts on the left facing right, enemies face left.
export function getStartFacing(team: Team): Facing {
  return team === 'enemy' ? 'left' : 'right';
}

// The facing for looking from tile `from` toward tile `to`: the side `to`
// lies on. Returns null when they share a column (a step toward or away from
// the camera, or no step at all), so the caller keeps its current facing.
export function getFacingToward(from: Tile, to: Tile): Facing | null {
  if (to.x > from.x) return 'right';
  if (to.x < from.x) return 'left';
  return null;
}

// The facing for a step from tile `from` to tile `to` (see getFacingToward).
export const getStepFacing = getFacingToward;

// The facing for each step of path (path[0] is where the unit starts), one
// entry per tile after the first. A step that doesn't move sideways keeps
// the facing before it (starting from `initial`).
export function getPathFacings(path: readonly Tile[], initial: Facing = 'right'): Facing[] {
  const facings: Facing[] = [];
  let facing = initial;
  for (let i = 1; i < path.length; i += 1) {
    facing = getStepFacing(path[i - 1], path[i]) ?? facing;
    facings.push(facing);
  }
  return facings;
}
