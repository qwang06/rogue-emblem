import { describe, expect, it } from 'vitest';
import type { BuildingPlacement } from './buildings.ts';
import { checkMap, type MapToCheck } from './mapCheck.ts';
import { parseTerrainMap } from './terrainMap.ts';

// Rows are given north to south; `.` grass, `,` dirt, `~` water, `#` wall,
// `T` forest.
function map(rows: string[], overrides: Partial<MapToCheck> = {}): MapToCheck {
  return {
    grid: parseTerrainMap(rows),
    buildings: [],
    deploymentZone: [{ x: 1, y: rows.length - 1 }],
    enemyTiles: [{ x: 1, y: 0 }],
    ...overrides,
  };
}

const OPEN = ['....', '....', '....', '....'];

describe('checkMap', () => {
  it('passes a map that keeps every rule', () => {
    expect(checkMap(map(OPEN))).toEqual([]);
  });

  it('flags an enemy that no deployment tile can walk to', () => {
    expect(checkMap(map(['....', '~~~~', '....', '....']))).toEqual([
      "(1, 0) can't be walked to from the deployment zone",
    ]);
  });

  it('flags a deployment tile cut off from the others', () => {
    const problems = checkMap(
      map(['....', '....', '~~~.', '.~..'], {
        deploymentZone: [
          { x: 2, y: 3 },
          { x: 0, y: 3 },
        ],
      }),
    );
    expect(problems).toEqual(["(0, 3) can't be walked to from the deployment zone"]);
  });

  it('walks through forest', () => {
    expect(checkMap(map(['....', 'TTTT', '....', '....']))).toEqual([]);
  });

  it('flags a map with no deployment tiles', () => {
    expect(checkMap(map(OPEN, { deploymentZone: [] }))).toEqual(['the map has no deployment tiles']);
  });

  it('flags a 2x2 block of dirt, but not a winding one-tile path', () => {
    expect(checkMap(map(['.,..', '.,,.', '..,.', '..,.']))).toEqual([]);
    expect(checkMap(map(['....', '.,,.', '.,,.', '....']))).toEqual(['a 2x2 block of dirt starts at (1, 1)']);
  });

  it("flags a wall on the map's west or east column, but not inside", () => {
    expect(checkMap(map(['....', '.#..', '....', '....']))).toEqual([]);
    expect(checkMap(map(['....', '#...', '...#', '....']))).toEqual([
      "a wall stands on the map's side at (0, 1)",
      "a wall stands on the map's side at (3, 2)",
    ]);
  });

  it('passes buildings on grass with room for their art', () => {
    const buildings: BuildingPlacement[] = [
      { x: 0, y: 1, building: 'house' },
      { x: 3, y: 2, building: 'castle' },
    ];
    expect(checkMap(map(OPEN, { buildings }))).toEqual([]);
  });

  it('flags a building off grass', () => {
    const buildings: BuildingPlacement[] = [{ x: 1, y: 1, building: 'house' }];
    expect(checkMap(map(['....', '.,..', '.,..', '.,..'], { buildings }))).toEqual([
      "the house at (1, 1) isn't on grass",
    ]);
  });

  it('flags a building too close to the north edge for its art', () => {
    const buildings: BuildingPlacement[] = [
      { x: 0, y: 0, building: 'house' },
      { x: 3, y: 1, building: 'tower' },
    ];
    expect(checkMap(map(OPEN, { buildings }))).toEqual([
      'the house at (0, 0) is too close to the north edge for its art',
      'the tower at (3, 1) is too close to the north edge for its art',
    ]);
  });

  it("flags buildings sharing a tile or standing under another's art", () => {
    const buildings: BuildingPlacement[] = [
      { x: 0, y: 3, building: 'castle' },
      { x: 0, y: 1, building: 'house' },
      { x: 3, y: 2, building: 'farm' },
      { x: 3, y: 2, building: 'mine' },
    ];
    expect(checkMap(map(OPEN, { buildings }))).toEqual([
      "the house at (0, 1) is under another building's art",
      'the mine at (3, 2) shares its tile with another building',
    ]);
  });
});
