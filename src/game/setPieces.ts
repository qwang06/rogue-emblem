// Set pieces: small hand-made bits of map (a bandit camp, a ruined chapel,
// a watchtower) that the generator drops into a procedural map, the way
// roguelikes mix authored rooms and vaults into generated levels. Each is
// drawn as text rows, north to south, and has a role saying where on the
// map it belongs (see SET_PIECE_ZONES in mapZones.ts). The pieces are data
// (src/data/setPieces.json); this module parses them and finds where one
// fits. Pure.
//
// The legend: the terrain legend (terrainMap.ts: `.` grass, `~` water,
// `^` mountain, `T` forest, `"` meadow, `#` wall, `+` gate, `=` bridge,
// `_` ford), plus `?` for whatever the map already has there, and a
// letter per building (BUILDING_LETTERS), which stands on grass. Spike
// traps aren't in it: those are laid near the enemies (hazards.ts).

import type { BuildingKind, BuildingPlacement } from './buildings.ts';
import type { Rng } from './combatStats.ts';
import { getCell, type Grid, type Point } from './grid.ts';
import { getMoveCost } from './movement.ts';
import { DEFAULT_TERRAIN_LEGEND } from './terrainMap.ts';
import { BUILDING_ART, type Season } from './tileset.ts';

export type SetPieceRole = 'cover' | 'flank' | 'outpost' | 'homestead';

export const SET_PIECE_ROLES: readonly SetPieceRole[] = Object.freeze(['cover', 'flank', 'outpost', 'homestead']);

export interface SetPiece {
  name: string;
  role: SetPieceRole;
  // North to south, all the same length.
  rows: readonly string[];
  // The seasons it shows up in; every season when unset.
  seasons?: readonly Season[];
}

// A piece's letter for each building.
export const BUILDING_LETTERS: Readonly<Record<string, BuildingKind>> = Object.freeze({
  h: 'house',
  f: 'fort',
  t: 'temple',
  w: 'windmill',
  c: 'camp',
  k: 'workshop',
  r: 'farm',
  o: 'fountain',
  g: 'goldMine',
  m: 'mine',
  p: 'tower',
});

export const SET_PIECE_LEGEND = DEFAULT_TERRAIN_LEGEND;

// What a piece puts on one tile: terrain, or a building on grass.
export interface PieceTile extends Point {
  terrain: string;
  building?: BuildingKind;
}

// A piece's tiles relative to its top-left corner, `?` left out.
export function getPieceTiles(piece: SetPiece): PieceTile[] {
  return piece.rows.flatMap((row, y) =>
    [...row].flatMap((char, x): PieceTile[] => {
      if (char === '?') return [];
      const building = BUILDING_LETTERS[char];
      if (building) return [{ x, y, terrain: 'grass', building }];
      return [{ x, y, terrain: SET_PIECE_LEGEND[char] ?? 'grass' }];
    }),
  );
}

// `piece` mirrored west to east.
export function mirrorPiece(piece: SetPiece): SetPiece {
  return { ...piece, rows: piece.rows.map((row) => [...row].reverse().join('')) };
}

// How many rows north of its tile a building's art reaches: a flag, and
// a tall building's top under it.
export function getArtRows(building: BuildingKind): number {
  return BUILDING_ART[building].tall ? 2 : 1;
}

// Throws, naming the piece and what's wrong, unless `piece` has a name, a
// known role, rows of one length with only legend characters, at least
// one tile, and every building with open ground (grass, meadow or `?`)
// north of it in the piece where its art goes (getArtRows).
export function checkSetPiece(piece: SetPiece): void {
  const at = `Set piece "${piece.name}"`;
  if (!piece.name) throw new Error('A set piece needs a name');
  if (!SET_PIECE_ROLES.includes(piece.role)) throw new Error(`${at} has an unknown role "${piece.role}"`);
  if (piece.rows.length === 0 || piece.rows[0].length === 0) throw new Error(`${at} has no rows`);
  const width = piece.rows[0].length;
  piece.rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`${at}: row ${y} is ${row.length} wide, expected ${width}`);
    for (const char of row) {
      if (char !== '?' && !SET_PIECE_LEGEND[char] && !BUILDING_LETTERS[char]) {
        throw new Error(`${at}: row ${y} has "${char}", which isn't in the legend`);
      }
    }
  });
  if (getPieceTiles(piece).length === 0) throw new Error(`${at} only has "?" tiles`);
  piece.rows.forEach((row, y) =>
    [...row].forEach((char, x) => {
      const building = BUILDING_LETTERS[char];
      if (!building) return;
      for (let dy = 1; dy <= getArtRows(building); dy++) {
        const north = y - dy >= 0 ? piece.rows[y - dy][x] : '?';
        if (!['.', '"', '?'].includes(north)) {
          throw new Error(`${at}: the building at (${x}, ${y}) needs open ground north of it`);
        }
      }
    }),
  );
}

