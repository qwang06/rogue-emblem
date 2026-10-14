// Where on a planned map the fight happens, so the planned generator
// (mapPlan.ts) can put terrain where it does a job: cover where the two
// sides will meet and near each side's start, obstacles out on the flanks
// between routes, where they split the routes apart instead of blocking
// them. Pure: positions in, zones out.
//
// The zones, each tile getting the first that fits:
//   home      — within 2 steps of the deployment zone
//   enemyHome — within 2 steps of the enemy side (route anchors and the
//               path's north end)
//   midfield  — about as far from one side as the other (within a step),
//               where the first clash happens
//   flank     — 2 or more tiles (diagonals included) off every route
//   lane      — anything else: on or beside a route
// Distances are straight steps (no terrain yet when zones are drawn).

import type { Rng } from './combatStats.ts';
import type { Point } from './grid.ts';
import { randomItem } from './rng.ts';

export type Zone = 'home' | 'enemyHome' | 'midfield' | 'flank' | 'lane';

const key = ({ x, y }: Point) => `${x},${y}`;

function stepsTo(p: Point, targets: readonly Point[]): number {
  return Math.min(...targets.map((t) => Math.abs(t.x - p.x) + Math.abs(t.y - p.y)));
}

// Each tile of a `width` x `height` map's zone, as keys "x,y". `routes`
// are every route's tiles, the path included.
export function getZones(
  width: number,
  height: number,
  deploymentZone: readonly Point[],
  enemySide: readonly Point[],
  routes: readonly Point[],
): Map<string, Zone> {
  const zones = new Map<string, Zone>();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = { x, y };
      const home = stepsTo(p, deploymentZone);
      const enemy = stepsTo(p, enemySide);
      const offRoute = Math.min(...routes.map((r) => Math.max(Math.abs(r.x - x), Math.abs(r.y - y))));
      let zone: Zone;
      if (home <= 2) zone = 'home';
      else if (enemy <= 2) zone = 'enemyHome';
      else if (Math.abs(home - enemy) <= 1) zone = 'midfield';
      else if (offRoute >= 2) zone = 'flank';
      else zone = 'lane';
      zones.set(key(p), zone);
    }
  }
  return zones;
}

// Which zones each terrain's patches start in. A terrain with several
// lists takes them in turn, patch by patch (so forests alternate between
// the midfield and each side's start, keeping cover even); a terrain not
// listed starts anywhere.
export const PATCH_ZONES: Readonly<Record<string, readonly (readonly Zone[])[]>> = Object.freeze({
  water: [['flank']],
  mountain: [['flank']],
  forest: [['midfield'], ['home'], ['enemyHome']],
});

// Picks where patch number `index` of `terrain` starts, out of `starts`
// (non-empty): a random one in the zones PATCH_ZONES gives it, or any of
// `starts` if none is in those zones.
export function pickZonedStart(
  zones: ReadonlyMap<string, Zone>,
  terrain: string,
  index: number,
  starts: readonly Point[],
  rng: Rng,
): Point {
  const lists = PATCH_ZONES[terrain];
  if (!lists) return randomItem(rng, starts);
  const wanted = lists[index % lists.length];
  const inZone = starts.filter((p) => wanted.includes(zones.get(key(p))!));
  return randomItem(rng, inZone.length > 0 ? inZone : starts);
}
