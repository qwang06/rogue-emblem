import { describe, expect, it } from 'vitest';
import { createGrid } from '../../grid.ts';
import { getNextSites, getRoad, type Realm, type Road, type Site } from './realm.ts';
import { getOnwardRoads, getRoadNetwork } from './realmRoutes.ts';

const site = (id: string, depth: number, x: number, y: number): Site => ({
  id,
  depth,
  x,
  y,
  name: id,
  kind: 'battle',
  biome: 'meadow',
  region: 0,
  levelOffset: 0,
});
const road = (from: string, to: string, path: number[][]): Road => ({
  from,
  to,
  path: path.map(([x, y]) => ({ x, y })),
});
const realm: Realm = {
  seed: 0,
  name: 'Junctions',
  depth: 3,
  grid: createGrid(9, 4),
  buildings: [],
  palette: 'a-orange',
  sites: [
    site('a', 1, 0, 0),
    site('b', 1, 0, 2),
    site('c', 2, 4, 0),
    site('d', 2, 4, 2),
    site('e', 2, 4, 3),
    site('f', 3, 8, 0),
  ],
  roads: [
    road('a', 'c', [
      [1, 0],
      [2, 0],
      [3, 0],
    ]),
    road('b', 'd', [
      [1, 2],
      [2, 2],
      [2, 1],
      [2, 0],
      [3, 0],
      [3, 1],
      [3, 2],
    ]),
    road('b', 'e', [
      [0, 3],
      [1, 3],
      [2, 3],
      [3, 3],
    ]),
    road('c', 'f', [
      [5, 0],
      [6, 0],
      [7, 0],
    ]),
  ],
};

describe('getRoadNetwork', () => {
  it('merges shared tiles and links only actual road steps in both directions', () => {
    const { links, points } = getRoadNetwork(realm);
    expect(links.get('2,0')).toEqual(new Set(['1,0', '3,0', '2,1']));
    expect(links.get('2,1')?.has('2,0')).toBe(true);
    expect(links.get('3,2')?.has('3,3')).toBe(false);
    expect(points.get('2,0')).toEqual({ x: 2, y: 0 });
  });

  it('ignores missing endpoints and repeated tiles without creating self-links', () => {
    const { links } = getRoadNetwork({
      sites: realm.sites,
      roads: [
        road('missing', 'c', [[9, 9]]),
        road('a', 'c', [
          [0, 0],
          [1, 0],
          [1, 0],
          [2, 0],
          [3, 0],
        ]),
      ],
    });
    expect(links.has('9,9')).toBe(false);
    expect(links.get('0,0')).toEqual(new Set(['1,0']));
    expect(links.get('1,0')).toEqual(new Set(['0,0', '2,0']));
    expect(getRoadNetwork({ sites: [], roads: [] }).links.size).toBe(0);
  });
});

describe('getOnwardRoads', () => {
  it('allows turning at a shared road and gives the connected route for highlighting and travel', () => {
    expect(getNextSites(realm, 'a').map((site) => site.id)).toEqual(['c', 'd']);
    expect(getRoad(realm, 'a', 'd')?.path).toEqual([
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 1 },
      { x: 3, y: 2 },
    ]);
    expect(getRoad(realm, 'a', 'c')).toBe(realm.roads[0]);
    expect(getOnwardRoads(realm, 'a')).toBe(getOnwardRoads(realm, 'a'));
  });

  it('cannot pass through another site, move back, skip a depth or jump to a neighboring road', () => {
    for (const id of ['a', 'b', 'e', 'f', 'missing']) expect(getRoad(realm, 'a', id)).toBeUndefined();
    expect(getRoad(realm, 'c', 'a')).toBeUndefined();
    expect(getOnwardRoads(realm, 'f')).toEqual([]);
    expect(getOnwardRoads(realm, 'missing')).toEqual([]);
    expect(getOnwardRoads({ ...realm, roads: [] }, 'a')).toEqual([]);
  });

  it('does not use roads from an earlier depth to reach a different branch', () => {
    const separate: Realm = {
      ...realm,
      sites: [...realm.sites, site('home', 0, -4, 0)],
      roads: [
        realm.roads[0],
        road('b', 'd', [
          [1, 2],
          [2, 2],
          [3, 2],
        ]),
        road('home', 'a', [
          [-3, 0],
          [-2, 0],
          [-1, 0],
        ]),
        road('home', 'b', [
          [-3, 0],
          [-2, 0],
          [-1, 0],
          [-1, 1],
          [-1, 2],
        ]),
      ],
    };
    expect(getNextSites(separate, 'a').map((site) => site.id)).toEqual(['c']);
  });

  it('handles cycles and offers each destination once', () => {
    const loop = {
      ...realm,
      roads: [
        ...realm.roads,
        road('a', 'c', [
          [0, 1],
          [1, 1],
          [2, 1],
          [3, 1],
          [4, 1],
        ]),
      ],
    };
    expect(getNextSites(loop, 'a').map((site) => site.id)).toEqual(['c', 'd']);
    expect(getRoad(loop, 'a', 'c')).toBe(realm.roads[0]);
  });
});
