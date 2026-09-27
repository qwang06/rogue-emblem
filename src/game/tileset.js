// Config for the Kenney "Tiny Battle" tileset (src/assets/kenney_tiny-battle).
// Frame indices are placeholders picked from the sheet for the initial grid —
// swap them out as real terrain/unit art is chosen.

export const TILE_SIZE = 16;
export const TILESET_KEY = 'tiny-battle';
export const TILESET_COLUMNS = 18;
export const TILESET_ROWS = 11;

export const TERRAIN_FRAMES = {
  grass: 0,
  water: 37,
};

// Edge sets, keyed by terrain then by the piece names from
// src/game/terrainTiles.js. Water's 9-tile set (frames 18-20, 36-38, 54-56)
// draws a grass shoreline on the sides that border other terrain, and its
// inner corners (90-93) a bit of grass in one corner.
export const TERRAIN_EDGE_FRAMES = {
  water: {
    'inner-top-left': 90,
    'inner-top-right': 91,
    'inner-bottom-right': 92,
    'inner-bottom-left': 93,
    'top-left': 18,
    top: 19,
    'top-right': 20,
    left: 36,
    center: 37,
    right: 38,
    'bottom-left': 54,
    bottom: 55,
    'bottom-right': 56,
  },
};

// Unit sprites keyed by team, so every unit on a side shares its faction color.
export const UNIT_FRAMES = {
  player: 124, // green soldier sprite
  enemy: 160, // red soldier sprite
};

export const UI_FRAMES = {
  cursor: 61,
};

// Movement arrow pieces, keyed by the piece names from src/game/moveArrow.js.
export const ARROW_FRAMES = {
  'head-up': 40,
  'head-left': 41,
  'head-right': 43,
  'head-down': 76,
  'left-right': 42,
  'up-down': 58,
  'down-right': 59,
  'down-left': 60,
  'up-right': 77,
  'up-left': 78,
};

// Column/row of a frame in the sheet, so non-Phaser code (e.g. the React UI
// cropping a sprite out of the sheet image) can locate it.
export function getFramePosition(frame, columns = TILESET_COLUMNS) {
  return { col: frame % columns, row: Math.floor(frame / columns) };
}