// The pieces of `pieces` that show up in `season`.
export function getSeasonPieces(pieces: readonly SetPiece[], season: Season): SetPiece[] {
  return pieces.filter((piece) => !piece.seasons || piece.seasons.includes(season));
}

// How many set pieces a map of `width` x `height` gets: one per
// TILES_PER_SET_PIECE tiles, rounded, at least one.
export const TILES_PER_SET_PIECE = 45;
export function getSetPieceCount(width: number, height: number): number {
  return Math.max(1, Math.round((width * height) / TILES_PER_SET_PIECE));
}

const key = ({ x, y }: Point) => `${x},${y}`;

// What a piece must stay out of where it lands, as tile keys: `blocked`
// for every tile it changes, `nearRoutes` for its impassable ones (so
// every route stays open), and `covered` for its buildings' flags.
export interface PieceLimits {
  blocked: ReadonlySet<string>;
  nearRoutes: ReadonlySet<string>;
  covered: ReadonlySet<string>;
}

// Whether `piece` can go with its top-left corner at `origin` on `grid`:
// every tile it changes is on the map, grass now (or road, under open
// ground other than a building), and not blocked; none of
// its impassable tiles is near a route; no wall on the map's west or east
// column (the wall autotile draws those thick); and the rows each
// building's art reaches north (getArtRows) are on the map and under no
// other building's art.
export function canPlacePiece(grid: Grid, piece: SetPiece, origin: Point, limits: PieceLimits): boolean {
  return getPieceTiles(piece).every(({ x, y, terrain, building }) => {
    const p = { x: origin.x + x, y: origin.y + y };
    const cell = getCell(grid, p.x, p.y);
    if (!cell || cell.unitId || limits.blocked.has(key(p))) return false;
    const passable = Number.isFinite(getMoveCost(terrain));
    // The road runs on under the piece's open ground (see stampPiece).
    const onRoad = cell.terrain === 'dirt' && passable && !building;
    if (cell.terrain !== 'grass' && !onRoad) return false;
    if (!passable && limits.nearRoutes.has(key(p))) return false;
    if (terrain === 'wall' && (p.x === 0 || p.x === grid.width - 1)) return false;
    if (!building) return true;
    const rows = getArtRows(building);
    if (p.y < rows) return false;
    for (let dy = 1; dy <= rows; dy++) if (limits.covered.has(key({ x: p.x, y: p.y - dy }))) return false;
    return true;
  });
}

// Every top-left corner `piece` fits at on `grid` (see canPlacePiece),
// west to east, north to south.
export function getPieceOrigins(grid: Grid, piece: SetPiece, limits: PieceLimits): Point[] {
  const origins: Point[] = [];
  for (let y = 0; y + piece.rows.length <= grid.height; y++) {
    for (let x = 0; x + piece.rows[0].length <= grid.width; x++) {
      if (canPlacePiece(grid, piece, { x, y }, limits)) origins.push({ x, y });
    }
  }
  return origins;
}

// The middle tile of `piece` at `origin`, which zones are judged by.
export function getPieceCenter(piece: SetPiece, origin: Point): Point {
  return {
    x: origin.x + Math.floor((piece.rows[0].length - 1) / 2),
    y: origin.y + Math.floor((piece.rows.length - 1) / 2),
  };
}

// `piece` placed on `grid` with its top-left corner at `origin`: the
// terrain to lay (each tile on the map; none where the road already runs,
// so it carries on through) and the buildings to stand up.
export function stampPiece(
  grid: Grid,
  piece: SetPiece,
  origin: Point,
): { tiles: PieceTile[]; buildings: BuildingPlacement[] } {
  const tiles = getPieceTiles(piece)
    .map((tile) => ({ ...tile, x: origin.x + tile.x, y: origin.y + tile.y }))
    .filter(({ x, y }) => getCell(grid, x, y)?.terrain !== 'dirt');
  const buildings = tiles.flatMap(({ x, y, building }) => (building ? [{ x, y, building }] : []));
  return { tiles, buildings };
}

// The tiles a piece covers (its `?` tiles included).
export function getPieceArea(piece: SetPiece): number {
  return piece.rows.length * piece.rows[0].length;
}

// Up to `count` different pieces of `pieces`, picked at random, each
// mirrored half the time, biggest first (so the hardest to fit gets first
// pick of the map).
export function drawSetPieces(pieces: readonly SetPiece[], count: number, rng: Rng): SetPiece[] {
  const pool = [...pieces];
  const drawn: SetPiece[] = [];
  while (drawn.length < count && pool.length > 0) {
    const [piece] = pool.splice(Math.floor(rng() * pool.length), 1);
    drawn.push(rng() < 0.5 ? mirrorPiece(piece) : piece);
  }
  return drawn.sort((a, b) => getPieceArea(b) - getPieceArea(a));
}
