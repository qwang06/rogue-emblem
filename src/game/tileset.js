// Art config: which image each piece of the map draws with.
//
// Terrain comes from the grass/water dual-grid tileset
// (src/assets/tileset-grass-water.png, 32x32 tiles, 4x4) and is picked by
// frame number. Units, the cursor, and the movement arrow are standalone
// images, named here by texture key (src/assets/sprites.js maps keys to
// files); each is drawn stretched to fill one map tile.

// Size of one map tile in world pixels — the terrain tileset's tile size.
export const TILE_SIZE = 32;

export const TERRAIN_TILESET_KEY = 'grass-water';

// Dual-grid frames, keyed by terrain then by the corner piece names from
// src/game/terrainTiles.js (which of the tile's four corners hold that
// terrain). Water's set draws a shoreline wherever water and grass corners
// meet; 'none' is plain grass.
export const TERRAIN_CORNER_FRAMES = {
  water: {
    none: 12,
    'top-left': 15,
    'top-right': 8,
    'bottom-left': 0,
    'bottom-right': 13,
    'top-left+top-right': 9,
    'bottom-left+bottom-right': 3,
    'top-left+bottom-left': 11,
    'top-right+bottom-right': 1,
    'top-left+bottom-right': 4,
    'top-right+bottom-left': 14,
    'top-left+top-right+bottom-left': 7,
    'top-left+top-right+bottom-right': 10,
    'top-left+bottom-left+bottom-right': 2,
    'top-right+bottom-left+bottom-right': 5,
    all: 6,
  },
};

// Unit sprites keyed by team, so every unit on a side looks alike.
export const UNIT_SPRITES = {
  player: 'warrior-1',
  enemy: 'warrior-2',
};

// The blob shadow drawn under every unit, since the unit sprites have none:
// a flat ellipse centered at (centerX, centerY) within the unit's tile, in
// tile pixels, lined up with where the warriors' feet touch the ground.
export const UNIT_SHADOW = {
  width: 20,
  height: 6,
  centerX: 16,
  centerY: 29,
  alpha: 0.35,
};

export const UI_SPRITES = {
  cursor: 'cursor',
};

// Movement arrow pieces, keyed by the piece names from src/game/moveArrow.js.
export const ARROW_SPRITES = {
  'head-up': 'path-head-up',
  'head-left': 'path-head-left',
  'head-right': 'path-head-right',
  'head-down': 'path-head-down',
  'left-right': 'path-left-right',
  'up-down': 'path-up-down',
  'down-right': 'path-down-right',
  'down-left': 'path-down-left',
  'up-right': 'path-up-right',
  'up-left': 'path-up-left',
};
