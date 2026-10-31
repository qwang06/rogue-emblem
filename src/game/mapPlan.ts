// The planned map generator: decides where the fight happens first, then
// builds the terrain around it. Where the classic generator (mapGen.ts)
// lays one path and grows patches anywhere off it, this one:
//   1. planBattle   — picks the deployment zone (anywhere along the south
//                     row, not just the middle) and an anchor in the north
//                     third for each side route, left and right of it
//   2. carveRoute   — walks a winding route from the deployment zone to
//                     each anchor
//   3. getZones     — marks where the fight happens (mapZones.ts)
//   4. fillTerrain  — lays the dirt path and the rest of the map as the
//                     classic generator does, keeping impassable terrain
//                     clear of every route, so the player always has more
//                     than one way to reach the enemy, but starting each
//                     patch in the zone it's for: forests by turns in the
//                     midfield and near each side's start, water and
//                     mountains out on the flanks
// Pure: the same options and seed always give the same map.

import type { Rng } from './combatStats.ts';
import { createGrid, setTerrain, type Point } from './grid.ts';
import { planArchetype, type MapArchetype } from './mapArchetypes.ts';
import {
  carvePath,
  fillTerrain,
  generateTerrain,
  MAP_GEN_DEFAULTS,
  withoutUndefined,
  type GeneratedTerrain,
  type MapGenOptions,
} from './mapGen.ts';
import { getZones, pickZonedStart } from './mapZones.ts';
import { randomInt, randomItem } from './rng.ts';
import { generateBattlefield } from './battlefields.ts';

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
  const enemySide = [...plan.anchors, path[path.length - 1]];
  const zones = getZones(width, height, plan.deploymentZone, enemySide, [...path, ...sideRoutes.flat()]);
  const terrain = fillTerrain(options, rng, path, sideRoutes.flat(), (kind, index, starts, r) =>
    pickZonedStart(zones, kind, index, starts, r),
  );
  return { ...terrain, plan, routes: sideRoutes };
}

// Builds a map from an archetype's plan (mapArchetypes.ts): lays the plan's
// terrain and buildings, then fills the rest as the planned generator does
// (patches started in their zones, impassable terrain kept off the road and
// routes, nothing on the plan's reserved tiles). The plan stands up its own
// buildings and decides where the fight is, so the fill adds no castle and
// no walled ruins, and it can turn off patches its own terrain stands in for. The map carries the plan's deployment zone, enemy zones
// and seize tile.
export function generateArchetypeTerrain(
  options: MapGenOptions,
  archetype: Exclude<MapArchetype, 'advance'>,
  rng: Rng,
): GeneratedTerrain {
  const { width, height } = options;
  if (width < 6 || height < 6) throw new Error(`A ${archetype} map needs to be at least 6x6`);
  const plan = planArchetype(archetype, width, height, rng);
  const grid = plan.terrain.reduce((g, p) => setTerrain(g, p.x, p.y, p.terrain), createGrid(width, height, 'grass'));
  const routes = plan.routes.flat();
  const zones = getZones(width, height, plan.deploymentZone, plan.enemyZones.flat(), [...plan.path, ...routes]);
  const terrain = fillTerrain(
    { ...options, ...plan.fill, castle: false, ruins: 0 },
    rng,
    plan.path,
    routes,
    (kind, index, starts, r) => pickZonedStart(zones, kind, index, starts, r),
    { grid, reserved: plan.reserved, buildings: plan.buildings },
  );
  return {
    ...terrain,
    deploymentZone: plan.deploymentZone,
    enemyZones: plan.enemyZones,
    ...(plan.seizeTile ? { seizeTile: plan.seizeTile } : {}),
  };
}

// The map from the battlefield generator when `options.generator` names it
// (battlefields.ts; it lays out its own arena whatever the archetype),
// else from `options.archetype`'s plan when it names one other than
// 'advance', else from whichever generator `options.generator` names
// (classic when unset).
export function generateMap(options: MapGenOptions, rng: Rng): GeneratedTerrain {
  const { archetype } = options;
  if (options.generator === 'battlefield') {
    const { width, height, battlefield, obstacles } = { ...MAP_GEN_DEFAULTS, ...withoutUndefined(options) };
    const field = generateBattlefield({ width, height, battlefield, obstacles }, rng);
    return { ...field, buildings: [] };
  }
  if (archetype && archetype !== 'advance') return generateArchetypeTerrain(options, archetype, rng);
  return options.generator === 'planned' ? generatePlannedTerrain(options, rng) : generateTerrain(options, rng);
}
