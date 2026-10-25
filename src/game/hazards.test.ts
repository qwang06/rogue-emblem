import { describe, expect, it } from 'vitest';
import { createGrid, getDistance, setTerrain, setUnit } from './grid.ts';
import { getHazard, HAZARDS, pickSpikeTiles, SPIKES } from './hazards.ts';
import { createSeededRng } from './rng.ts';

describe('getHazard', () => {
  it('names the hazard on spikes and deep water, and none elsewhere', () => {
    expect(getHazard(SPIKES)).toBe(HAZARDS[SPIKES]);
    expect(getHazard('water')).toMatchObject({ drowns: true });
    expect(getHazard('ford')).toBeNull();
    expect(getHazard('grass')).toBeNull();
    expect(getHazard(null)).toBeNull();
  });
});

describe('pickSpikeTiles', () => {
  const grid = createGrid(10, 10, 'grass');
  const enemyTiles = [{ x: 5, y: 2 }];
  const placement = { count: 3, enemyTiles, reach: 3, avoid: [] };

  it('lays the traps near the enemies, never next to each other', () => {
    const tiles = pickSpikeTiles(grid, placement, createSeededRng(1));
    expect(tiles).toHaveLength(3);
    for (const tile of tiles) {
      const distance = getDistance(tile, enemyTiles[0]);
      expect(distance).toBeGreaterThanOrEqual(1);
      expect(distance).toBeLessThanOrEqual(3);
    }
    for (const a of tiles) for (const b of tiles) if (a !== b) expect(getDistance(a, b)).toBeGreaterThan(1);
  });

  it('is the same for the same seed', () => {
    expect(pickSpikeTiles(grid, placement, createSeededRng(7))).toEqual(
      pickSpikeTiles(grid, placement, createSeededRng(7)),
    );
  });

  it('keeps off and away from avoided tiles, units and anything but open ground', () => {
    let map = setUnit(grid, 5, 2, 'enemy');
    map = setTerrain(map, 4, 2, 'water');
    map = setTerrain(map, 6, 2, 'forest');
    const tiles = pickSpikeTiles(map, { count: 10, enemyTiles, reach: 1, avoid: [{ x: 5, y: 4 }] }, createSeededRng(2));
    // Within 1 of the enemy: (5, 1) is the only open one, (5, 3) is next to
    // the avoided tile.
    expect(tiles).toEqual([{ x: 5, y: 1 }]);
  });

  it('lays fewer when too few tiles qualify, and none for a count of 0', () => {
    expect(pickSpikeTiles(grid, { ...placement, count: 0 }, createSeededRng(1))).toEqual([]);
    expect(pickSpikeTiles(grid, { ...placement, enemyTiles: [] }, createSeededRng(1))).toEqual([]);
  });
});
