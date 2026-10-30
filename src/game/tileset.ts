// Art config: which image each piece of the map draws with.
//
// Terrain comes from the overworld sheet (src/assets/overworld.png, 32px
// tiles, 42 columns x 63 rows; see .claude/skills/tileset/overworld-catalog.md
// for what's where) and is picked by position on it. The tile cursor and the
// movement arrow are tiles of the same sheet. Units are standalone sprite
// sheets, one per animation, named here by texture key (src/assets/sprites.ts
// maps keys to files and gives each its frame size), cut into one-tile
// frames. Every image declares its own pixel size and is drawn one map tile
// (TILE_SIZE) big, so art of different sizes mixes on the map.

import type { Autotile, SheetTile } from './autotile.ts';
import type { BuildingKind } from './buildings.ts';
import type { Facing } from './facing.ts';
import type { ArrowPiece } from './moveArrow.ts';
import type { PixelArt } from './pixelShapes.ts';
import type { Team } from './turns.ts';
import type { UnitRank } from './Unit.ts';

export type UnitAnimation = 'idle' | 'move';

// A blob shadow drawn under something standing on a tile (see UNIT_SHADOW),
// sized and placed in fractions of a tile.
export interface Shadow {
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  alpha: number;
}

// Size of one map tile in world pixels. Art of any pixel size is scaled to
// it: each sheet says how big its frames are (TERRAIN_SHEET.tileSize, the
// `frame` of each entry in src/assets/sprites.ts).
export const TILE_SIZE = 64;

// World pixels per pixel of a 32px tile: the scale for sizes that were
// tuned on the old 32px grid (stroke widths, nudges, lunges), so they keep
// their size relative to a tile.
export const GRID_PX = TILE_SIZE / 32;

