// Pure layout for menus opened beside a map tile (a unit's action, skill
// and item menus). All sizes are in pixels of the HUD overlay.

import type { Size, TileAnchorView } from '../bridge/views.ts';

export interface MenuPlacement {
  side: 'right' | 'left';
  left: number;
  top: number;
}

// Where to put a menu of size `menu` ({ width, height }) next to the tile
// rect `tile` ({ left, top, right, bottom }) inside a stage of size `stage`
// ({ width, height }). It opens to the tile's right when it fits there
// (keeping `gap` from the tile and the stage edge), otherwise to its left.
// Its top lines up with the tile's, moved up or down to stay on the stage,
// and at least `topInset` further down from the stage's top for anything
// hanging off the menu's top edge (its Back tab).
//
// `avoid` is another window's rect on the stage (the unit panel) the menu
// must not cover. When the usual spot would, the menu tries the tile's
// other side, then slides below or above that window on either side, and
// only lands on it when there's no room anywhere else.
// Returns { side: 'right' | 'left', left, top }.
export function placeMenuBesideTile(
  tile: TileAnchorView,
  menu: Size,
  stage: Size,
  gap = 8,
  topInset = 0,
  avoid: TileAnchorView | null = null,
): MenuPlacement {
  const rightLeft = tile.right + gap;
  const rightFits = rightLeft + menu.width + gap <= stage.width;
  const leftLeft = tile.left - gap - menu.width;
  const leftFits = leftLeft >= gap;
  const minTop = gap + topInset;
  const maxTop = stage.height - gap - menu.height;
  const at = (side: MenuPlacement['side'], top = tile.top): MenuPlacement => ({
    side,
    left: side === 'right' ? rightLeft : Math.max(gap, leftLeft),
    top: clamp(top, minTop, maxTop),
  });
  const usual = at(rightFits ? 'right' : 'left');
  if (!avoid || !overlaps(usual, menu, avoid)) return usual;

  const sides: MenuPlacement['side'][] = usual.side === 'right' ? ['right', 'left'] : ['left', 'right'];
  const open = sides.filter((side) => (side === 'right' ? rightFits : leftFits));
  const candidates = [
    ...open.map((side) => at(side)),
    ...open.flatMap((side) => [at(side, avoid.bottom + gap), at(side, avoid.top - gap - menu.height)]),
  ];
  return candidates.find((spot) => !overlaps(spot, menu, avoid)) ?? usual;
}

// Whether a menu of size `menu` at `spot` covers any of `rect`.
function overlaps(spot: { left: number; top: number }, menu: Size, rect: TileAnchorView): boolean {
  return (
    spot.left < rect.right &&
    spot.left + menu.width > rect.left &&
    spot.top < rect.bottom &&
    spot.top + menu.height > rect.top
  );
}

// Clamps value to [min, max], preferring min when the range is empty (the
// menu is taller than the stage), so the menu's top stays visible.
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

// Which top corner of the map a docked panel (the unit panel) goes in so it
// stays clear of `tile`, a TileAnchorView in canvas fractions: the left
// corner, unless the tile's center is in the left half of the map, then the
// right one. With no tile it stays left.
export function pickCornerAwayFromTile(tile: TileAnchorView | null): 'left' | 'right' {
  if (!tile) return 'left';
  return (tile.left + tile.right) / 2 < 0.5 ? 'right' : 'left';
}
