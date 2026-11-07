// Rivers on a Warband realm: a few streams that rise at the foot of a
// range and wind down to a lake, or off the map's edge when no lake is
// in reach. They are drawn on the parchment map (realmInk.ts) and don't
// change the land or the roads: where a river crosses a road the map shows
// a bridge. Pure: the same land and Rng sequence always give the same
// rivers.

import type { Rng } from '../../combatStats.ts';
import type { Point } from '../../grid.ts';
import { landAt, type RealmLand } from './realmTerrain.ts';

export const RIVER_RULES = Object.freeze({
  // One river for every this many columns of the map, from one to four.
  everyColumns: 32,
  // A river shorter than this many tiles is dropped; one this long gives up.
  minLength: 6,
  maxLength: 80,
  // How far a river wanders: the random cost (in tiles) added to each step
  // toward its end, so it meanders instead of running straight, and the
  // cost of turning, so it bends in curves rather than jittering.
  meander: 1.1,
  turnCost: 0.7,
  // Extra cost to step onto a road tile: crossing one is fine, following
  // one is not; and for this many steps after a crossing, no road at all,
  // so a river doesn't wind back and forth over the same road.
  roadCost: 1.5,
  afterCrossing: 4,
  // A lake is a river's end when it's at least this far from its source.
  lakeFrom: 6,
  // Two rivers' sources keep this many tiles apart.
  spacing: 10,
  // How many sources to try before giving up on another river.
  tries: 40,
});

// The rivers for `land`, each as its tiles from source to mouth: the first
// tile is a mountain (the river comes out from under the range), the rest
// open ground, the last water or a tile on the map's edge. Rivers keep
// off the sites' tiles and the ones next to them, off each other, and
// never follow a road for more than one tile.
export function layRivers(
  land: RealmLand,
  sites: readonly Point[],
  roadTiles: ReadonlySet<string>,
  rng: Rng,
): Point[][] {
  const rules = RIVER_RULES;
  const key = (x: number, y: number) => `${x},${y}`;
  const nearSites = new Set<string>();
  for (const site of sites)
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) nearSites.add(key(site.x + dx, site.y + dy));
  const water: Point[] = [];
  for (let y = 0; y < land.height; y++)
    for (let x = 0; x < land.width; x++) if (landAt(land, x, y) === 'water') water.push({ x, y });

  // Where a river may start: a mountain tile with open ground beside it.
  const sources: Point[] = [];
  for (let y = 0; y < land.height; y++) {
    for (let x = 0; x < land.width; x++) {
      if (landAt(land, x, y) !== 'mountain') continue;
      const open = STEPS.some(([dx, dy]) => {
        const terrain = landAt(land, x + dx, y + dy);
        return (
          terrain !== undefined && terrain !== 'mountain' && terrain !== 'water' && !nearSites.has(key(x + dx, y + dy))
        );
      });
      if (open) sources.push({ x, y });
    }
  }

  const count = Math.min(4, Math.max(1, Math.round(land.width / rules.everyColumns)));
  const taken = new Set<string>();
  const rivers: Point[][] = [];
  const used: Point[] = [];
  for (let attempt = 0; attempt < rules.tries && rivers.length < count && sources.length > 0; attempt++) {
    const source = sources[Math.floor(rng() * sources.length)];
    if (used.some((p) => Math.abs(p.x - source.x) + Math.abs(p.y - source.y) < rules.spacing)) continue;
    const river = flow(land, source, water, nearSites, roadTiles, taken, rng);
    if (!river) continue;
    rivers.push(river);
    used.push(source);
    for (const p of river) for (const [dx, dy] of [[0, 0], ...STEPS]) taken.add(key(p.x + dx, p.y + dy));
  }
  return rivers;
}

const STEPS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

