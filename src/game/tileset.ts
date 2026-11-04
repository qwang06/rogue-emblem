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
import type { PixelArt } from './pixelShapes.ts';
import type { Team } from './turns.ts';
import type { UnitRank } from './Unit.ts';
import { FACTIONS, findFaction, PLAYER_FACTION, type FactionId } from './factions.ts';

// What a unit can be seen doing. Every unit art has `idle` and `move`;
// some (UNIT_ART) also have `attack`, `hit` and `die`.
export type UnitAnimation = 'idle' | 'move' | 'attack' | 'hit' | 'die';

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

// The seasons a map can be drawn in. Each has its own copy of the terrain
// sheet with the same layout (so every frame number below works on all of
// them): summer is the green overworld sheet; autumn (overworld-autumn.png)
// is it with its greens recolored (golden grass, rust meadows) and its
// forests bare, everything else left as it is; winter (overworld-winter.png) is the
// pack's snow sheet, snowy buildings included; underworld (overworld-underworld.png) is
// the summer sheet with dead ash ground, burnt bare woods, black rock and
// lava for water.
// starship (overworld-starship.png) is a habitable starship deck: steel
// plating, hydroponic beds and planters, coolant channels, viewports onto
// space for deep water, lit walkways, and machinery stacks for mountains.
export const SEASONS = ['summer', 'autumn', 'winter', 'underworld', 'starship'] as const;
export type Season = (typeof SEASONS)[number];
export const DEFAULT_SEASON: Season = 'summer';

// The terrain sheet a map in `season` draws its terrain, crossings,
// forests, mountains and buildings from. The cursor and the movement arrow
// always use TERRAIN_SHEET.
export const SEASON_TERRAIN_SHEETS: Readonly<Record<Season, typeof TERRAIN_SHEET>> = {
  summer: TERRAIN_SHEET,
  autumn: { ...TERRAIN_SHEET, key: 'overworld-autumn' },
  winter: { ...TERRAIN_SHEET, key: 'overworld-winter' },
  underworld: { ...TERRAIN_SHEET, key: 'overworld-underworld' },
  starship: { ...TERRAIN_SHEET, key: 'overworld-starship' },
};

