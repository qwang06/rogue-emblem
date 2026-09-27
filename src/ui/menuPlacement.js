// Pure layout for menus opened beside a map tile (a unit's action, skill
// and item menus). All sizes are in pixels of the HUD overlay.

// Where to put a menu of size `menu` ({ width, height }) next to the tile
// rect `tile` ({ left, top, right, bottom }) inside a stage of size `stage`
// ({ width, height }). It opens to the tile's right when it fits there
// (keeping `gap` from the tile and the stage edge), otherwise to its left.
// Its top lines up with the tile's, moved up or down to stay on the stage.
// Returns { side: 'right' | 'left', left, top }.
export function placeMenuBesideTile(tile, menu, stage, gap = 8) {
  const rightLeft = tile.right + gap;
  const side = rightLeft + menu.width + gap <= stage.width ? 'right' : 'left';
  const left = side === 'right' ? rightLeft : Math.max(gap, tile.left - gap - menu.width);
  const top = clamp(tile.top, gap, stage.height - gap - menu.height);
  return { side, left, top };
}

// Clamps value to [min, max], preferring min when the range is empty (the
// menu is taller than the stage), so the menu's top stays visible.
function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}