// One river from `source`: it heads for the nearest lake far enough away,
// else the nearest edge of the map, one tile at a time, each step the
// neighbor nearest its end plus a random nudge, never a mountain, a tile
// by a site, a tile another river took, or one it has been on. Null when
// it gets nowhere, or would run along a road.
function flow(
  land: RealmLand,
  source: Point,
  water: readonly Point[],
  nearSites: ReadonlySet<string>,
  roadTiles: ReadonlySet<string>,
  taken: ReadonlySet<string>,
  rng: Rng,
): Point[] | null {
  const rules = RIVER_RULES;
  const key = (p: Point) => `${p.x},${p.y}`;
  const away = (p: Point) => Math.abs(p.x - source.x) + Math.abs(p.y - source.y);
  let target: Point | null = null;
  for (const cell of water) if (away(cell) >= rules.lakeFrom && (!target || away(cell) < away(target))) target = cell;
  const toEdge = !target;
  if (!target) {
    const edges = [
      { x: source.x, y: 0 },
      { x: source.x, y: land.height - 1 },
      { x: 0, y: source.y },
      { x: land.width - 1, y: source.y },
    ];
    target = edges.reduce((best, edge) => (away(edge) < away(best) ? edge : best));
  }
  const end = target;
  const visited = new Set<string>([key(source)]);
  const river: Point[] = [source];
  let current = source;
  let sinceRoad: number = rules.afterCrossing;
  let heading: readonly [number, number] | null = null;
  while (river.length < rules.maxLength) {
    if (river.length > 1) {
      const terrain = landAt(land, current.x, current.y);
      if (terrain === 'water') break;
      if (
        toEdge &&
        (current.x === 0 || current.y === 0 || current.x === land.width - 1 || current.y === land.height - 1)
      )
        break;
    }
    let next: Point | null = null;
    let best = Infinity;
    for (const [dx, dy] of STEPS) {
      const p = { x: current.x + dx, y: current.y + dy };
      const k = key(p);
      const terrain = landAt(land, p.x, p.y);
      if (terrain === undefined || terrain === 'mountain' || visited.has(k) || nearSites.has(k) || taken.has(k))
        continue;
      if (roadTiles.has(k) && sinceRoad < rules.afterCrossing) continue;
      const turned = heading !== null && (heading[0] !== dx || heading[1] !== dy);
      const score =
        Math.hypot(p.x - end.x, p.y - end.y) +
        rng() * rules.meander +
        (turned ? rules.turnCost : 0) +
        (roadTiles.has(k) ? rules.roadCost : 0);
      if (score < best) {
        best = score;
        next = p;
      }
    }
    if (!next) return null;
    visited.add(key(next));
    river.push(next);
    heading = [next.x - current.x, next.y - current.y];
    current = next;
    sinceRoad = roadTiles.has(key(next)) ? 0 : sinceRoad + 1;
  }
  const last = river[river.length - 1];
  const arrived =
    landAt(land, last.x, last.y) === 'water' ||
    (toEdge && (last.x === 0 || last.y === 0 || last.x === land.width - 1 || last.y === land.height - 1));
  if (!arrived || river.length < rules.minLength) return null;
  for (let i = 1; i < river.length; i++)
    if (roadTiles.has(key(river[i - 1])) && roadTiles.has(key(river[i]))) return null;
  return river;
}

// Where `river` crosses a road: each of its tiles (not its source or
// mouth) that is a road tile, with whether the river runs north–south
// there (so a bridge across it lies east–west).
export function riverCrossings(
  river: readonly Point[],
  roadTiles: ReadonlySet<string>,
): { tile: Point; northSouth: boolean }[] {
  const crossings: { tile: Point; northSouth: boolean }[] = [];
  for (let i = 1; i < river.length - 1; i++) {
    const tile = river[i];
    if (!roadTiles.has(`${tile.x},${tile.y}`)) continue;
    const before = river[i - 1];
    const after = river[i + 1];
    crossings.push({ tile, northSouth: Math.abs(after.y - before.y) >= Math.abs(after.x - before.x) });
  }
  return crossings;
}
