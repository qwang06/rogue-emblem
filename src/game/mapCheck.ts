// The hard rules every generated battle map must keep, in one place, so a
// generator can throw away a candidate that breaks one (see
// pickStageLayout in warband/stageLevel.ts) and tests can check any map
// against them. Pure: it reads the map and says what's wrong.
//
// The rules:
// - every deployment and enemy tile can be walked to from the first
//   deployment tile, around water, mountains and walls
// - no 2x2 block of dirt (the dirt autotile only has notched full tiles,
//   so a wider patch shows grass holes)
// - no wall on the map's west or east column (the wall autotile carries
//   terrain past the edge, so it would draw as a thick block)
// - every building stands on grass, on a tile of its own, with room north
//   of it for its art (a tall building's top and a flag) and no other
//   building's art over it

import type { BuildingPlacement } from './buildings.ts';
import { getCell, type Grid, type Point } from './grid.ts';
import { getReachable } from './mapGen.ts';
import { BUILDING_ART } from './tileset.ts';

const key = ({ x, y }: Point) => `${x},${y}`;

export interface MapToCheck {
  grid: Grid;
  buildings: readonly BuildingPlacement[];
  deploymentZone: readonly Point[];
  enemyTiles: readonly Point[];
}

// How many rows a building's art reaches north of its own tile: its top
// (if tall) and a flag (for palettes that have them).
function getArtHeight(building: BuildingPlacement['building']): number {
  return BUILDING_ART[building].tall ? 2 : 1;
}

// Every rule `map` breaks, as a sentence each naming the tile at fault;
// empty when it keeps them all.
export function checkMap({ grid, buildings, deploymentZone, enemyTiles }: MapToCheck): string[] {
  const problems: string[] = [];

  const [start] = deploymentZone;
  if (!start) {
    problems.push('the map has no deployment tiles');
  } else {
    const reachable = getReachable(grid, start);
    for (const p of [...deploymentZone, ...enemyTiles]) {
      if (!reachable.has(key(p))) problems.push(`(${p.x}, ${p.y}) can't be walked to from the deployment zone`);
    }
  }

  const isDirt = (x: number, y: number) => getCell(grid, x, y)?.terrain === 'dirt';
  for (let y = 0; y < grid.height - 1; y++) {
    for (let x = 0; x < grid.width - 1; x++) {
      if (isDirt(x, y) && isDirt(x + 1, y) && isDirt(x, y + 1) && isDirt(x + 1, y + 1)) {
        problems.push(`a 2x2 block of dirt starts at (${x}, ${y})`);
      }
    }
  }

  for (let y = 0; y < grid.height; y++) {
    for (const x of [0, grid.width - 1]) {
      if (getCell(grid, x, y)?.terrain === 'wall') problems.push(`a wall stands on the map's side at (${x}, ${y})`);
    }
  }

  // Tiles some building's art is drawn over, other than its own.
  const overhung = new Set<string>();
  for (const { x, y, building } of buildings) {
    for (let dy = 1; dy <= getArtHeight(building); dy++) overhung.add(key({ x, y: y - dy }));
  }
  const taken = new Set<string>();
  for (const b of buildings) {
    const at = `the ${b.building} at (${b.x}, ${b.y})`;
    if (getCell(grid, b.x, b.y)?.terrain !== 'grass') problems.push(`${at} isn't on grass`);
    if (b.y - getArtHeight(b.building) < 0) problems.push(`${at} is too close to the north edge for its art`);
    if (taken.has(key(b))) problems.push(`${at} shares its tile with another building`);
    if (overhung.has(key(b))) problems.push(`${at} is under another building's art`);
    taken.add(key(b));
  }

  return problems;
}
