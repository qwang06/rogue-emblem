import { describe, expect, it } from 'vitest';
import { getDangerZone, type DangerSource } from './dangerZone.ts';
import { createGrid, setTerrain, setUnit, type Point } from './grid.ts';

// Sorted "x,y" strings so assertions don't depend on iteration order.
function tiles(list: readonly Point[]) {
  return list.map(({ x, y }) => `${x},${y}`).sort();
}

const SWORD = { minRange: 1, maxRange: 1 };
const BOW = { minRange: 2, maxRange: 2 };

function source(overrides: Partial<DangerSource> = {}): DangerSource {
  return { origin: { x: 2, y: 2 }, movement: 0, ranges: [SWORD], ...overrides };
}

describe('getDangerZone', () => {
  it('is empty with no sources', () => {
    expect(getDangerZone(createGrid(5, 5, 'grass'), [])).toEqual([]);
  });

  it('covers the attack range around a unit that cannot move', () => {
    const grid = createGrid(5, 5, 'grass');
    expect(tiles(getDangerZone(grid, [source()]))).toEqual(['1,2', '2,1', '2,3', '3,2']);
  });

  it('reaches one tile past every tile the unit can move to', () => {
    const grid = createGrid(7, 7, 'grass');
    const zone = getDangerZone(grid, [source({ origin: { x: 3, y: 3 }, movement: 1 })]);
    // Move 1 + range 1: a diamond of radius 2, the unit's own tile included
    // (it could step off and strike back at it).
    expect(zone).toHaveLength(13);
    expect(tiles(zone)).toContain('3,3');
    expect(tiles(zone)).toContain('5,3');
    expect(tiles(zone)).not.toContain('5,4');
  });

  it('includes tiles the unit can move to when another stop reaches them', () => {
    const grid = createGrid(5, 5, 'grass');
    const zone = getDangerZone(grid, [source({ movement: 1 })]);
    for (const stop of ['1,2', '2,1', '2,3', '3,2']) expect(tiles(zone)).toContain(stop);
  });

  it('leaves out tiles closer than a weapon minimum range', () => {
    const grid = createGrid(5, 5, 'grass');
    const zone = getDangerZone(grid, [source({ ranges: [BOW] })]);
    expect(zone).toHaveLength(8);
    expect(tiles(zone)).not.toContain('2,3');
    expect(tiles(zone)).toContain('2,4');
    expect(tiles(zone)).toContain('3,3');
  });

  it('counts each weapon range on its own rather than spanning the gap', () => {
    const grid = createGrid(9, 9, 'grass');
    const zone = tiles(
      getDangerZone(grid, [source({ origin: { x: 4, y: 4 }, ranges: [SWORD, { minRange: 3, maxRange: 3 }] })]),
    );
    expect(zone).toContain('4,5');
    expect(zone).not.toContain('4,6');
    expect(zone).toContain('4,7');
  });

  it('adds nothing for a unit without a weapon', () => {
    const grid = createGrid(5, 5, 'grass');
    expect(getDangerZone(grid, [source({ movement: 3, ranges: [] })])).toEqual([]);
  });

  it('merges overlapping sources without duplicates', () => {
    const grid = createGrid(5, 5, 'grass');
    const zone = getDangerZone(grid, [source({ origin: { x: 1, y: 2 } }), source({ origin: { x: 3, y: 2 } })]);
    expect(tiles(zone)).toEqual(['0,2', '1,1', '1,3', '2,2', '3,1', '3,3', '4,2']);
    expect(new Set(tiles(zone)).size).toBe(zone.length);
  });

  it('does not reach past terrain the unit cannot cross', () => {
    let grid = createGrid(5, 1, 'grass');
    grid = setTerrain(grid, 1, 0, 'water');
    const zone = getDangerZone(grid, [source({ origin: { x: 0, y: 0 }, movement: 4 })]);
    expect(tiles(zone)).toEqual(['1,0']);
  });

  it('is blocked by units it cannot pass, and passes the ones it can', () => {
    let grid = createGrid(5, 1, 'grass');
    grid = setUnit(grid, 1, 0, 'other');
    const blocked = getDangerZone(grid, [source({ origin: { x: 0, y: 0 }, movement: 3 })]);
    expect(tiles(blocked)).toEqual(['1,0']);
    const passing = getDangerZone(grid, [
      source({ origin: { x: 0, y: 0 }, movement: 3, options: { canPassThrough: () => true } }),
    ]);
    // The unit can't stop on the other's tile, so its own tile stays safe.
    expect(tiles(passing)).toEqual(['1,0', '2,0', '3,0', '4,0']);
  });

  it('stays inside the map at the edges', () => {
    const grid = createGrid(3, 3, 'grass');
    const zone = getDangerZone(grid, [source({ origin: { x: 0, y: 0 }, ranges: [BOW] })]);
    expect(tiles(zone)).toEqual(['0,2', '1,1', '2,0']);
  });
});
