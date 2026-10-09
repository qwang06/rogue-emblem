// Art config: which image each piece of the map draws with.
//
// Terrain comes from the overworld sheet (src/assets/overworld.png, 32x32
// tiles, 42 columns x 63 rows; see .claude/skills/tileset/overworld-catalog.md
// for what's where) and is picked by position on it. The tile cursor and the
// movement arrow are tiles of the same sheet. Units are standalone sprite
// sheets, one per animation, named here by texture key (src/assets/sprites.ts
// maps keys to files), cut into one-tile frames.

import type { Autotile, SheetTile } from './autotile.ts';
import type { BuildingKind } from './buildings.ts';
import type { Facing } from './facing.ts';
import type { ArrowPiece } from './moveArrow.ts';

export type UnitAnimation = 'idle' | 'move';

// A blob shadow drawn under something standing on a tile (see UNIT_SHADOW).
export interface Shadow {
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  alpha: number;
}

// Size of one map tile in world pixels — the terrain sheet's tile size.
export const TILE_SIZE = 32;

export const TERRAIN_SHEET = {
  key: 'overworld',
  columns: 42,
  rows: 63,
};

// Plain grass fills every cell under the other terrain, as a [column, row]
// tile on the terrain sheet.
export const TERRAIN_BASE_TILE: SheetTile = [0, 0];

// Blob autotiles drawn over the grass, keyed by terrain (see
// src/game/autotile.ts). `block` is the top-left tile of the terrain's plain
// 3x3 block (outer corners, edges, and the full middle); `inner` is the tile
// with an inside corner in each of its four corners. `animation` steps
// through `frames` copies of the set laid out `columnStride` tiles apart.
export const TERRAIN_AUTOTILES: Record<string, Autotile> = {
  water: {
    block: [4, 8],
    inner: [2, 9],
    animation: { frames: 6, columnStride: 7, frameMs: 180 },
  },
  // The sand-patch set, used as a dirt path. It has no plain 3x3, only the
  // notched one, so `block` is the notched 3x3: its outer corners and edges
  // are clean, but its middle has a notch in every corner, so a dirt patch
  // two or more tiles wide shows small grass holes where its 'full' quarters
  // meet. One-tile-wide paths only use the clean pieces.
  dirt: {
    block: [1, 3],
    inner: [2, 4],
  },
  // Dark grass: the one patch set with a plain 3x3, so it's clean at any
  // size. A meadow is walkable like grass.
  meadow: {
    block: [12, 3],
    inner: [10, 4],
  },
};

