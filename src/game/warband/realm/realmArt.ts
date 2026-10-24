// What the realm map draws, as a flat list of sheet tiles in drawing
// order, the way GridScene draws a battle map: grass everywhere, each
// autotiled terrain over it (water at the given animation frame), then
// bridges, forests, mountains and buildings by layer. The overworld screen
// paints this list onto a canvas. Pure: art choices come from tileset.ts
// and mapArt.ts.

import { getQuarterFrames, getTileFrame } from '../../autotile.ts';
import { getBuildingSprites, getCrossingSprites, getFeatureSprites, type MapSpriteLayer } from '../../mapArt.ts';
import {
  BRIDGE_ART,
  BUILDING_ART,
  BUILDING_PALETTES,
  FORD_ART,
  FOREST_ART,
  GATE_ART,
  MAP_PROPS_SHEET,
  MOUNTAIN_ART,
  TERRAIN_AUTOTILES,
  TERRAIN_BASE_TILE,
  TERRAIN_SHEET,
  TILE_SIZE,
} from '../../tileset.ts';
import type { Realm } from './realm.ts';

export interface RealmDraw {
  // The image key: TERRAIN_SHEET.key or MAP_PROPS_SHEET.key.
  sheet: string;
  // The frame on that sheet cut into `size`-pixel tiles, in reading order.
  frame: number;
  size: number;
  // Where it goes on the map, in pixels.
  x: number;
  y: number;
}

const LAYER_ORDER: Readonly<Record<MapSpriteLayer, number>> = { ground: 0, cap: 1, roof: 2 };

// How many frames the water animates through.
export const REALM_WATER_FRAMES = TERRAIN_AUTOTILES.water.animation?.frames ?? 1;

// Everything to draw for `realm` with the water at `animationFrame`.
export function getRealmDrawList(realm: Realm, animationFrame = 0): RealmDraw[] {
  const { grid } = realm;
  const columns = TERRAIN_SHEET.columns;
  const half = TILE_SIZE / 2;
  const draws: RealmDraw[] = [];
  const base = getTileFrame(TERRAIN_BASE_TILE, columns);
  for (const cell of grid.cells) {
    draws.push({
      sheet: TERRAIN_SHEET.key,
      frame: base,
      size: TILE_SIZE,
      x: cell.x * TILE_SIZE,
      y: cell.y * TILE_SIZE,
    });
  }
  for (const [terrain, autotile] of Object.entries(TERRAIN_AUTOTILES)) {
    const frame = autotile.animation ? animationFrame % autotile.animation.frames : 0;
    for (const cell of grid.cells) {
      getQuarterFrames(grid, cell.x, cell.y, terrain, autotile, columns, frame)?.forEach((quarter, q) =>
        draws.push({
          sheet: TERRAIN_SHEET.key,
          frame: quarter,
          size: half,
          x: cell.x * TILE_SIZE + (q & 1) * half,
          y: cell.y * TILE_SIZE + (q >> 1) * half,
        }),
      );
    }
  }
  const palette = BUILDING_PALETTES[realm.palette];
  const sprites = [
    ...getCrossingSprites(grid, BRIDGE_ART, GATE_ART[realm.palette], FORD_ART, MAP_PROPS_SHEET),
    ...getFeatureSprites(grid, FOREST_ART, MOUNTAIN_ART),
    ...getBuildingSprites(realm.buildings, palette, BUILDING_ART),
  ].sort((a, b) => LAYER_ORDER[a.layer] - LAYER_ORDER[b.layer]);
  for (const { x, y, tile, sheet } of sprites) {
    draws.push({
      sheet: sheet?.key ?? TERRAIN_SHEET.key,
      frame: getTileFrame(tile, sheet?.columns ?? columns),
      size: TILE_SIZE,
      x: x * TILE_SIZE,
      y: y * TILE_SIZE,
    });
  }
  return draws;
}
