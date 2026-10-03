// Pure logic for the movement arrow: which arrow piece to draw on each tile
// of a planned route. No Phaser — the scene maps piece names to sprites
// (ARROW_TILES in tileset.ts) and draws them.
//
// Piece names:
//   'head-up' | 'head-down' | 'head-left' | 'head-right' — the arrowhead on
//     the last tile, pointing the way the route last stepped;
//   'up-down' | 'left-right' — straight segments;
//   'up-left' | 'up-right' | 'down-left' | 'down-right' — corners, named
//     for the two tile edges they join.

import type { Point } from './grid.ts';

type Side = 'up' | 'down' | 'left' | 'right';

export type ArrowPiece =
  `head-${Side}` | 'up-down' | 'left-right' | 'up-left' | 'up-right' | 'down-left' | 'down-right';

export interface ArrowTile extends Point {
  piece: ArrowPiece;
}

// Canonical order for naming a segment by the two edges it joins.
const SIDE_ORDER: readonly Side[] = ['up', 'down', 'left', 'right'];

// Which edge of `from` faces the orthogonally adjacent tile `to`.
function sideToward(from: Point, to: Point): Side {
  if (to.x > from.x) return 'right';
  if (to.x < from.x) return 'left';
  if (to.y > from.y) return 'down';
  return 'up';
}

function segmentName(a: Side, b: Side): ArrowPiece {
  return [a, b].sort((p, q) => SIDE_ORDER.indexOf(p) - SIDE_ORDER.indexOf(q)).join('-') as ArrowPiece;
}

// Returns [{ x, y, piece }] for every tile of path after the first — the
// mover stands on path[0], so no arrow is drawn there. A path of zero or
// one tile has no arrow. path must be orthogonally adjacent steps, as
// returned by getMovePath / extendMovePath.
export function getArrowPieces(path: readonly Point[]): ArrowTile[] {
  const pieces: ArrowTile[] = [];
  for (let i = 1; i < path.length; i++) {
    const tile = path[i];
    const back = sideToward(tile, path[i - 1]);
    const piece: ArrowPiece =
      i === path.length - 1
        ? `head-${sideToward(path[i - 1], tile)}`
        : segmentName(back, sideToward(tile, path[i + 1]));
    pieces.push({ x: tile.x, y: tile.y, piece });
  }
  return pieces;
}
