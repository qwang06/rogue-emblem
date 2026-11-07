// What the HUD says about a tile's terrain: its name and what entering it
// costs (the terrain card in the battle dock). Pure: no Phaser, no state.

import type { SheetTile } from './autotile.ts';
import type { Terrain } from './grid.ts';
import { getMoveCost, TERRAIN_MOVE_COSTS, type TerrainCosts } from './movement.ts';
import { BRIDGE_ART, FORD_ART, FOREST_ART, MOUNTAIN_ART, TERRAIN_AUTOTILES, TERRAIN_BASE_TILE } from './tileset.ts';

export interface TerrainInfo {
  // The terrain's display name ("Forest"); unknown ids are capitalized.
  label: string;
  // Movement points to enter it, or null when nothing can (Infinity).
  moveCost: number | null;
}

// Display names for the terrains the maps use (see TERRAIN_MOVE_COSTS).
export const TERRAIN_LABELS: Readonly<Record<string, string>> = Object.freeze({
  grass: 'Plains',
  dirt: 'Road',
  water: 'Water',
  wall: 'Wall',
  forest: 'Forest',
  mountain: 'Mountain',
  meadow: 'Meadow',
  bridge: 'Bridge',
  ford: 'Ford',
  gate: 'Gate',
  spikes: 'Spike Trap',
});

export function getTerrainLabel(terrain: Terrain): string {
  if (terrain === null) return 'Plains';
  return TERRAIN_LABELS[terrain] ?? terrain.charAt(0).toUpperCase() + terrain.slice(1).replace(/[-_]/g, ' ');
}

export function describeTerrain(terrain: Terrain, costs: TerrainCosts = TERRAIN_MOVE_COSTS): TerrainInfo {
  const cost = getMoveCost(terrain, costs);
  return Object.freeze({ label: getTerrainLabel(terrain), moveCost: Number.isFinite(cost) ? cost : null });
}

// The middle tile of a terrain's plain 3x3 block: what a patch of it looks
// like away from its edges.
function blockMiddle(terrain: string): SheetTile {
  const [column, row] = TERRAIN_AUTOTILES[terrain]!.block;
  return [column + 1, row + 1];
}

// The tiles of the terrain sheet that stand for a terrain, bottom layer
// first, for an icon of it (the terrain card): grass under everything, a
// patch's middle tile, a forest's or a mountain's first variant, a
// crossing over water. Terrains with no plain tile (walls, gates, traps)
// show the grass they stand on.
export function getTerrainIconTiles(terrain: Terrain): readonly SheetTile[] {
  switch (terrain) {
    case 'water':
    case 'dirt':
    case 'meadow':
      return [TERRAIN_BASE_TILE, blockMiddle(terrain)];
    case 'forest':
      return [TERRAIN_BASE_TILE, FOREST_ART.tiles[0]!];
    case 'mountain':
      return [TERRAIN_BASE_TILE, MOUNTAIN_ART.body[0]!];
    case 'bridge':
      return [TERRAIN_BASE_TILE, blockMiddle('water'), BRIDGE_ART.horizontal];
    case 'ford':
      return [TERRAIN_BASE_TILE, blockMiddle('water'), FORD_ART];
    default:
      return [TERRAIN_BASE_TILE];
  }
}