// One-tile overlays drawn over the grass on forest cells (see
// getFeatureSprites in src/game/mapArt.ts). `tiles` are the variants (dense
// pine, sparse pine, broadleaf); `peakBelow[i]` is `tiles[i]` with the
// mountain peak of the cell south of it baked into its bottom, for a forest
// just north of a mountain.
export const FOREST_ART: { tiles: SheetTile[]; peakBelow: SheetTile[] } = {
  tiles: [
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  peakBelow: [
    [8, 1],
    [9, 1],
    [10, 1],
  ],
};

// Mountain overlays, stacked a column at a time: a mountain cell draws a
// `body` variant, or a `peakBelow` one (the same body with the next
// mountain's peak in its bottom) when the cell south of it is a mountain
// too. The top mountain of a column pokes its peak into the cell north of it
// with a `cap`, drawn over that cell.
export const MOUNTAIN_ART: { body: SheetTile[]; peakBelow: SheetTile[]; cap: SheetTile[] } = {
  body: [
    [4, 1],
    [6, 1],
    [5, 2],
    [8, 2],
    [9, 2],
    [10, 2],
  ],
  peakBelow: [
    [5, 1],
    [7, 1],
  ],
  cap: [
    [4, 0],
    [5, 0],
  ],
};

// Where each building kind sits on the terrain sheet in its block's first
// color column: `column` is that column (0 or 12; a palette's
// `buildingColumn` is added to it) and `row` the row of the tile the
// building stands on. A `tall` building's top is the tile above that, over
// the cell north of it. A colored building's flag is the tile above its
// top, drawn over the next cell north.
export const BUILDING_ART: Record<BuildingKind, { column: number; row: number; tall?: boolean }> = {
  house: { column: 0, row: 50 },
  fort: { column: 0, row: 52 },
  temple: { column: 0, row: 54 },
  windmill: { column: 0, row: 58 },
  camp: { column: 0, row: 60 },
  workshop: { column: 0, row: 62 },
  farm: { column: 12, row: 50 },
  fountain: { column: 12, row: 52 },
  goldMine: { column: 12, row: 54 },
  mine: { column: 12, row: 56 },
  tower: { column: 12, row: 59, tall: true },
  castle: { column: 12, row: 62, tall: true },
};

// A building color: every building and wall on a map is drawn in one
// palette, so colors never mix. Set A ('a-…') is natural wood and stone with
// colored roofs and trim; set B ('b-…') tints the whole building.
// `buildingColumn` is the palette's offset from a building's first color
// column (set A 0–4, set B 6–10); `wall` is the top-left tile of its
// 6-column rampart group (set B's walls come in a different color order
// than its buildings). The neutral colors (a-stone, b-white) have no flags.
export interface BuildingPalette {
  buildingColumn: number;
  wall: SheetTile;
  flags: boolean;
}

export const BUILDING_PALETTES = {
  'a-stone': { buildingColumn: 0, wall: [0, 33], flags: false },
  'a-orange': { buildingColumn: 1, wall: [6, 33], flags: true },
  'a-teal': { buildingColumn: 2, wall: [12, 33], flags: true },
  'a-pink': { buildingColumn: 3, wall: [18, 33], flags: true },
  'a-brown': { buildingColumn: 4, wall: [24, 33], flags: true },
  'b-white': { buildingColumn: 6, wall: [0, 41], flags: false },
  'b-red': { buildingColumn: 7, wall: [18, 41], flags: true },
  'b-blue': { buildingColumn: 8, wall: [12, 41], flags: true },
  'b-green': { buildingColumn: 9, wall: [24, 41], flags: true },
  'b-orange': { buildingColumn: 10, wall: [6, 41], flags: true },
} as const satisfies Record<string, BuildingPalette>;

export type BuildingPaletteName = keyof typeof BUILDING_PALETTES;

// The palette for a level that doesn't pick one.
export const DEFAULT_BUILDING_PALETTE: BuildingPaletteName = 'a-stone';

// Unit art keyed by unit class, so every unit of a class looks alike
// whichever side it's on. Each names a set of sheets, one per animation in
// UNIT_ANIMATIONS (see unitSheetKey).
export const UNIT_SPRITES: Record<string, string> = {
  villager: 'Villager_01',
  soldier: 'Soldier_03',
  archer: 'Archer_02',
};

// Art for a unit whose class has none of its own (or no class).
export const DEFAULT_UNIT_SPRITE = UNIT_SPRITES.villager;

// The unit art for a unit class (a key of UNIT_SPRITES), falling back to
// DEFAULT_UNIT_SPRITE.
export function getUnitSprite(unitClass: string | null | undefined): string {
  return (unitClass != null ? UNIT_SPRITES[unitClass] : undefined) ?? DEFAULT_UNIT_SPRITE;
}

// Every unit sheet is a grid of one-tile frames, `columns` wide: one row per
// facing direction (`rows`, keyed by the facings in src/game/facing.ts), one
// column per animation frame. A unit loops its facing's row, `frames` columns
// long. Units start out facing `defaultFacing` (toward the camera), turn to
// face the way they step while walking, and keep facing their last step once
// they stop.
export const UNIT_SHEET: {
  columns: number;
  rows: Record<Facing, number>;
  defaultFacing: Facing;
  frames: number;
} = {
  columns: 4,
  rows: { down: 0, left: 1, right: 2, up: 3 },
  defaultFacing: 'down',
  frames: 4,
};

// Unit animations: `sheet` is the suffix of the sheet's texture key, and each
// frame shows for frameMs. Units play `idle` standing still and `move` while
// walking.
export const UNIT_ANIMATIONS: Record<UnitAnimation, { sheet: string; frameMs: number }> = {
  idle: { sheet: 'Idle', frameMs: 200 },
  move: { sheet: 'Move', frameMs: 120 },
};

// The texture key of a unit's sheet for an animation, e.g.
// ('Villager_01', 'move') -> 'Villager_01_Move'.
export function unitSheetKey(sprite: string, animation: UnitAnimation): string {
  return `${sprite}_${UNIT_ANIMATIONS[animation].sheet}`;
}

// Tree art, by tree name: the texture key of a one-tile tree standing on its
// own patch of grass, drawn over the grass terrain and below units. The
// green ginkgo is the gold one recolored (same shape, green leaves).
export const TREE_SPRITES: Record<string, string> = {
  gold_ginkgo: 'gold_ginkgo_tree',
  green_ginkgo: 'ginkgo_tree_green',
};

// Multi-tile structures, by name: the texture key of an image `width` x
// `height` tiles big, drawn tile by tile from the structure's top-left tile.
// Its top `roofRows` rows draw over units, so a unit standing under the
// gate's roof passes behind it; the rest draws under them, like trees.
// Which of its tiles block movement is up to the level's terrain.
export const STRUCTURE_SPRITES: Record<string, { key: string; width: number; height: number; roofRows: number }> = {
  gate: { key: 'gates', width: 3, height: 2, roofRows: 1 },
};

// The blob shadow drawn under every unit, since the unit sprites have none:
// a flat ellipse centered at (centerX, centerY) within the unit's tile, in
// tile pixels, lined up with where the units' feet touch the ground.
export const UNIT_SHADOW: Shadow = {
  width: 16,
  height: 6,
  centerX: 16,
  centerY: 29,
  alpha: 0.35,
};

// The blob shadow drawn at the foot of every tree, in the same terms as
// UNIT_SHADOW: wider than the trunk and a bit under the canopy's spread, so
// the tree sits on the ground, centered on where the gold ginkgo's trunk
// meets it (x 10–20, y 26–28).
export const TREE_SHADOW: Shadow = {
  width: 26,
  height: 8,
  centerX: 16,
  centerY: 27,
  alpha: 0.35,
};

// The tile cursor: corner brackets that pulse between two tiles of the
// terrain sheet (brackets on the tile's corners, then 1px in), as [column,
// row], holding each for frameMs.
export const CURSOR_ANIMATION: { key: string; tiles: SheetTile[]; frameMs: number } = {
  key: 'cursor',
  tiles: [
    [28, 62],
    [29, 62],
  ],
  frameMs: 400,
};

// Movement arrow pieces, keyed by the piece names from src/game/moveArrow.ts,
// as [column, row] tiles on the terrain sheet. Straights and corners come
// from the pink rounded-square loop (a 3x3 of path tiles around a gem);
// the heads sit just below it.
export const ARROW_TILES: Record<ArrowPiece, SheetTile> = {
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
