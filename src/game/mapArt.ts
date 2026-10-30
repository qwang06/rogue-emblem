// Picks the one-tile overlays drawn over the terrain: forests, mountains,
// buildings and crossings (bridges, fords, gates). Pure: given the grid (or building list) and the art tables
// from tileset.ts, it says which sheet tile goes on which cell and at which
// layer; GridScene only draws them.
//
// Layers, bottom to top:
//   'ground' — the cell's own art (a forest, a mountain, a building),
//              under units
//   'cap'    — art spilling into the cell north of its owner (a flag),
//              over that cell's ground art but under units
//   'roof'   — a tall building's top, over units, so a unit standing north
//              of a tower passes behind it

import type { Autotile, SheetTile } from './autotile.ts';
import type { BuildingPlacement } from './buildings.ts';
import { getCell, type Grid, type Point } from './grid.ts';
import type { BRIDGE_ART, BUILDING_ART, BuildingPalette, FeatureArt, GATE_ART, MAP_PROPS_SHEET } from './tileset.ts';

export type MapSpriteLayer = 'ground' | 'cap' | 'roof';

export interface MapSprite extends Point {
  tile: SheetTile;
  layer: MapSpriteLayer;
  // The sheet `tile` is on, when it isn't the terrain sheet.
  sheet?: { key: string; columns: number };
}

// A stable pseudo-random pick for cell (x, y) out of `count` variants, so
// a map draws the same every time without needing an Rng.
export function pickVariant(x: number, y: number, count: number): number {
  const hash = Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663);
  return (hash >>> 0) % count;
}

// Overlays for every forest and mountain cell: a variant of its art per
// cell, under units.
export function getFeatureSprites(grid: Grid, forestArt: FeatureArt, mountainArt: FeatureArt): MapSprite[] {
  const sprites: MapSprite[] = [];
  for (const { x, y, terrain } of grid.cells) {
    const art = terrain === 'forest' ? forestArt : terrain === 'mountain' ? mountainArt : null;
    if (!art) continue;
    const tile = art.tiles[pickVariant(x, y, art.tiles.length)];
    sprites.push({ x, y, tile, layer: 'ground', sheet: art.sheet });
  }
  return sprites;
}

// Overlays for each building, all in one palette: the building on its own
// cell, a tall building's top over the cell north of it, and — for palettes
// with flags — the flag over the cell north of the building's top. Pieces
// that would fall off the top of the map are left out.
export function getBuildingSprites(
  buildings: readonly BuildingPlacement[],
  palette: BuildingPalette,
  buildingArt: typeof BUILDING_ART,
): MapSprite[] {
  const sprites: MapSprite[] = [];
  for (const { x, y, building } of buildings) {
    const { column, row, tall } = buildingArt[building];
    const c = column + palette.buildingColumn;
    sprites.push({ x, y, tile: [c, row], layer: 'ground' });
    let top = y;
    if (tall) {
      top = y - 1;
      if (top >= 0) sprites.push({ x, y: top, tile: [c, row - 1], layer: 'roof' });
    }
    const flagRow = row - (tall ? 2 : 1);
    if (palette.flags && top - 1 >= 0) sprites.push({ x, y: top - 1, tile: [c, flagRow], layer: 'cap' });
  }
  return sprites;
}

// The rampart wall autotile in a palette's color (see autotile.ts): its
// notched 3x3 starts one column into the group, and the all-corners-notched
// tile is that 3x3's middle. Only 1-wide walls draw clean. The wall runs on
// through gates, whose own art covers it (see getCrossingSprites).
export function getWallAutotile(palette: BuildingPalette): Autotile {
  const [c, r] = palette.wall;
  return { block: [c + 1, r], inner: [c + 2, r + 1], joins: ['gate'] };
}

// A spike trap on each spikes cell (see hazards.ts), under units, off
// `propsSheet`.
export function getHazardSprites(grid: Grid, spikesTile: SheetTile, propsSheet: typeof MAP_PROPS_SHEET): MapSprite[] {
  return grid.cells
    .filter(({ terrain }) => terrain === 'spikes')
    .map(({ x, y }) => ({ x, y, tile: spikesTile, layer: 'ground' as const, sheet: propsSheet }));
}

// Overlays for crossings: a bridge on each bridge cell (running north–south
// when water or a ford lies west or east of it, else west–east, with an
// end on each bank cell it runs onto), stepping stones on
// each ford cell, and a gateway on each gate cell (its posts under units,
// its lintel over them, in the map's palette). Props come off `propsSheet`.
export function getCrossingSprites(
  grid: Grid,
  bridgeArt: typeof BRIDGE_ART,
  gateArt: (typeof GATE_ART)[keyof typeof GATE_ART],
  fordTile: SheetTile,
  propsSheet: typeof MAP_PROPS_SHEET,
): MapSprite[] {
  const sprites: MapSprite[] = [];
  const isWater = (x: number, y: number) => ['water', 'ford'].includes(getCell(grid, x, y)?.terrain ?? '');
  // A bank cell a bridge runs onto: on the map, and not water or bridge.
  const isBank = (x: number, y: number) => {
    const terrain = getCell(grid, x, y)?.terrain;
    return terrain !== undefined && terrain !== 'bridge' && !isWater(x, y);
  };
  for (const { x, y, terrain } of grid.cells) {
    if (terrain === 'bridge') {
      const vertical = isWater(x - 1, y) || isWater(x + 1, y);
      const sheet = bridgeArt.sheet;
      sprites.push({ x, y, tile: vertical ? bridgeArt.vertical : bridgeArt.horizontal, layer: 'ground', sheet });
      const ends = vertical
        ? ([
            ['north', 0, -1],
            ['south', 0, 1],
          ] as const)
        : ([
            ['west', -1, 0],
            ['east', 1, 0],
          ] as const);
      for (const [side, dx, dy] of ends) {
        if (isBank(x + dx, y + dy)) {
          sprites.push({ x: x + dx, y: y + dy, tile: bridgeArt.ends[side], layer: 'ground', sheet });
        }
      }
    } else if (terrain === 'ford') {
      sprites.push({ x, y, tile: fordTile, layer: 'ground', sheet: propsSheet });
    } else if (terrain === 'gate') {
      sprites.push({ x, y, tile: gateArt.posts, layer: 'ground', sheet: propsSheet });
      sprites.push({ x, y, tile: gateArt.lintel, layer: 'roof', sheet: propsSheet });
    }
  }
  return sprites;
}
