import { describe, expect, it } from 'vitest';
import { createSeededRng } from '../../rng.ts';
import { carveRoad, linkColumns } from './realmRoads.ts';
import { landAt, type RealmLand, type RealmTerrain } from './realmTerrain.ts';

// A land from rows of characters: . grass, ~ water, ^ mountain, = dirt.
function landOf(rows: readonly string[]): RealmLand {
  const terrain: Record<string, RealmTerrain> = { '.': 'grass', '~': 'water', '^': 'mountain', '=': 'dirt' };
  return { width: rows[0].length, height: rows.length, cells: rows.flatMap((row) => [...row].map((c) => terrain[c])) };
}

const column = (...ys: number[]) => ys.map((y) => ({ x: 0, y }));

describe('linkColumns', () => {
  it('links every site on both sides, without crossings', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const west = column(2, 8, 14);
      const east = column(4, 12);
      const links = linkColumns(west, east, createSeededRng(seed));
      expect(new Set(links.map(([i]) => i))).toEqual(new Set([0, 1, 2]));
      expect(new Set(links.map(([, j]) => j))).toEqual(new Set([0, 1]));
      for (const [i, j] of links) {
        for (const [k, l] of links) expect(Math.sign(i - k) * Math.sign(j - l)).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('links a lone site to every site on the other side', () => {
    expect(linkColumns(column(5), column(2, 9), createSeededRng(3))).toEqual([
      [0, 0],
      [0, 1],
    ]);
    expect(linkColumns(column(5), column(6), createSeededRng(3))).toEqual([[0, 0]]);
  });
});

describe('carveRoad', () => {
  it('lays dirt on the tiles between two sites, and returns them in order', () => {
    const land = landOf(['.....', '.....', '.....']);
    const path = carveRoad(land, { x: 0, y: 1 }, { x: 4, y: 1 }, []);
    expect(path).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ]);
    for (const { x, y } of path) expect(landAt(land, x, y)).toBe('dirt');
  });

  it('goes around a lake rather than bridging it when the way round is short', () => {
    const land = landOf(['.......', '...~...', '.......', '.......']);
    const path = carveRoad(land, { x: 0, y: 1 }, { x: 6, y: 1 }, []);
    expect(path.some((p) => p.x === 3 && p.y === 1)).toBe(false);
  });

  it('bridges water when there is no way round', () => {
    const land = landOf(['..~..', '..~..', '..~..']);
    const path = carveRoad(land, { x: 0, y: 1 }, { x: 4, y: 1 }, []);
    expect(path.some((p) => landAt(land, p.x, p.y) === 'bridge')).toBe(true);
  });

  it('never steps onto another site, or off the top and bottom rows', () => {
    const land = landOf(['.....', '.....', '.....', '.....']);
    const blocker = { x: 2, y: 1 };
    const path = carveRoad(land, { x: 0, y: 1 }, { x: 4, y: 1 }, [blocker]);
    expect(path).not.toContainEqual(blocker);
    for (const p of path) expect(p.y).toBeGreaterThanOrEqual(1);
    for (const p of path) expect(p.y).toBeLessThanOrEqual(2);
  });

  it('throws when there is no way at all', () => {
    const land = landOf(['.....', '..=..', '.....']);
    expect(() => carveRoad(land, { x: 0, y: 1 }, { x: 4, y: 1 }, [{ x: 2, y: 1 }])).toThrow(/No road/);
  });
});
