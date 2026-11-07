// What the HUD says about a tile's terrain: its name and what entering it
// costs (the terrain card in the battle dock). Pure: no Phaser, no state.

import type { Terrain } from './grid.ts';
import { getMoveCost, TERRAIN_MOVE_COSTS, type TerrainCosts } from './movement.ts';

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
