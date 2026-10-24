// The land a Warband realm is drawn on: grass with lakes, forests,
// meadows and mountains, grown from smooth noise so features come in
// natural blobs rather than specks. The land rises toward the east, where
// the run ends, so mountains gather around the Warlord's end of the map and
// the warband sets out from open country in the west. Pure: the same Rng
// sequence always gives the same land.

import type { Rng } from '../../combatStats.ts';

// The terrain names the realm uses (the battle maps' own, see tileset.ts).
export type RealmTerrain = 'grass' | 'meadow' | 'forest' | 'water' | 'mountain' | 'dirt' | 'bridge';

// Terrain as a flat list, row by row (index y * width + x), so generation
// can change cells in place before it becomes a Grid.
export interface RealmLand {
  width: number;
  height: number;
  cells: RealmTerrain[];
}

// Thresholds on the noise fields (each 0–1); see generateRealmLand.
export const LAND_RULES = Object.freeze({
  // A cell is a mountain when its height is above this...
  mountain: 0.74,
  // ...where height is the noise, weighted this much, plus how far east
  // the cell is (0 at the west edge, 1 at the east) for the rest.
  eastRise: 0.32,
  // No mountains in this many columns from the west edge.
  openWest: 5,
  // Water where the wetness noise is above this (and the land is low).
  water: 0.72,
  // Forest where the woods noise is above this; meadow in the band below.
  forest: 0.62,
  meadow: 0.54,
  // Lakes smaller than this many tiles are dried up.
  minLake: 5,
  // Noise lattice spacing, in tiles: bigger gives bigger features.
  cell: 5,
});

// Smooth value noise over a width x height map: random values on a
// lattice every `cell` tiles, blended between with smoothstep. Returns the
// noise at (x, y), from 0 to 1.
export function createValueNoise(
  width: number,
  height: number,
  cell: number,
  rng: Rng,
): (x: number, y: number) => number {
  const columns = Math.ceil(width / cell) + 2;
  const rows = Math.ceil(height / cell) + 2;
  const lattice = Array.from({ length: columns * rows }, () => rng());
  const at = (i: number, j: number) => lattice[j * columns + i];
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x, y) => {
    const gx = x / cell;
    const gy = y / cell;
    const i = Math.floor(gx);
    const j = Math.floor(gy);
    const tx = smooth(gx - i);
    const ty = smooth(gy - j);
    const top = at(i, j) * (1 - tx) + at(i + 1, j) * tx;
    const bottom = at(i, j + 1) * (1 - tx) + at(i + 1, j + 1) * tx;
    return top * (1 - ty) + bottom * ty;
  };
}

// The realm's land before any roads or sites: see LAND_RULES.
export function generateRealmLand(width: number, height: number, rng: Rng): RealmLand {
  const rules = LAND_RULES;
  const heightNoise = createValueNoise(width, height, rules.cell, rng);
  const wetNoise = createValueNoise(width, height, rules.cell, rng);
  const woodNoise = createValueNoise(width, height, rules.cell - 1, rng);
  const cells: RealmTerrain[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const east = width > 1 ? x / (width - 1) : 0;
      const rise = heightNoise(x, y) * (1 - rules.eastRise) + east * rules.eastRise;
      const wet = wetNoise(x, y);
      const wood = woodNoise(x, y);
      if (x >= rules.openWest && rise > rules.mountain) cells.push('mountain');
      else if (wet > rules.water && rise < rules.mountain - 0.1) cells.push('water');
      else if (wood > rules.forest) cells.push('forest');
      else if (wood > rules.meadow) cells.push('meadow');
      else cells.push('grass');
    }
  }
  const land = { width, height, cells };
  clearSpecks(land, 'water', rules.minLake);
  return land;
}

// Turns every patch of `terrain` smaller than `minSize` tiles back into
// grass, so a lake is a lake and not a puddle.
export function clearSpecks(land: RealmLand, terrain: RealmTerrain, minSize: number): void {
  const seen = new Set<number>();
  for (let start = 0; start < land.cells.length; start++) {
    if (seen.has(start) || land.cells[start] !== terrain) continue;
    const patch = [start];
    seen.add(start);
    for (let i = 0; i < patch.length; i++) {
      const x = patch[i] % land.width;
      const y = Math.floor(patch[i] / land.width);
      for (const [nx, ny] of [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ]) {
        const next = ny * land.width + nx;
        if (landAt(land, nx, ny) !== terrain || seen.has(next)) continue;
        seen.add(next);
        patch.push(next);
      }
    }
    if (patch.length < minSize) for (const i of patch) land.cells[i] = 'grass';
  }
}

export function landAt(land: RealmLand, x: number, y: number): RealmTerrain | undefined {
  if (x < 0 || y < 0 || x >= land.width || y >= land.height) return undefined;
  return land.cells[y * land.width + x];
}

export function setLand(land: RealmLand, x: number, y: number, terrain: RealmTerrain): void {
  if (x < 0 || y < 0 || x >= land.width || y >= land.height) return;
  land.cells[y * land.width + x] = terrain;
}
