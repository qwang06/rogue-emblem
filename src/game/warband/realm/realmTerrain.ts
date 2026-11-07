// The land a Warband realm is drawn on: grass with lakes, forests,
// meadows and mountains, grown from smooth noise so features come in
// natural blobs rather than specks, in one of a few shapes (REALM_SHAPES):
// the land rising toward the east, where the run ends, so mountains gather
// around the Warlord's end of the map; a spine of mountains down the
// middle; a valley walled by ranges north and south; lakeland, with great
// lakes along the middle; or a coast, where a deep sea bites into one
// edge. Any shape may have a sea along its north or south edge. Pure: the
// same Rng sequence always gives the same land.

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

// The lie of the land (see the top of this file).
export const REALM_SHAPES = ['ranges', 'spine', 'valley', 'lakeland', 'coast'] as const;
export type RealmShape = (typeof REALM_SHAPES)[number];
export type SeaSide = 'north' | 'south';

export interface LandOptions {
  shape?: RealmShape;
  // The edge a sea runs along, if any; a coast always has one.
  sea?: SeaSide | null;
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
  // How much the shapes raise the land: a spine's ridge (over its middle
  // rows), a valley's walls (over its outer rows), and how much lakeland
  // wets its middle.
  spine: 0.3,
  spineRows: 2.5,
  valley: 0.34,
  valleyFrom: 0.3,
  lakeland: 0.2,
  // The sea: how many tiles deep it bites into its edge at most (noise
  // picks the depth column by column), on an ordinary shape and a coast.
  seaDepth: 3,
  coastDepth: 5,
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

// The realm's land before any roads or sites: see LAND_RULES. The noise
// is drawn from `rng` the same way whatever the shape, so a shape only
// reshapes the same ground.
export function generateRealmLand(width: number, height: number, rng: Rng, options: LandOptions = {}): RealmLand {
  const rules = LAND_RULES;
  const shape = options.shape ?? 'ranges';
  const sea = options.sea ?? (shape === 'coast' ? 'north' : null);
  const heightNoise = createValueNoise(width, height, rules.cell, rng);
  const wetNoise = createValueNoise(width, height, rules.cell, rng);
  const woodNoise = createValueNoise(width, height, rules.cell - 1, rng);
  const seaNoise = sea ? createValueNoise(width, 1, rules.cell * 2, rng) : null;
  const middle = (height - 1) / 2;
  const cells: RealmTerrain[] = [];
  for (let y = 0; y < height; y++) {
    // How far from the middle row, 0 there to 1 at the edges.
    const out = Math.abs(y - middle) / middle;
    for (let x = 0; x < width; x++) {
      const east = width > 1 ? x / (width - 1) : 0;
      const eastRise = shape === 'ranges' ? rules.eastRise : rules.eastRise / 2;
      let rise = heightNoise(x, y) * (1 - eastRise) + east * eastRise;
      let wet = wetNoise(x, y);
      if (shape === 'spine') rise += rules.spine * Math.max(0, 1 - Math.abs(y - middle) / rules.spineRows);
      else if (shape === 'valley')
        rise += rules.valley * Math.max(0, (out - rules.valleyFrom) / (1 - rules.valleyFrom));
      else if (shape === 'lakeland') wet += rules.lakeland * (1 - out);
      const wood = woodNoise(x, y);
      if (x >= rules.openWest && rise > rules.mountain) cells.push('mountain');
      else if (wet > rules.water && rise < rules.mountain - 0.1) cells.push('water');
      else if (wood > rules.forest) cells.push('forest');
      else if (wood > rules.meadow) cells.push('meadow');
      else cells.push('grass');
    }
  }
  const land = { width, height, cells };
  if (sea && seaNoise) {
    const most = shape === 'coast' ? rules.coastDepth : rules.seaDepth;
    for (let x = 0; x < width; x++) {
      const depth = Math.max(1, Math.round(0.6 + seaNoise(x, 0) * most));
      for (let d = 0; d < depth; d++) setLand(land, x, sea === 'north' ? d : height - 1 - d, 'water');
    }
  }
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
