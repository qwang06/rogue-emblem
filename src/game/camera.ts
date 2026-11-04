// Pure camera rules for the map view. The map is always drawn at one zoom
// (the game never shrinks to fit a small window); when it's bigger than
// the canvas the camera scrolls to keep the cursor in view.

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

// A box in world pixels, e.g. the tile under the cursor.
export interface Box extends Point {
  width: number;
  height: number;
}

// Where along one axis a view `view` long starts on a world `world` long,
// to keep the span [from, from + length] at least `margin` inside it,
// moving as little as it can from `start`: centered when the whole world
// fits, never past either end of the world otherwise. A margin too big for
// the view shrinks to what fits.
function followAxis(start: number, from: number, length: number, view: number, world: number, margin: number): number {
  if (world <= view) return (world - view) / 2;
  const room = Math.max(0, Math.min(margin, (view - length) / 2));
  const earliest = from + length + room - view;
  const latest = from - room;
  const kept = Math.min(Math.max(start, earliest), latest);
  return Math.min(Math.max(kept, 0), world - view);
}

// The top-left corner, in world pixels, of a `view`-sized view of a
// `world`-sized map that keeps `focus` at least `margin` pixels inside it,
// moving as little as it can from `start` (the view's current corner). On
// an axis where the whole map fits, the map is centered (the corner goes
// negative); otherwise the view never runs past the map's edges.
export function getFollowView(start: Point, focus: Box, view: Size, world: Size, margin: number): Point {
  return {
    x: followAxis(start.x, focus.x, focus.width, view.width, world.width, margin),
    y: followAxis(start.y, focus.y, focus.height, view.height, world.height, margin),
  };
}
