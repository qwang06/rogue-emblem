import { describe, expect, it } from 'vitest';
import { countRoutes, getMapMetrics, MAP_SCORE_TARGETS, MAX_ROUTES, scoreMap, type MapMetrics } from './mapScore.ts';
import { parseTerrainMap } from './terrainMap.ts';

// Rows are given north to south; `.` grass, `~` water, `^` mountain, `T`
// forest, `#` wall.
const grid = (...rows: string[]) => parseTerrainMap(rows);

const MET: MapMetrics = Object.freeze({
  nearestEnemy: MAP_SCORE_TARGETS.maxNearestEnemy,
  routes: MAP_SCORE_TARGETS.minRoutes,
  openShare: MAP_SCORE_TARGETS.minOpenShare,
  playerCover: 2,
  enemyCover: 2,
});

describe('countRoutes', () => {
  it('counts one route through a single gap', () => {
    const map = grid('.....', '~~.~~', '.....');
    expect(countRoutes(map, [{ x: 2, y: 2 }], [{ x: 2, y: 0 }])).toBe(1);
  });

  it('counts separate gaps as separate routes', () => {
    const map = grid('.....', '.~.~.', '.....');
    expect(countRoutes(map, [{ x: 2, y: 2 }], [{ x: 2, y: 0 }])).toBe(3);
  });

  it('counts paths that share a tile as one route', () => {
    // Three gaps in the north wall, but every path to them goes through
    // the single gap at (2, 3).
    const map = grid('.....', '.~.~.', '.....', '~~.~~', '.....');
    expect(countRoutes(map, [{ x: 2, y: 4 }], [{ x: 2, y: 0 }])).toBe(1);
  });

  it('stops counting at the limit', () => {
    const map = grid('.......', '.......', '.......');
    expect(countRoutes(map, [{ x: 3, y: 2 }], [{ x: 3, y: 0 }])).toBe(MAX_ROUTES);
    expect(countRoutes(map, [{ x: 3, y: 2 }], [{ x: 3, y: 0 }], 2)).toBe(2);
  });

  it('lets many paths share the starting and ending tiles', () => {
    const map = grid('.....', '.~.~.', '.....');
    const from = [0, 1, 2, 3, 4].map((x) => ({ x, y: 2 }));
    const to = [0, 1, 2, 3, 4].map((x) => ({ x, y: 0 }));
    expect(countRoutes(map, from, to)).toBe(3);
  });

  it('is 0 when the two sides are cut off', () => {
    const map = grid('.....', '~~~~~', '.....');
    expect(countRoutes(map, [{ x: 2, y: 2 }], [{ x: 2, y: 0 }])).toBe(0);
  });

  it('is the limit when the sides touch, since nothing in between can be blocked', () => {
    const map = grid('...', '...');
    expect(countRoutes(map, [{ x: 1, y: 1 }], [{ x: 1, y: 0 }])).toBe(MAX_ROUTES);
    expect(countRoutes(map, [{ x: 1, y: 1 }], [{ x: 1, y: 1 }])).toBe(MAX_ROUTES);
  });

  it('is 0 with no tiles on either side, or only unwalkable ones', () => {
    const map = grid('.~.', '...');
    expect(countRoutes(map, [], [{ x: 0, y: 0 }])).toBe(0);
    expect(countRoutes(map, [{ x: 0, y: 1 }], [])).toBe(0);
    expect(countRoutes(map, [{ x: 0, y: 1 }], [{ x: 1, y: 0 }])).toBe(0);
  });

  it('walks through forest', () => {
    const map = grid('.....', 'TT.TT', '.....');
    expect(countRoutes(map, [{ x: 2, y: 2 }], [{ x: 2, y: 0 }])).toBe(3);
  });
});

describe('getMapMetrics', () => {
  it('measures the nearest enemy by walking around obstacles', () => {
    const map = grid('.....', '~~~~.', '.....');
    const metrics = getMapMetrics(map, [{ x: 0, y: 2 }], [{ x: 0, y: 0 }]);
    expect(metrics.nearestEnemy).toBe(10);
    expect(metrics.routes).toBe(1);
  });

  it('takes the nearest of several enemies', () => {
    const map = grid('.....', '.....', '.....');
    const metrics = getMapMetrics(
      map,
      [{ x: 0, y: 2 }],
      [
        { x: 4, y: 0 },
        { x: 0, y: 0 },
      ],
    );
    expect(metrics.nearestEnemy).toBe(2);
  });

  it('has no nearest enemy when none can be reached, or there are none', () => {
    const map = grid('.....', '~~~~~', '.....');
    expect(getMapMetrics(map, [{ x: 0, y: 2 }], [{ x: 0, y: 0 }]).nearestEnemy).toBeNull();
    expect(getMapMetrics(map, [{ x: 0, y: 2 }], []).nearestEnemy).toBeNull();
  });

  it('counts the share of tiles a unit can stand on', () => {
    const map = grid('..~^', '#.TT');
    expect(getMapMetrics(map, [{ x: 0, y: 0 }], [{ x: 1, y: 1 }]).openShare).toBe(5 / 8);
  });

  it("counts forest within reach of each side's starting tiles", () => {
    const map = grid('T......', '.......', '.......', '.......', '......T', 'T.....T');
    const metrics = getMapMetrics(map, [{ x: 0, y: 4 }], [{ x: 6, y: 0 }]);
    // Player: (0, 5) is 1 step away; (6, 4) and (6, 5) are 6 or more.
    expect(metrics.playerCover).toBe(1);
    // Enemy: none of the forests is within 2 steps of (6, 0).
    expect(metrics.enemyCover).toBe(0);
  });
});

describe('scoreMap', () => {
  it('scores 0 for a map that meets every target', () => {
    expect(scoreMap(MET)).toBe(0);
    expect(scoreMap({ ...MET, nearestEnemy: 1, routes: 3, openShare: 1 })).toBe(0);
  });

  it('scores worse the farther the nearest enemy is past the target', () => {
    const near = scoreMap({ ...MET, nearestEnemy: MET.nearestEnemy! + 1 });
    const far = scoreMap({ ...MET, nearestEnemy: MET.nearestEnemy! + 4 });
    expect(near).toBeGreaterThan(0);
    expect(far).toBeGreaterThan(near);
  });

  it('scores a single lane worse than a far enemy', () => {
    const oneRoute = scoreMap({ ...MET, routes: 1 });
    expect(oneRoute).toBeGreaterThan(scoreMap({ ...MET, nearestEnemy: MET.nearestEnemy! + 2 }));
    expect(scoreMap({ ...MET, routes: 0 })).toBeGreaterThan(oneRoute);
  });

  it('scores a crowded map worse than an open one', () => {
    expect(scoreMap({ ...MET, openShare: 0.5 })).toBeGreaterThan(scoreMap({ ...MET, openShare: 0.7 }));
    expect(scoreMap({ ...MET, openShare: 0.7 })).toBeGreaterThan(0);
  });

  it('scores lopsided cover worse than even cover', () => {
    expect(scoreMap({ ...MET, playerCover: 0, enemyCover: 3 })).toBe(3);
    expect(scoreMap({ ...MET, playerCover: 3, enemyCover: 0 })).toBe(3);
  });

  it('scores an unreachable enemy worse than any reachable map', () => {
    const worstReachable = scoreMap({ nearestEnemy: 30, routes: 1, openShare: 0.3, playerCover: 0, enemyCover: 10 });
    expect(scoreMap({ ...MET, nearestEnemy: null })).toBeGreaterThan(worstReachable);
  });
});
