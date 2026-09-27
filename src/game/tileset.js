// Art config: which image each piece of the map draws with.
//
// Terrain comes from the overworld sheet (src/assets/overworld.png, 32x32
// tiles, 42 columns x 63 rows; see .claude/skills/tileset/overworld-catalog.md
// for what's where) and is picked by position on it. The tile cursor and the
// movement arrow are tiles of the same sheet. Units are standalone images, named here by texture key
// (src/assets/sprites.js maps keys to files); each is drawn stretched to
// fill one map tile.

// Size of one map tile in world pixels — the terrain sheet's tile size.
export const TILE_SIZE = 32;

export const TERRAIN_SHEET = {
  key: 'overworld',
  columns: 42,
  rows: 63,
};

// Plain grass fills every cell under the other terrain, as a [column, row]
// tile on the terrain sheet.
export const TERRAIN_BASE_TILE = [0, 0];

// Blob autotiles drawn over the grass, keyed by terrain (see
// src/game/autotile.js). `block` is the top-left tile of the terrain's plain
// 3x3 block (outer corners, edges, and the full middle); `inner` is the tile
// with an inside corner in each of its four corners. `animation` steps
// through `frames` copies of the set laid out `columnStride` tiles apart.
export const TERRAIN_AUTOTILES = {
  water: {
    block: [4, 8],
    inner: [2, 9],
    animation: { frames: 6, columnStride: 7, frameMs: 180 },
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

// The tile cursor: corner brackets that pulse between two tiles of the
// terrain sheet (brackets on the tile's corners, then 1px in), as [column,
// row], holding each for frameMs.
export const CURSOR_ANIMATION = {
  key: 'cursor',
  tiles: [
    [28, 62],
    [29, 62],
  ],
  frameMs: 400,
};

// Movement arrow pieces, keyed by the piece names from src/game/moveArrow.js,
// as [column, row] tiles on the terrain sheet. Straights and corners come
// from the pink rounded-square loop (a 3x3 of path tiles around a gem);
// the heads sit just below it.
export const ARROW_TILES = {
  'left-right': [30, 56],
  'up-down': [29, 57],
  'down-right': [29, 56],
  'down-left': [31, 56],
  'up-right': [29, 58],
  'up-left': [31, 58],
  'head-right': [29, 59],
  'head-down': [30, 59],
  'head-up': [29, 60],
  'head-left': [30, 60],
};
