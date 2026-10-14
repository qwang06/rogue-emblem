// The planned map generator: decides where the fight happens first, then
// builds the terrain around it. Where the classic generator (mapGen.ts)
// lays one path and grows patches anywhere off it, this one:
//   1. planBattle   — picks the deployment zone (anywhere along the south
//                     row, not just the middle) and an anchor in the north
//                     third for each side route, left and right of it
//   2. carveRoute   — walks a winding route from the deployment zone to
//                     each anchor
//   3. fillTerrain  — lays the dirt path and the rest of the map as the
//                     classic generator does, keeping impassable terrain
//                     clear of every route, so the player always has more
//                     than one way to reach the enemy
// Pure: the same options and seed always give the same map.

import type { Rng } from './combatStats.ts';
import type { Point } from './grid.ts';
import {
  carvePath,
  fillTerrain,
  generateTerrain,
  MAP_GEN_DEFAULTS,
  withoutUndefined,
  type GeneratedTerrain,
  type MapGenOptions,
} from './mapGen.ts';
import { randomInt, randomItem } from './rng.ts';

export interface BattlePlan {
  // Three tiles side by side on the south row.
  deploymentZone: Point[];
  // Where each side route heads, in the north third of the map.
  anchors: Point[];
}

// A plan for a `width` x `height` map with `routes` routes north, the path
// included: the deployment zone centered on a random column (a tile in
// from either side, so all three tiles fit), and one anchor per side route
// in the north third, alternating sides of the deployment zone (starting
// on a random side) and at least two columns clear of its middle. A side
// with no room left takes no anchor.
export function planBattle(width: number, height: number, routes: number, rng: Rng): BattlePlan {
  const cx = randomInt(rng, 1, width - 2);
  const deploymentZone = [-1, 0, 1].map((dx) => ({ x: cx + dx, y: height - 1 }));
  const sides: [number, number][] = [
    [0, cx - 2],
    [cx + 2, width - 1],
  ].filter(([from, to]) => from <= to) as [number, number][];
  const first = rng() < 0.5 ? 0 : sides.length - 1;
  const anchors: Point[] = [];
  for (let i = 0; i < routes - 1 && sides.length > 0; i++) {
    const [from, to] = sides[(first + i) % sides.length];
    anchors.push({ x: randomInt(rng, from, to), y: randomInt(rng, 0, Math.floor(height / 3)) });
  }
  return { deploymentZone, anchors };
}

const key = ({ x, y }: Point) => `${x},${y}`;

// A 4-connected route from `from` to `to` on a `width` x `height` map,
// both ends included. Each step moves closer to `to`, except that with
// chance `wobble` it may step sideways instead (never twice running, and
// at most as many times as the route's straight-line length), so it winds
// a little. A route that crosses itself drops the loop.
export function carveRoute(width: number, height: number, from: Point, to: Point, rng: Rng, wobble = 0.35): Point[] {
  const route: Point[] = [from];
  let sideSteps = Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
  let lastWasSide = false;
  const inBounds = ({ x, y }: Point) => x >= 0 && y >= 0 && x < width && y < height;
  while (key(route[route.length - 1]) !== key(to)) {
    const at = route[route.length - 1];
    const closer: Point[] = [];
    if (to.x !== at.x) closer.push({ x: at.x + Math.sign(to.x - at.x), y: at.y });
    if (to.y !== at.y) closer.push({ x: at.x, y: at.y + Math.sign(to.y - at.y) });
    const sideways = [
      { x: at.x + 1, y: at.y },
      { x: at.x - 1, y: at.y },
      { x: at.x, y: at.y + 1 },
      { x: at.x, y: at.y - 1 },
    ].filter((p) => inBounds(p) && !closer.some((c) => key(c) === key(p)) && !route.some((r) => key(r) === key(p)));
    let next: Point;
    if (!lastWasSide && sideSteps > 0 && sideways.length > 0 && rng() < wobble) {
      next = randomItem(rng, sideways);
      sideSteps--;
      lastWasSide = true;
    } else {
      next = randomItem(rng, closer);
      lastWasSide = false;
    }
    const seen = route.findIndex((r) => key(r) === key(next));
    if (seen >= 0) route.length = seen + 1;
    else route.push(next);
  }
  return route;
}

export interface PlannedTerrain extends GeneratedTerrain {
  plan: BattlePlan;
  // The side routes, each from a deployment tile to its anchor.
  routes: Point[][];
}

// Builds a map the planned way (see the top of this file) from the same
// options generateTerrain takes; `routes` sets how many routes lead north.
// The path starts in the middle of the deployment zone, and each side
// route from the deployment tile on its anchor's side.
export function generatePlannedTerrain(options: MapGenOptions, rng: Rng): PlannedTerrain {
  const { width, height, turnChance, routes } = { ...MAP_GEN_DEFAULTS, ...withoutUndefined(options) };
  if (width < 3 || height < 3) throw new Error('A generated map needs to be at least 3x3');
  const plan = planBattle(width, height, routes, rng);
  const [west, middle, east] = plan.deploymentZone;
  const path = carvePath(width, height, rng, turnChance, middle.x);
  const sideRoutes = plan.anchors.map((anchor) =>
    carveRoute(width, height, anchor.x < middle.x ? west : east, anchor, rng, turnChance),
  );
  return { ...fillTerrain(options, rng, path, sideRoutes.flat()), plan, routes: sideRoutes };
}

// The map from whichever generator `options.generator` names (classic
// when unset).
export function generateMap(options: MapGenOptions, rng: Rng): GeneratedTerrain {
  return options.generator === 'planned' ? generatePlannedTerrain(options, rng) : generateTerrain(options, rng);
}
