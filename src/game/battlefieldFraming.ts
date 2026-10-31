// Foreground framing for a battlefield: big, out-of-focus clumps of the
// field's own plants and rocks in the bottom corners of the screen, as if
// the camera were looking past them at the fight. They frame the picture
// so the field reads as one scene running on past the screen's edges
// rather than a board on a page. Pure: given the camera's view and the
// floor, where each clump goes.

import type { WorldRect } from './backdrop.ts';
import type { BattlefieldKind, ObstacleKind } from './battlefields.ts';

// The clumps each field frames itself with, drawn from its obstacle art.
export const FRAMING_FOLIAGE: Readonly<Record<BattlefieldKind, readonly ObstacleKind[]>> = Object.freeze({
  plains: ['bush', 'pine', 'thicket'],
  forest: ['pine', 'thicket', 'pine'],
  desert: ['cactus', 'boulder', 'cactus'],
});

export interface FramingClump {
  kind: ObstacleKind;
  // The clump's square art: its top-left corner and side, in world pixels.
  x: number;
  y: number;
  size: number;
  // Mirrored, so the two corners don't repeat each other.
  flip: boolean;
}

// How far a clump may reach over the floor, in world pixels: a sliver,
// out of focus, never enough to hide a unit standing on an edge cell.
export const FRAMING_OVERLAP = 12;

// Each corner's clumps, nearest the corner first: how big each is as a
// share of the view's height, and where its center sits across the view
// (as a share of that size in from the corner) and how far it sinks below
// the view's bottom edge (as a share of its size).
const CORNER = [
  { share: 0.42, across: 0.15, sink: 0.35 },
  { share: 0.3, across: 0.85, sink: 0.4 },
  { share: 0.22, across: 1.55, sink: 0.45 },
];

// The framing clumps for a battlefield `kind` seen through the camera's
// `view`, over a floor `floor` (its top-left at the world's origin): a few
// in each bottom corner, each pushed down or outward until it reaches over
// the floor by no more than FRAMING_OVERLAP, and dropped if none of it
// then shows past the floor. On a screen that shows little beyond the
// floor, few or none.
export function getFramingClumps(
  kind: BattlefieldKind,
  view: WorldRect,
  floor: { width: number; height: number },
): FramingClump[] {
  const kinds = FRAMING_FOLIAGE[kind];
  const clumps: FramingClump[] = [];
  for (const side of [-1, 1] as const) {
    CORNER.forEach(({ share, across, sink }, i) => {
      const size = Math.round(share * view.height);
      const corner = side < 0 ? view.x : view.x + view.width;
      let x = corner - side * across * size - size / 2;
      let y = view.y + view.height - (1 - sink) * size;
      // How far the clump would have to move down, or out past its side of
      // the floor, to clear it; it takes the shorter way.
      const down = Math.max(0, floor.height - FRAMING_OVERLAP - y);
      const out = side < 0 ? Math.max(0, x + size - FRAMING_OVERLAP) : Math.max(0, floor.width - FRAMING_OVERLAP - x);
      const overFloor = x < floor.width && x + size > 0 && y < floor.height;
      if (overFloor && down > 0 && out > 0) {
        if (down <= out) y += down;
        else x += side * out;
      }
      // Kept only where some of it shows past the floor: below its front
      // edge, or beside it.
      const bottom = Math.min(y + size, view.y + view.height);
      const left = Math.max(x, view.x);
      const right = Math.min(x + size, view.x + view.width);
      const below = bottom > Math.max(y, floor.height) && right > left;
      const beside = bottom > Math.max(y, view.y) && (Math.min(right, 0) > left || right > Math.max(left, floor.width));
      if (below || beside) clumps.push({ kind: kinds[i % kinds.length], x, y, size, flip: side > 0 !== (i % 2 === 1) });
    });
  }
  return clumps;
}
