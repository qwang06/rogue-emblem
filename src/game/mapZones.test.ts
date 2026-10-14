import { describe, expect, it } from 'vitest';
import type { Point } from './grid.ts';
import { getZones, PATCH_ZONES, pickZonedStart, type Zone } from './mapZones.ts';
import { createSeededRng } from './rng.ts';

const key = ({ x, y }: Point) => `${x},${y}`;

// A 7x9 map: deploying on the south row's middle three tiles, the enemy at
// the top middle, one straight route between them up column 3.
const DEPLOY = [2, 3, 4].map((x) => ({ x, y: 8 }));
const ENEMY = [{ x: 3, y: 0 }];
const ROUTE = Array.from({ length: 9 }, (_, y) => ({ x: 3, y }));
const ZONES = getZones(7, 9, DEPLOY, ENEMY, ROUTE);
const zoneAt = (x: number, y: number) => ZONES.get(key({ x, y }));

describe('getZones', () => {
  it('gives every tile a zone', () => {
    expect(ZONES.size).toBe(63);
  });

  it('marks tiles within 2 steps of each side as home and enemy home', () => {
    expect(zoneAt(3, 8)).toBe('home');
    expect(zoneAt(0, 8)).toBe('home');
    expect(zoneAt(3, 6)).toBe('home');
    expect(zoneAt(3, 0)).toBe('enemyHome');
    expect(zoneAt(4, 1)).toBe('enemyHome');
    expect(zoneAt(3, 2)).toBe('enemyHome');
  });

  it('marks tiles about as far from both sides as the midfield', () => {
    // (3, 4) is 4 steps from each side; (4, 4) and (6, 4) are a step
    // nearer the deployment zone than the enemy.
    expect(zoneAt(3, 4)).toBe('midfield');
    expect(zoneAt(4, 4)).toBe('midfield');
    expect(zoneAt(6, 4)).toBe('midfield');
    expect(zoneAt(3, 5)).toBe('lane');
  });

  it('marks tiles 2 or more off every route as flank, the rest as lane', () => {
    expect(zoneAt(0, 6)).toBe('flank');
    expect(zoneAt(5, 2)).toBe('flank');
    expect(zoneAt(4, 5)).toBe('lane');
    expect(zoneAt(2, 2)).toBe('lane');
  });

  it('puts a tile in the first zone that fits it', () => {
    // (1, 7) is within 2 of the deployment zone and 2 off the route.
    expect(zoneAt(1, 7)).toBe('home');
  });
});

describe('pickZonedStart', () => {
  const ALL = [...ZONES.keys()].map((k) => {
    const [x, y] = k.split(',').map(Number);
    return { x, y };
  });

  it('starts water and mountains on the flanks', () => {
    for (const terrain of ['water', 'mountain']) {
      for (let seed = 0; seed < 30; seed++) {
        const p = pickZonedStart(ZONES, terrain, seed, ALL, createSeededRng(seed));
        expect(zoneAt(p.x, p.y)).toBe('flank');
      }
    }
  });

  it('takes the forest zones in turn, patch by patch', () => {
    const lists = PATCH_ZONES.forest;
    for (let index = 0; index < 6; index++) {
      const p = pickZonedStart(ZONES, 'forest', index, ALL, createSeededRng(index));
      expect(lists[index % lists.length]).toContain(zoneAt(p.x, p.y) as Zone);
    }
  });

  it('starts other terrain anywhere it may', () => {
    const picked = new Set<Zone>();
    for (let seed = 0; seed < 100; seed++) {
      const p = pickZonedStart(ZONES, 'meadow', 0, ALL, createSeededRng(seed));
      picked.add(zoneAt(p.x, p.y)!);
    }
    expect(picked.size).toBeGreaterThan(2);
  });

  it('falls back to any start when none is in its zones', () => {
    const lane = [{ x: 4, y: 5 }];
    expect(pickZonedStart(ZONES, 'water', 0, lane, createSeededRng(1))).toEqual(lane[0]);
  });
});