export const TERRAIN_SHEET = {
  key: 'overworld',
  columns: 42,
  rows: 63,
  // The sheet's tile size in its own pixels.
  tileSize: 32,
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
  // Water runs on under bridges and fords, which draw over it (see
  // getCrossingSprites in src/game/mapArt.ts).
  water: {
    block: [4, 8],
    inner: [2, 9],
    animation: { frames: 6, columnStride: 7, frameMs: 180 },
    joins: ['bridge', 'ford'],
  },
  // The sand-patch set, used as a dirt path. It has no plain 3x3, only the
  // notched one, so `block` is the notched 3x3: its outer corners and edges
  // are clean, but its middle has a notch in every corner, so a dirt patch
  // two or more tiles wide shows small grass holes where its 'full' quarters
  // meet. One-tile-wide paths only use the clean pieces. It runs on under a
  // gate, whose art leaves its floor's south edge open to it.
  dirt: {
    block: [1, 3],
    inner: [2, 4],
    joins: ['gate'],
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

// Bridges on the terrain sheet, over water: `vertical` runs north–south
// (rails on its west and east sides), `horizontal` west–east.
export const BRIDGE_ART: { vertical: SheetTile; horizontal: SheetTile } = {
  vertical: [11, 2],
  horizontal: [11, 1],
};

// Map props the terrain sheet doesn't have, drawn to match it by
// .claude/skills/tileset/scripts/draw-map-props.js: a gateway per palette
// ford stepping stones and a spike trap. A 32px sheet like the terrain one
// (its frame size is in src/assets/sprites.ts).
export const MAP_PROPS_SHEET = { key: 'map-props', columns: 11 };

// Each palette's gateway on MAP_PROPS_SHEET: `posts` (a short post either
// side of the opening, carrying on the wall's line) under units, `lintel`
// (the beam across the top) over them.
export const GATE_ART: Record<BuildingPaletteName, { posts: SheetTile; lintel: SheetTile }> = {
  'a-stone': { posts: [0, 0], lintel: [0, 1] },
  'a-orange': { posts: [1, 0], lintel: [1, 1] },
  'a-teal': { posts: [2, 0], lintel: [2, 1] },
  'a-pink': { posts: [3, 0], lintel: [3, 1] },
  'a-brown': { posts: [4, 0], lintel: [4, 1] },
  'b-white': { posts: [5, 0], lintel: [5, 1] },
  'b-red': { posts: [6, 0], lintel: [6, 1] },
  'b-blue': { posts: [7, 0], lintel: [7, 1] },
  'b-green': { posts: [8, 0], lintel: [8, 1] },
  'b-orange': { posts: [9, 0], lintel: [9, 1] },
};

// Ford stepping stones on MAP_PROPS_SHEET, over a ford's water.
export const FORD_ART: SheetTile = [10, 0];

// A spike trap on MAP_PROPS_SHEET, over the ground of a spikes cell
// (src/game/hazards.ts).
export const SPIKES_ART: SheetTile = [10, 1];

// Unit art keyed by unit class, so every unit of a class looks alike
// whichever side it's on. Each names a set of sheets, one per animation in
// UNIT_ANIMATIONS (see unitSheetKey).
export const UNIT_SPRITES: Record<string, string> = {
  warrior: 'Warrior_02',
  soldier: 'Soldier_03',
  archer: 'Amazon_01',
  vanguard: 'Vanguard_04',
  guard: 'Soldier_04',
  acolyte: 'Acolyte_02',
  // The promoted classes (promotions.ts) wear other variants of the pack's
  // units, close to their base class's look.
  hero: 'Vanguard_02',
  berserker: 'Vanguard_06',
  general: 'Soldier_05',
  halberdier: 'Soldier_02',
  sniper: 'Archer_03',
  arbalest: 'Siege_03',
  champion: 'Vanguard_03',
  bombardier: 'Sapper_04',
  bastion: 'Soldier_06',
  templar: 'Vanguard_01',
  bishop: 'Acolyte_01',
  sage: 'Acolyte_03',
  slime: 'Slime_01',
  goblin: 'Goblin_01',
  skeleton: 'Skeleton_01',
  bat: 'Bat_01',
  wolf: 'Wolf_01',
  orc: 'Orc_01',
};

// Art for a unit whose class has none of its own (or no class).
export const DEFAULT_UNIT_SPRITE = UNIT_SPRITES.warrior;

// The unit art for a unit class (a key of UNIT_SPRITES), falling back to
// DEFAULT_UNIT_SPRITE.
export function getUnitSprite(unitClass: string | null | undefined): string {
  return (unitClass != null ? UNIT_SPRITES[unitClass] : undefined) ?? DEFAULT_UNIT_SPRITE;
}

// Item icons keyed by item id (weapons.ts, items.ts): each is a one-tile
// image in src/assets/items/. Items without an entry have no icon yet.
export const ITEM_SPRITES: Record<string, string> = {
  'wooden-sword': 'wooden-sword',
  'wooden-spear': 'wooden-spear',
  'wooden-axe': 'wooden-axe',
  'wooden-shield': 'wooden-shield',
  'wooden-armor': 'wooden-armor',
  ballista: 'ballista',
  bite: 'bite',
  'bone-claws': 'bone-claws',
  club: 'club',
  fangs: 'fangs',
  fire: 'fire',
  'fire-spell': 'fire-spell',
  fists: 'fists',
  'great-axe': 'great-axe',
  'heal-staff': 'heal-staff',
  'health-potion': 'health-potion',
  'iron-axe': 'iron-axe',
  'iron-bow': 'iron-bow',
  'iron-spear': 'iron-spear',
  light: 'light',
  'mana-potion': 'mana-potion',
  'master-seal': 'master-seal',
  'powder-keg': 'powder-keg',
  tackle: 'tackle',
};

// The icon for an item id (a key of SPRITE_URLS), or null if it has none.
export function getItemSprite(itemId: string): string | null {
  return ITEM_SPRITES[itemId] ?? null;
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
// ('Warrior_02', 'move') -> 'Warrior_02_Move'.
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
// fractions of a tile, lined up with where the units' feet touch the ground.
export const UNIT_SHADOW: Shadow = {
  width: 16 / 32,
  height: 6 / 32,
  centerX: 16 / 32,
  centerY: 29 / 32,
  alpha: 0.35,
};

// The outline drawn around every unit on the map in its team's color, so
// sides read at a glance without recoloring the sprite: `width` (a
// fraction of a tile, see getOutlineWidth) thick, hugging the art's
// silhouette within each frame.
export const UNIT_OUTLINE: { width: number; colors: Readonly<Record<Team, number>> } = {
  width: 1 / 32,
  colors: { player: 0x4a8cff, enemy: 0xff4a4a, guest: 0x4ad860 },
};

// How many of a sheet's own pixels thick the unit outline is on a sheet with
// `frame`-pixel frames: UNIT_OUTLINE.width of a tile, at least one pixel.
export function getOutlineWidth(frame: number): number {
  return Math.max(1, Math.round(UNIT_OUTLINE.width * frame));
}

// The badge pinned to a boss's or an elite's tile on the map, and shown on
// its portrait in the HUD, so the standouts read at a glance without
// changing their sprites (boss and elite monsters look like any other of
// their class): a white skull on a red plate for the boss, a gold star on a
// violet plate for an elite. Each is drawn pixel by pixel (getPixelArtSpans)
// at GRID_PX world pixels per art pixel, its top-left corner at (x, y)
// within the unit's tile in fractions of a tile, tucked into the top-right
// corner.
export const RANK_BADGES: Readonly<Record<UnitRank, PixelArt & { x: number; y: number }>> = {
  boss: {
    x: 21 / 32,
    y: 0,
    palette: { O: 0x1a0d12, R: 0xc0283a, D: 0x8a1426, W: 0xf5ecd6, K: 0x2a1018 },
    rows: [
      '...OOOOO...',
      '..ORRRRRO..',
      '.ORRWWWRRO.',
      'ORRWWWWWRRO',
      'ORWKKWKKWRO',
      'ORWKKWKKWRO',
      'ORRWWKWWRRO',
      'ORDRWWWRDRO',
      '.ORDWKWDRO.',
      '..ORDDDRO..',
      '...OOOOO...',
    ],
  },
  elite: {
    x: 21 / 32,
    y: 0,
    palette: { O: 0x1a0d12, P: 0x3a2a5a, Y: 0xffd23a, L: 0xfff4a0 },
    rows: [
      '...OOOOO...',
      '..OPPYPPO..',
      '.OPPPYPPPO.',
      'OPPPLYYPPPO',
      'OYYYYYYYYYO',
      'OPYYYYYYYPO',
      'OPPYYYYYPPO',
      'OPPYYPYYPPO',
      '.OPYPPPYPO.',
      '..OPPPPPO..',
      '...OOOOO...',
    ],
  },
};

// The blob shadow drawn at the foot of every tree, in the same terms as
// UNIT_SHADOW: wider than the trunk and a bit under the canopy's spread, so
// the tree sits on the ground, centered on the foot of the ginkgos' trunk
// (x 12–19, y 28–29 of their 32px frame).
export const TREE_SHADOW: Shadow = {
  width: 20 / 32,
  height: 6 / 32,
  centerX: 16 / 32,
  centerY: 29 / 32,
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
