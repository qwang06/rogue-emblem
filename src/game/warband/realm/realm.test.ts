import { describe, expect, it } from 'vitest';
import { DEFAULT_CONTENT } from '../../battleSetup.ts';
import { getCell } from '../../grid.ts';
import { createSeededRng } from '../../rng.ts';
import {
  BATTLE_SITES,
  FORT_FROM,
  generateRealm,
  getHomeSite,
  getNextSites,
  getRealm,
  getRealmDepth,
  getRoad,
  getSite,
  layOutColumns,
  pickKinds,
  REALM_HEIGHT,
  TOWN_EVERY,
  type Realm,
} from './realm.ts';
import { getRealmDrawList } from './realmArt.ts';

const SETTINGS = DEFAULT_CONTENT.regions;
const SEEDS = Array.from({ length: 24 }, (_, i) => i * 7919 + 3);
const REALMS = SEEDS.map((seed) => generateRealm(seed, SETTINGS));

const terrainAt = (realm: Realm, x: number, y: number) => getCell(realm.grid, x, y)?.terrain;
const isRoadTile = (realm: Realm, x: number, y: number) => {
  const terrain = terrainAt(realm, x, y);
  return terrain === 'dirt' || terrain === 'bridge';
};

describe('generateRealm', () => {
  it('is the same realm every time for a seed', () => {
    expect(generateRealm(SEEDS[0], SETTINGS)).toEqual(REALMS[0]);
    expect(generateRealm(SEEDS[1], SETTINGS).name).toBe(REALMS[1].name);
  });

  it('runs from home in the west to the Hold in the east, one column of sites per depth', () => {
    for (const realm of REALMS) {
      expect(realm.depth).toBe(getRealmDepth(SETTINGS));
      expect(realm.grid.height).toBe(REALM_HEIGHT);
      expect(getHomeSite(realm)).toMatchObject({ id: '0-0', kind: 'home', depth: 0 });
      const holds = realm.sites.filter((site) => site.kind === 'hold');
      expect(holds).toHaveLength(1);
      expect(holds[0].depth).toBe(realm.depth);
      for (const site of realm.sites) {
        const sameDepth = realm.sites.filter((other) => other.depth === site.depth);
        expect(sameDepth.every((other) => other.x === site.x)).toBe(true);
      }
    }
  });

  it('gives every site a unique id and name', () => {
    for (const realm of REALMS) {
      expect(new Set(realm.sites.map((site) => site.id)).size).toBe(realm.sites.length);
      expect(new Set(realm.sites.map((site) => site.name)).size).toBe(realm.sites.length);
    }
  });

  it('leads a road on from every site but the Hold, and to every site but home', () => {
    for (const realm of REALMS) {
      for (const site of realm.sites) {
        if (site.kind !== 'hold') expect(getNextSites(realm, site.id).length).toBeGreaterThan(0);
        if (site.kind !== 'home') expect(realm.roads.some((road) => road.to === site.id)).toBe(true);
      }
    }
  });

  it('only links neighboring depths, without roads crossing between columns', () => {
    for (const realm of REALMS) {
      for (const road of realm.roads) {
        expect(getSite(realm, road.to)!.depth).toBe(getSite(realm, road.from)!.depth + 1);
      }
      for (const a of realm.roads) {
        for (const b of realm.roads) {
          const [af, at, bf, bt] = [a.from, a.to, b.from, b.to].map((id) => getSite(realm, id)!);
          if (af.depth !== bf.depth) continue;
          // North-to-south order at the west end matches the east end's.
          expect(Math.sign(af.y - bf.y) * Math.sign(at.y - bt.y)).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('lays each road as a connected line of road tiles between its sites', () => {
    for (const realm of REALMS) {
      for (const road of realm.roads) {
        const from = getSite(realm, road.from)!;
        const to = getSite(realm, road.to)!;
        const path = [{ x: from.x, y: from.y }, ...road.path, { x: to.x, y: to.y }];
        for (let i = 1; i < path.length; i++) {
          expect(Math.abs(path[i].x - path[i - 1].x) + Math.abs(path[i].y - path[i - 1].y)).toBeLessThanOrEqual(1);
        }
        for (const point of road.path) expect(isRoadTile(realm, point.x, point.y)).toBe(true);
      }
    }
  });

  it('stands every site on a road tile, clear of water and mountains', () => {
    for (const realm of REALMS) {
      for (const site of realm.sites) {
        expect(terrainAt(realm, site.x, site.y)).toBe('dirt');
      }
    }
  });

  it('rarely closes a 2x2 block of road, which the dirt art cannot draw', () => {
    let blocks = 0;
    for (const realm of REALMS) {
      for (let y = 0; y < realm.grid.height - 1; y++) {
        for (let x = 0; x < realm.grid.width - 1; x++) {
          const square = [
            [x, y],
            [x + 1, y],
            [x, y + 1],
            [x + 1, y + 1],
          ];
          if (square.every(([sx, sy]) => terrainAt(realm, sx, sy) === 'dirt')) blocks++;
        }
      }
    }
    expect(blocks).toBeLessThanOrEqual(REALMS.length / 8);
  });

  it('plays each battle site in a region meant for its depth or one before', () => {
    for (const realm of REALMS) {
      for (const site of realm.sites) {
        expect(site.region).toBeGreaterThanOrEqual(0);
        expect(site.region).toBeLessThan(SETTINGS.regions.length);
        if (site.kind === 'battle' || site.kind === 'village') {
          expect(site.region).toBeLessThanOrEqual(site.depth - 1);
          expect(site.levelOffset).toBeGreaterThanOrEqual(0);
        }
      }
      expect(realm.sites.find((site) => site.kind === 'hold')!.name).toBe(SETTINGS.regions.at(-1)!.name);
    }
  });

  it('puts the realm on buildings: a camp at home, a castle at the Hold', () => {
    for (const realm of REALMS.slice(0, 4)) {
      const home = getHomeSite(realm);
      const hold = realm.sites.find((site) => site.kind === 'hold')!;
      expect(realm.buildings.some((b) => b.x === home.x && b.y === home.y)).toBe(true);
      expect(realm.buildings.some((b) => b.x === hold.x && b.y === hold.y)).toBe(true);
    }
  });
});

describe('elite lairs and waysides', () => {
  it('turn up across realms, never before depth 3', () => {
    const kinds = REALMS.flatMap((realm) => realm.sites);
    expect(kinds.some((site) => site.kind === 'elite')).toBe(true);
    expect(kinds.some((site) => site.kind === 'event')).toBe(true);
    for (const site of kinds)
      if (site.kind === 'elite' || site.kind === 'event') expect(site.depth).toBeGreaterThanOrEqual(3);
  });
});

describe('getNextSites and getRoad', () => {
  const realm = REALMS[0];

  it('lists the sites the roads lead to, north to south', () => {
    const next = getNextSites(realm, '0-0');
    expect(next.every((site) => site.depth === 1)).toBe(true);
    expect(next.map((site) => site.y)).toEqual([...next.map((site) => site.y)].sort((a, b) => a - b));
    expect(getNextSites(realm, 'nowhere')).toEqual([]);
  });

  it('finds the road between two linked sites, and none between others', () => {
    const [first] = getNextSites(realm, '0-0');
    expect(getRoad(realm, '0-0', first.id)?.to).toBe(first.id);
    expect(getRoad(realm, first.id, '0-0')).toBeUndefined();
  });
});

describe('getRealm', () => {
  it('builds a realm once per seed and settings', () => {
    expect(getRealm(5, SETTINGS)).toBe(getRealm(5, SETTINGS));
    expect(getRealm(5, { ...SETTINGS })).not.toBe(getRealm(5, SETTINGS));
  });
});

describe('getRealmDepth', () => {
  it('is the final stage, else one stop per region, never under 3', () => {
    expect(getRealmDepth({ ...SETTINGS, finalStage: 7 })).toBe(7);
    expect(getRealmDepth({ ...SETTINGS, finalStage: undefined })).toBe(SETTINGS.regions.length);
    expect(getRealmDepth({ ...SETTINGS, finalStage: 1 })).toBe(3);
  });
});

describe('layOutColumns', () => {
  it('stands home and the Hold alone, two sites at the first depth and the last before the Hold', () => {
    for (const seed of SEEDS) {
      const columns = layOutColumns(10, REALM_HEIGHT, createSeededRng(seed));
      expect(columns).toHaveLength(11);
      expect(columns[0]).toHaveLength(1);
      expect(columns[10]).toHaveLength(1);
      expect(columns[1]).toHaveLength(2);
      expect(columns[9]).toHaveLength(2);
      for (const column of columns.slice(2, 9)) {
        expect(column.length).toBeGreaterThanOrEqual(2);
        expect(column.length).toBeLessThanOrEqual(3);
      }
      for (const column of columns) {
        for (const point of column) {
          expect(point.y).toBeGreaterThanOrEqual(1);
          expect(point.y).toBeLessThan(REALM_HEIGHT - 1);
        }
        expect(column.map((p) => p.y)).toEqual([...column.map((p) => p.y)].sort((a, b) => a - b));
      }
    }
  });
});

describe('pickKinds', () => {
  const counts = [1, 2, 3, 3, 2, 3, 3, 2, 3, 2, 1];
  const all = SEEDS.map((seed) => pickKinds(counts, createSeededRng(seed)));

  it('opens with home, two battles and villages, and ends at the Hold', () => {
    for (const kinds of all) {
      expect(kinds[0]).toEqual(['home']);
      expect(kinds[1]).toEqual(['battle', 'battle']);
      expect(kinds[2]).toEqual(['village', 'village', 'village']);
      expect(kinds.at(-1)).toEqual(['hold']);
    }
  });

  it('keeps a fight at every depth, and no fort before FORT_FROM', () => {
    for (const kinds of all) {
      kinds.slice(1).forEach((column, d) => {
        expect(column.some((kind) => BATTLE_SITES.has(kind))).toBe(true);
        if (d + 1 < FORT_FROM) expect(column).not.toContain('fort');
      });
    }
  });

  it('has at most one town, shrine, elite lair and wayside per depth, a town every few depths and one before the Hold', () => {
    for (const kinds of all) {
      let lastTown = 1;
      kinds.forEach((column, d) => {
        expect(column.filter((kind) => kind === 'town').length).toBeLessThanOrEqual(1);
        for (const single of ['shrine', 'elite', 'event'] as const) {
          expect(column.filter((kind) => kind === single).length).toBeLessThanOrEqual(1);
        }
        if (column.includes('town')) lastTown = d;
        if (d > 1 && d < kinds.length - 1) expect(d - lastTown).toBeLessThan(TOWN_EVERY);
      });
      expect(kinds.at(-2)).toContain('town');
    }
  });
});

describe('getRealmDrawList', () => {
  it('draws grass under every tile, then the rest, inside the map', () => {
    const realm = REALMS[0];
    const draws = getRealmDrawList(realm);
    const cells = realm.grid.width * realm.grid.height;
    expect(draws.length).toBeGreaterThan(cells);
    expect(new Set(draws.slice(0, cells).map((draw) => draw.frame)).size).toBe(1);
    for (const draw of draws) {
      expect(draw.x).toBeGreaterThanOrEqual(0);
      expect(draw.y).toBeGreaterThanOrEqual(0);
      expect(draw.x).toBeLessThan(realm.grid.width * 32);
      expect(draw.y).toBeLessThan(realm.grid.height * 32);
    }
  });

  it('animates the water and nothing else', () => {
    const realm = REALMS[0];
    const still = getRealmDrawList(realm, 0);
    const moved = getRealmDrawList(realm, 1);
    expect(moved).toHaveLength(still.length);
    const changed = still.filter((draw, i) => draw.frame !== moved[i].frame);
    const hasWater = realm.grid.cells.some((cell) => cell.terrain === 'water');
    expect(changed.length > 0).toBe(hasWater);
  });
});
