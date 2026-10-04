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
// Its top lines up with the tile's, moved up or down to stay on the stage.
// Returns { side: 'right' | 'left', left, top }.
export function placeMenuBesideTile(tile: TileAnchorView, menu: Size, stage: Size, gap = 8): MenuPlacement {
  const rightLeft = tile.right + gap;
  const side: MenuPlacement['side'] = rightLeft + menu.width + gap <= stage.width ? 'right' : 'left';
  const left = side === 'right' ? rightLeft : Math.max(gap, tile.left - gap - menu.width);
  const top = clamp(tile.top, gap, stage.height - gap - menu.height);
  return { side, left, top };
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