// The decorative tree (TREE_SPRITES) a generated map in `season` scatters
// over its grass, or null for none: the ginkgos stand on a patch of green
// grass, which would show on snow, ash or a deck.
export const SEASON_TREES: Readonly<Record<Season, string | null>> = {
  summer: 'green_ginkgo',
  autumn: 'gold_ginkgo',
  winter: null,
  underworld: null,
  starship: null,
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
// and ford stepping stones (its spike trap is no longer drawn: see
// TRAP_ART). A 32px sheet like the terrain one.
export const MAP_PROPS_SHEET = { key: 'map-props', columns: 11 };

// The props sheet a map in each season draws its gateways and ford
// from: the starship's has its own sci-fi gateways (same layout, made by
// recolor-season.js); the rest share MAP_PROPS_SHEET.
export const SEASON_PROPS_SHEETS: Readonly<Record<Season, typeof MAP_PROPS_SHEET>> = {
  summer: MAP_PROPS_SHEET,
  autumn: MAP_PROPS_SHEET,
  winter: MAP_PROPS_SHEET,
  underworld: MAP_PROPS_SHEET,
  starship: { ...MAP_PROPS_SHEET, key: 'map-props-starship' },
};

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

// A trap's animation strip in src/assets/traps/ (16px art doubled, six
// frames left to right, see the tileset skill), loaded under `key` at its
// frame size: `rest` is the frame it sits at on the map, `trigger` the
// frames it plays once when it goes off.
export interface TrapArt {
  key: string;
  frameWidth: number;
  frameHeight: number;
  rest: number;
  trigger: readonly number[];
}

// The traps the game draws: a spike trap on each spikes cell
// (src/game/hazards.ts), which springs when a unit is shoved onto it, and
// the powder mine marking a mine the player's side laid, which blows up
// when a foe trips it. The mine's 64px frames center on its tile so the
// blast spills over. The bear trap, pitfall and fire vent strips in
// src/assets/traps/ aren't used yet.
export const TRAP_ART = {
  spikes: { key: 'trap-spikes', frameWidth: 32, frameHeight: 32, rest: 1, trigger: [2, 3, 4, 5, 1] },
  mine: { key: 'trap-powder-mine', frameWidth: 64, frameHeight: 64, rest: 0, trigger: [1, 2, 3, 4] },
} as const satisfies Record<string, TrapArt>;

// How long each trap frame shows as it goes off.
export const TRAP_FRAME_MS = 167;

// The spike trap's strip as a sheet for map sprites, and its resting frame
// on it, over the ground of a spikes cell.
export const SPIKES_SHEET = { key: TRAP_ART.spikes.key, columns: 6 };
export const SPIKES_ART: SheetTile = [TRAP_ART.spikes.rest, 0];

// The art body each faction class wears (factions.ts): a unit of the class
// wears its faction's version of the body, e.g. a Sunward archer
// 'Archer_02'. Each names a set of sheets, one per animation in
// UNIT_ANIMATIONS (see unitSheetKey).
export const FACTION_BODIES: Readonly<Record<string, string>> = Object.freeze({
  villager: 'Villager',
  archer: 'Archer',
  soldier: 'Soldier',
  vanguard: 'Vanguard',
  sapper: 'Sapper',
  scout: 'Scout',
  beast: 'Beast',
  // The whelp wears the Beast's art until it has some of its own.
  whelp: 'Beast',
  'beast-rider': 'BeastRider',
  siege: 'Siege',
  ram: 'Ram',
  acolyte: 'Acolyte',
  mage: 'Mage',
  bishop: 'Bishop',
});

// Unit art for the classes that look the same whatever side they're on:
// the neutral elementals (one version of the pack's Elemental per element)
// and the monsters.
export const UNIT_SPRITES: Readonly<Record<string, string>> = Object.freeze({
  'water-elemental': 'Elemental_01',
  'fire-elemental': 'Elemental_02',
  'air-elemental': 'Elemental_03',
  'earth-elemental': 'Elemental_04',
  slime: 'Slime',
  goblin: 'Goblin',
  skeleton: 'Skeleton',
  bat: 'Bat',
  orc: 'Orc',
  minotaur: 'Minotaur',
  troll: 'Troll',
  dragon: 'Red_Dragon',
});

// The art of a faction class's body for `faction`, e.g. ('Archer',
// 'sunward') -> 'Archer_02'.
export function factionArt(body: string, faction: FactionId): string {
  return `${body}_${findFaction(faction)!.variant}`;
}

// Art for a unit whose class has none of its own (or no class): the
// player's villager.
export const DEFAULT_UNIT_SPRITE = factionArt(FACTION_BODIES.villager, PLAYER_FACTION);

// The unit art for a unit of `unitClass` in `faction`: a faction class's
// body in that faction's version (the player's when `faction` is null or
// unset), the class's own art for the others, DEFAULT_UNIT_SPRITE for an
// unknown class.
export function getUnitSprite(unitClass: string | null | undefined, faction?: FactionId | null): string {
  if (unitClass == null) return DEFAULT_UNIT_SPRITE;
  const body = FACTION_BODIES[unitClass];
  if (body) return factionArt(body, faction ?? PLAYER_FACTION);
  return UNIT_SPRITES[unitClass] ?? DEFAULT_UNIT_SPRITE;
}

// Every unit art the game can show: each faction body in all six
// versions, then the faction-free art.
export function getAllUnitArts(): string[] {
  const bodies = [...new Set(Object.values(FACTION_BODIES))];
  return [
    ...bodies.flatMap((body) => FACTIONS.map((faction) => factionArt(body, faction.id))),
    ...Object.values(UNIT_SPRITES),
  ];
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
  // The dragon's breath shows the Fire spell's flame.
  'fire-breath': 'fire-spell',
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
  // The troll's maul shows the club until it has an icon of its own.
  'stone-maul': 'club',
  tackle: 'tackle',
  // The rest of the gear ladder (gearLadder.ts) shows its family's or
  // slot's icon until each piece has one of its own.
  ...Object.fromEntries(
    [
      [
        'wooden-sword',
        ['iron-sword', 'steel-sword', 'silver-sword', 'wooden-dagger', 'iron-dagger', 'steel-dagger', 'silver-dagger'],
      ],
      ['iron-spear', ['steel-spear', 'silver-spear']],
      ['iron-axe', ['steel-axe', 'silver-axe']],
      ['iron-bow', ['wooden-bow', 'steel-bow', 'silver-bow']],
      ['wooden-shield', ['iron-shield', 'steel-shield', 'silver-shield']],
      [
        'wooden-armor',
        [
          'iron-plate',
          'steel-plate',
          'silver-plate',
          'wooden-helm',
          'iron-helm',
          'steel-helm',
          'silver-helm',
          'hide-vest',
          'leather-armor',
          'studded-leather',
          'silverweave-coat',
          'hide-cap',
          'leather-hood',
          'studded-hood',
          'silverweave-hood',
          'linen-robe',
          'wool-robe',
          'silk-robe',
          'silver-robe',
          'linen-hat',
          'wool-hat',
          'silk-hat',
          'silver-circlet',
        ],
      ],
    ].flatMap(([icon, ids]) => (ids as string[]).map((id) => [id, icon as string])),
  ),
};

// The icon for an item id (a key of SPRITE_URLS), or null if it has none.
export function getItemSprite(itemId: string): string | null {
  return ITEM_SPRITES[itemId] ?? null;
}

// Every unit sheet is a grid of frames (one tile each for the pack's art,
// see getUnitSheet): one row per facing direction (`rows`, keyed by the
// facings in src/game/facing.ts), one column per animation frame. A unit
// plays its facing's row. Units start out facing `defaultFacing` (toward the camera), turn to
// face the way they step while walking, and keep facing their last step once
// they stop.
export const UNIT_SHEET: {
  rows: Record<Facing, number>;
  defaultFacing: Facing;
} = {
  rows: { down: 0, left: 1, right: 2, up: 3 },
  defaultFacing: 'down',
};

// Unit animations: `sheet` is the suffix of the sheet's texture key, each
// frame shows for frameMs, and `loop` says whether it repeats (else it
// plays once and holds its last frame). Units play `idle` standing still
// and `move` while walking; an art with an `attack` sheet plays it when it
// strikes, `hit` when it's struck and `die` when it falls (see UNIT_ART).
export const UNIT_ANIMATIONS: Record<UnitAnimation, { sheet: string; frameMs: number; loop: boolean; label: string }> =
  {
    idle: { sheet: 'Idle', frameMs: 200, loop: true, label: 'Idle' },
    move: { sheet: 'Move', frameMs: 120, loop: true, label: 'Move' },
    attack: { sheet: 'Attack', frameMs: 100, loop: false, label: 'Attack' },
    hit: { sheet: 'Hit', frameMs: 140, loop: false, label: 'Hit' },
    die: { sheet: 'Die', frameMs: 500, loop: false, label: 'Die' },
  };

// The texture key of a unit's sheet for an animation, e.g.
// ('Soldier_02', 'move') -> 'Soldier_02_Move'.
export function unitSheetKey(sprite: string, animation: UnitAnimation): string {
  return `${sprite}_${UNIT_ANIMATIONS[animation].sheet}`;
}

// How one unit sheet is cut: frames of frameWidth x frameHeight, `frames`
// per row (one row per facing, UNIT_SHEET.rows), and where the unit's tile
// sits in a frame (its top-left corner, tileX / tileY, in sheet pixels).
// A frame bigger than a tile (a dragon's spread wings or its breath) spills
// over the tiles around it.
export interface UnitSheetLayout {
  frameWidth: number;
  frameHeight: number;
  frames: number;
  tileX: number;
  tileY: number;
}

// Unit art cut differently from the pack's 4x4 sheets of 32px frames: its
// layout per animation (only the animations it has), `extras` (more
// sheets shown only in the animation viewer, by sheet suffix and label),
// `impactFrame` (the attack frame where the blow lands) and
// `bakedShadow` (the art draws its own shadow, so the map adds none) and
// `portraitTop` (for an idle frame taller than a tile, the empty pixel rows
// above the art: a one-tile portrait starts below them, at the head).
export interface UnitArt {
  sheets: Partial<Record<UnitAnimation, UnitSheetLayout>>;
  extras?: readonly { sheet: string; label: string; layout: UnitSheetLayout; animation: UnitAnimation }[];
  impactFrame?: number;
  bakedShadow?: boolean;
  portraitTop?: number;
}

// The pack's layout: 4 one-tile frames per facing.
export const PACK_SHEET_LAYOUT: UnitSheetLayout = Object.freeze({
  frameWidth: TILE_SIZE,
  frameHeight: TILE_SIZE,
  frames: 4,
  tileX: 0,
  tileY: 0,
});

// The red dragon (src/assets/units/Red_Dragon_*.png): true 32px art, one
// tile standing, wider in flight (48px frames, the wings past both sides)
// and much bigger breathing fire (112x96 frames, the flame reaching up to
// three tiles out in the facing's direction). Its shadow is in the art.
const RED_DRAGON_ATTACK: UnitSheetLayout = Object.freeze({
  frameWidth: 112,
  frameHeight: 96,
  frames: 6,
  tileX: 40,
  tileY: 32,
});
// The monsters (src/assets/units/{Slime,Goblin,Skeleton,Bat,Orc}_*.png):
// 16px art doubled, like the pack, standing on one tile (the orc a tile
// and a half tall, its frames 48px high with the tile at their foot),
// with a struck pose (2 frames), a fall (1 frame) and an attack in 96px
// frames (the orc's 112px high) with the tile in the middle. Each draws
// its own shadow. The attack's swipe is also a sheet of its own
// (AttackEffect, frame 0 empty), as is the body without it (AttackBody).
function monsterArt(height: number, impactFrame: number, portraitTop = 0): UnitArt {
  const tile = (frames: number): UnitSheetLayout =>
    Object.freeze({ frameWidth: TILE_SIZE, frameHeight: height, frames, tileX: 0, tileY: height - TILE_SIZE });
  const attack: UnitSheetLayout = Object.freeze({
    frameWidth: 3 * TILE_SIZE,
    frameHeight: 2 * TILE_SIZE + height,
    frames: 5,
    tileX: TILE_SIZE,
    tileY: TILE_SIZE,
  });
  return Object.freeze({
    sheets: Object.freeze({ idle: tile(4), move: tile(4), attack, hit: tile(2), die: tile(1) }),
    extras: Object.freeze([
      Object.freeze({ sheet: 'AttackBody', label: 'Attack (body only)', layout: attack, animation: 'attack' as const }),
      Object.freeze({
        sheet: 'AttackEffect',
        label: 'Attack (swipe only)',
        layout: attack,
        animation: 'attack' as const,
      }),
    ]),
    impactFrame,
    bakedShadow: true,
    portraitTop,
  });
}

// The big monsters (src/assets/units/{Minotaur,Troll}_*.png): 32px art
// standing on one tile, with a struck pose (2 frames), a fall (1 frame)
// and an attack in 112x96 frames with the tile in the middle of the
// bottom two thirds, the swing reaching a tile out on every side. Unlike
// the smaller monsters they bring no shadow, so the map adds one. The
// attack's swing is also a sheet of its own (AttackEffect, frame 0
// empty), as is the body without it (AttackBody).
function bigMonsterArt(impactFrame: number, effectLabel: string): UnitArt {
  const attack: UnitSheetLayout = Object.freeze({ frameWidth: 112, frameHeight: 96, frames: 6, tileX: 40, tileY: 32 });
  return Object.freeze({
    sheets: Object.freeze({
      idle: PACK_SHEET_LAYOUT,
      move: PACK_SHEET_LAYOUT,
      attack,
      hit: Object.freeze({ ...PACK_SHEET_LAYOUT, frames: 2 }),
      die: Object.freeze({ ...PACK_SHEET_LAYOUT, frames: 1 }),
    }),
    extras: Object.freeze([
      Object.freeze({ sheet: 'AttackBody', label: 'Attack (body only)', layout: attack, animation: 'attack' as const }),
      Object.freeze({ sheet: 'AttackEffect', label: effectLabel, layout: attack, animation: 'attack' as const }),
    ]),
    impactFrame,
  });
}

export const UNIT_ART: Readonly<Record<string, UnitArt>> = Object.freeze({
  Slime: monsterArt(TILE_SIZE, 2),
  Goblin: monsterArt(TILE_SIZE, 1),
  Skeleton: monsterArt(TILE_SIZE, 1),
  Bat: monsterArt(TILE_SIZE, 2),
  Orc: monsterArt(TILE_SIZE + TILE_SIZE / 2, 1, 10),
  Minotaur: bigMonsterArt(2, 'Attack (slash only)'),
  Troll: bigMonsterArt(2, 'Attack (smash only)'),
  Red_Dragon: Object.freeze({
    sheets: Object.freeze({
      idle: PACK_SHEET_LAYOUT,
      move: Object.freeze({ frameWidth: 48, frameHeight: 32, frames: 4, tileX: 8, tileY: 0 }),
      attack: RED_DRAGON_ATTACK,
      hit: Object.freeze({ ...PACK_SHEET_LAYOUT, frames: 2 }),
      die: Object.freeze({ ...PACK_SHEET_LAYOUT, frames: 1 }),
    }),
    extras: Object.freeze([
      Object.freeze({
        sheet: 'AttackBody',
        label: 'Attack (dragon only)',
        layout: RED_DRAGON_ATTACK,
        animation: 'attack' as const,
      }),
      Object.freeze({
        sheet: 'AttackFire',
        label: 'Attack (fire only)',
        layout: RED_DRAGON_ATTACK,
        animation: 'attack' as const,
      }),
    ]),
    impactFrame: 2,
    bakedShadow: true,
  }),
});

// One sheet of a unit art, ready to cut and play: its texture key, the
// animation it belongs to, a label, its layout and timing.
export interface UnitSheet extends UnitSheetLayout {
  key: string;
  animation: UnitAnimation;
  label: string;
  frameMs: number;
  loop: boolean;
}

function toUnitSheet(art: string, animation: UnitAnimation, layout: UnitSheetLayout): UnitSheet {
  const { frameMs, loop, label } = UNIT_ANIMATIONS[animation];
  return { ...layout, key: unitSheetKey(art, animation), animation, label, frameMs, loop };
}

// The animations a unit art has, in UNIT_ANIMATIONS order: idle and move
// for the pack's art, more for UNIT_ART's.
export function getUnitAnimations(art: string): UnitAnimation[] {
  const custom = UNIT_ART[art];
  const all = Object.keys(UNIT_ANIMATIONS) as UnitAnimation[];
  return custom ? all.filter((animation) => custom.sheets[animation]) : ['idle', 'move'];
}

// The sheet a unit art plays `animation` from, or null if it has none.
export function getUnitSheet(art: string, animation: UnitAnimation): UnitSheet | null {
  const custom = UNIT_ART[art];
  const layout = custom
    ? custom.sheets[animation]
    : animation === 'idle' || animation === 'move'
      ? PACK_SHEET_LAYOUT
      : undefined;
  return layout ? toUnitSheet(art, animation, layout) : null;
}

// Every sheet of a unit art, the viewer's extras included: what the
// animation viewer offers.
export function getAllUnitSheets(art: string): UnitSheet[] {
  const main = getUnitAnimations(art).map((animation) => getUnitSheet(art, animation)!);
  const extras = (UNIT_ART[art]?.extras ?? []).map(({ sheet, label, layout, animation }) => ({
    ...toUnitSheet(art, animation, layout),
    key: `${art}_${sheet}`,
    label,
  }));
  return [...main, ...extras];
}

// The frame size of every unit sheet cut differently from one tile, and
// of each trap strip (TRAP_ART), by texture key: how GridScene loads them.
export function getUnitSheetFrameSizes(): Record<string, { frameWidth: number; frameHeight: number }> {
  const sizes: Record<string, { frameWidth: number; frameHeight: number }> = {};
  for (const art of Object.keys(UNIT_ART)) {
    for (const { key, frameWidth, frameHeight } of getAllUnitSheets(art)) sizes[key] = { frameWidth, frameHeight };
  }
  for (const { key, frameWidth, frameHeight } of Object.values(TRAP_ART)) sizes[key] = { frameWidth, frameHeight };
  return sizes;
}

// Whether a unit art draws its own shadow (the map then adds none).
export function hasBakedShadow(art: string): boolean {
  return UNIT_ART[art]?.bakedShadow ?? false;
}

// The attack frame where a unit art's blow lands (the middle one by default).
export function getImpactFrame(art: string): number {
  const sheet = getUnitSheet(art, 'attack');
  return UNIT_ART[art]?.impactFrame ?? (sheet ? Math.floor(sheet.frames / 2) : 0);
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

// The outline drawn around every unit on the map in its team's color, so
// sides read at a glance without recoloring the sprite: `width` sheet
// pixels thick, hugging the art's silhouette within each frame.
export const UNIT_OUTLINE: { width: number; colors: Readonly<Record<Team, number>> } = {
  width: 1,
  colors: { player: 0x4a8cff, enemy: 0xff4a4a, guest: 0x4ad860 },
};

// The badge pinned to a boss's or an elite's tile on the map, and shown on
// its portrait in the HUD, so the standouts read at a glance without
// changing their sprites (boss and elite monsters look like any other of
// their class): a white skull on a red plate for the boss, a gold star on a
// violet plate for an elite. Each is drawn pixel by pixel (getPixelArtSpans)
// at 1 world pixel per art pixel, its top-left corner at (x, y) within the
// unit's tile, tucked into the top-right corner.
export const RANK_BADGES: Readonly<Record<UnitRank, PixelArt & { x: number; y: number }>> = {
  boss: {
    x: 21,
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
    x: 21,
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
// (x 12–19, y 28–29).
export const TREE_SHADOW: Shadow = {
  width: 20,
  height: 6,
  centerX: 16,
  centerY: 29,
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
