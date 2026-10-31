// Map archetypes: different plans for where each side starts and how the
// fight is laid out, so a run's maps don't all share one shape. Each plan
// lays down the terrain that makes its shape (a river, ridges, a fort's
// walls), the dirt road and any other routes to keep clear, and where the
// player deploys and the enemies stand. The planned generator
// (generateArchetypeTerrain in mapPlan.ts) then dresses the rest with the
// usual fill, and the checks (mapCheck.ts) and scoring (mapScore.ts) stay
// the same.
//
//   advance    — deploy south, enemy north, side routes between (planBattle
//                in mapPlan.ts; not planned here)
//   crossroads — deploy south; dirt roads cross mid-map, the enemy is split
//                between the west and east edges, and the crossing is the
//                tile to seize
//   ambush     — deploy in the middle; enemies close in from two or three
//                edges
//   gauntlet   — deploy in a south corner; two mountain ridges fold the way
//                north into one long switchback road, with a forest gap in
//                one ridge as a risky shortcut; the enemy holds the north
//                edge
//   islands    — a river splits the map; two or three bridges and fords are
//                the only crossings, and on wide maps a channel splits the
//                far bank into two islands
//   fortress   — a walled fort at the north end with one or two gates in
//                its south wall; the enemy holds the inside, and the fort
//                building in it is the tile to seize
//   arena      — the side view's battlefield: deploy down the west edge,
//                the enemy holds the east half, and a dirt road (plus a
//                second clear route on maps 5 or more rows deep) runs
//                between; the road's east end is the tile to seize
// Pure: the same size and Rng always give the same plan.

import type { BuildingPlacement } from './buildings.ts';
import type { Rng } from './combatStats.ts';
import type { Point } from './grid.ts';
import { randomInt, shuffle } from './rng.ts';

export type MapArchetype = 'advance' | 'crossroads' | 'ambush' | 'gauntlet' | 'islands' | 'fortress' | 'arena';

export const MAP_ARCHETYPES: readonly MapArchetype[] = Object.freeze([
  'advance',
  'crossroads',
  'ambush',
  'gauntlet',
  'islands',
  'fortress',
  'arena',
]);

// A tile of terrain a plan lays before the fill.
export interface PlacedTerrain extends Point {
  terrain: string;
}

export interface ArchetypePlan {
  // Where the player deploys: three tiles side by side.
  deploymentZone: Point[];
  // Areas the enemies are dealt into, in turn (see pickZonedEnemyTiles).
  enemyZones: Point[][];
  // The dirt road: one tile wide, never in a 2x2 block.
  path: Point[];
  // Other routes the fill keeps impassable terrain off (not dirt).
  routes: Point[][];
  // Terrain laid before the fill: rivers, bridges, ridges, walls, gates.
  terrain: PlacedTerrain[];
  // Tiles the fill places nothing on.
  reserved: Point[];
  // Buildings the plan stands up itself.
  buildings: BuildingPlacement[];
  // The tile a seize objective marks, if the plan has one in mind.
  seizeTile?: Point;
  // Patch counts the plan overrides because its own terrain already does
  // their job (a gauntlet's ridges are its mountains, an islands map's
  // river its water).
  fill?: { lakes?: number; mountains?: number };
}

const key = ({ x, y }: Point) => `${x},${y}`;

// Three tiles side by side on row `y`, centered on column `x`.
function deployRow(x: number, y: number): Point[] {
  return [-1, 0, 1].map((dx) => ({ x: x + dx, y }));
}

// Every tile from (x0, y0) to (x1, y1), both included.
export function rect(x0: number, y0: number, x1: number, y1: number): Point[] {
  const tiles: Point[] = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) tiles.push({ x, y });
  }
  return tiles;
}

// `tiles` and every tile around them (diagonals included) on a `width` x
// `height` map, without repeats.
function withNeighbors(tiles: readonly Point[], width: number, height: number): Point[] {
  const seen = new Map<string, Point>();
  for (const { x, y } of tiles) {
    for (const p of rect(x - 1, y - 1, x + 1, y + 1)) {
      if (p.x >= 0 && p.y >= 0 && p.x < width && p.y < height) seen.set(key(p), p);
    }
  }
  return [...seen.values()];
}

// Whether any four of `tiles` make a 2x2 block (which the dirt autotile
// draws with holes).
export function hasBlock(tiles: readonly Point[]): boolean {
  const set = new Set(tiles.map(key));
  return tiles.some(
    ({ x, y }) =>
      set.has(key({ x: x + 1, y })) && set.has(key({ x, y: y + 1 })) && set.has(key({ x: x + 1, y: y + 1 })),
  );
}

// A road from `from` to `to`, both included, that only ever steps toward
// `to`: on each step it keeps going the way it went last unless `turnChance`
// says to switch (or that way is done). A road that never steps back can't
// fold into a 2x2 block.
export function carveRoad(from: Point, to: Point, rng: Rng, turnChance = 0.35): Point[] {
  const road = [from];
  let at = from;
  let horizontal = rng() < 0.5;
  while (at.x !== to.x || at.y !== to.y) {
    if (at.x === to.x) horizontal = false;
    else if (at.y === to.y) horizontal = true;
    else if (rng() < turnChance) horizontal = !horizontal;
    at = horizontal ? { x: at.x + Math.sign(to.x - at.x), y: at.y } : { x: at.x, y: at.y + Math.sign(to.y - at.y) };
    road.push(at);
  }
  return road;
}

// A straight line from `from` to `to` (same row or column), both included.
function line(from: Point, to: Point): Point[] {
  return carveRoad(from, to, () => 1);
}

function dedupe(tiles: readonly Point[]): Point[] {
  return [...new Map(tiles.map((p) => [key(p), p])).values()];
}

// Crossroads: roads from the deployment zone and from the west, east and
// north edges meet at a crossing in the middle columns of the north half,
// and the enemy waits on the west and east flanks, level with it. Each leg leaves the
// crossing straight for two tiles, then winds; if the legs would ever touch
// in a 2x2 block they're laid straight instead.
export function planCrossroads(width: number, height: number, rng: Rng): ArchetypePlan {
  const deployX = randomInt(rng, 1, width - 2);
  const center = {
    x: randomInt(rng, Math.floor(width / 2) - 1, Math.ceil(width / 2)),
    y: randomInt(rng, Math.max(1, Math.floor(height / 3)), Math.floor(height / 2)),
  };
  const ends = {
    south: { x: deployX, y: height - 1 },
    west: { x: 0, y: randomInt(rng, Math.max(0, center.y - 1), center.y + 1) },
    east: { x: width - 1, y: randomInt(rng, Math.max(0, center.y - 1), center.y + 1) },
    north: { x: randomInt(rng, center.x - 1, center.x + 1), y: 0 },
  };
  const steps = { south: [0, 1], west: [-1, 0], east: [1, 0], north: [0, -1] } as const;
  const legs = (Object.keys(ends) as (keyof typeof ends)[]).flatMap((side) => {
    const [dx, dy] = steps[side];
    const end = ends[side];
    let at = { x: center.x + dx, y: center.y + dy };
    const leg = [at];
    const along = dx === 0 ? end.y !== at.y : end.x !== at.x;
    if (along) {
      at = { x: at.x + dx, y: at.y + dy };
      leg.push(at);
    }
    return [...leg, ...carveRoad(at, end, rng).slice(1)];
  });
  let path = dedupe([center, ...legs]);
  if (hasBlock(path)) {
    // Straight legs: a plain cross through the crossing, plus a jog from
    // the south leg's foot over to the deployment zone along the bottom row.
    path = dedupe([
      ...line({ x: 0, y: center.y }, { x: width - 1, y: center.y }),
      ...line({ x: center.x, y: 0 }, { x: center.x, y: height - 1 }),
      ...line({ x: center.x, y: height - 1 }, ends.south),
    ]);
  }
  const deploymentZone = deployRow(deployX, height - 1);
  // Each flank: the two outer columns, two rows either side of the crossing.
  const flank = (x0: number, x1: number) => rect(x0, Math.max(0, center.y - 2), x1, Math.min(height - 3, center.y + 2));
  return {
    deploymentZone,
    enemyZones: [flank(0, 1), flank(width - 2, width - 1)],
    path,
    routes: [],
    terrain: [],
    reserved: [...withNeighbors(deploymentZone, width, height), center],
    buildings: [],
    seizeTile: center,
  };
}

type Edge = 'north' | 'south' | 'west' | 'east';

// Ambush: the player starts in the middle of the map and the enemy waits
// on two or three of its edges, one road (dirt) or route out to each.
export function planAmbush(width: number, height: number, rng: Rng): ArchetypePlan {
  const cx = randomInt(rng, Math.floor((width - 1) / 2), Math.ceil((width - 1) / 2));
  const cy = randomInt(rng, Math.floor((height - 1) / 2), Math.ceil((height - 1) / 2));
  const deploymentZone = deployRow(cx, cy);
  const edges = shuffle(rng, ['north', 'south', 'west', 'east'] as Edge[]).slice(0, randomInt(rng, 2, 3));
  const bands: Record<Edge, Point[]> = {
    north: rect(0, 0, width - 1, 0),
    south: rect(0, height - 1, width - 1, height - 1),
    west: rect(0, 0, 0, height - 1),
    east: rect(width - 1, 0, width - 1, height - 1),
  };
  const roads = edges.map((edge) => {
    const start = {
      north: { x: cx, y: cy - 1 },
      south: { x: cx, y: cy + 1 },
      west: { x: cx - 2, y: cy },
      east: { x: cx + 2, y: cy },
    }[edge];
    const end = {
      north: { x: randomInt(rng, 1, width - 2), y: 0 },
      south: { x: randomInt(rng, 1, width - 2), y: height - 1 },
      west: { x: 0, y: randomInt(rng, 1, height - 2) },
      east: { x: width - 1, y: randomInt(rng, 1, height - 2) },
    }[edge];
    return carveRoad(start, end, rng);
  });
  return {
    deploymentZone,
    enemyZones: edges.map((edge) => bands[edge]),
    path: roads[0],
    routes: roads.slice(1),
    terrain: [],
    reserved: withNeighbors(deploymentZone, width, height),
    buildings: [],
  };
}

// Gauntlet: the player starts in a south corner; a mountain ridge three
// rows up runs from that side almost to the far side, and (on maps 8 or more
// tall) a second ridge at row 2 runs back the other way, so the road
// switchbacks north between them. One ridge tile is a forest gap: a slow,
// single-file shortcut. The enemy holds the rows north of the top ridge.
export function planGauntlet(width: number, height: number, rng: Rng): ArchetypePlan {
  const west = rng() < 0.5;
  const fx = (x: number) => (west ? x : width - 1 - x);
  const at = (x: number, y: number) => ({ x: fx(x), y });
  const low = height - 3;
  const high = low - 2 >= 3 ? 2 : null;
  const top = high ?? low;

  // Each ridge stops short of the road's turn by a tile or two, so the
  // two don't line up like walls.
  const lowEnd = width - 3 - randomInt(rng, 0, 1);
  const highStart = 2 + randomInt(rng, 0, 1);
  const ridges: Point[] = rect(0, low, lowEnd, low).map((p) => at(p.x, p.y));
  if (high !== null) ridges.push(...rect(highStart, high, width - 1, high).map((p) => at(p.x, p.y)));
  const gapOnHigh = high !== null && rng() < 0.5;
  const gap = gapOnHigh ? at(randomInt(rng, highStart + 1, width - 2), high!) : at(randomInt(rng, 2, lowEnd - 1), low);

  const corridor = high !== null ? randomInt(rng, high + 1, low - 1) : 0;
  const path = dedupe([
    ...line(at(1, height - 2), at(width - 2, height - 2)),
    ...line(at(width - 2, height - 3), at(width - 2, corridor)),
    ...(high !== null
      ? [...line(at(width - 3, corridor), at(1, corridor)), ...line(at(1, corridor - 1), at(1, 0))]
      : []),
  ]);
  const deploymentZone = [at(0, height - 1), at(1, height - 1), at(2, height - 1)].sort((a, b) => a.x - b.x);
  return {
    deploymentZone,
    enemyZones: [rect(0, 0, width - 1, top - 1)],
    path,
    routes: [],
    terrain: ridges.map((p) => ({ ...p, terrain: key(p) === key(gap) ? 'forest' : 'mountain' })),
    reserved: [...withNeighbors(deploymentZone, width, height), ...withNeighbors([gap], width, height)],
    buildings: [],
    seizeTile: path[path.length - 1],
    fill: { mountains: 0 },
  };
}

// Islands: a river two tiles deep (one on maps under 8 tall) runs west to
// east across the middle, wavering a row up or down. Two or three columns
// cross it, each all bridge or all ford; the dirt road takes the first,
// which is always a bridge. On maps 8 or more wide, half the time a channel
// two tiles wide runs north from the river to the top edge, splitting the
// far bank into two islands joined by one bridge, with a crossing on each
// side of it.
export function planIslands(width: number, height: number, rng: Rng): ArchetypePlan {
  const depth = height >= 8 ? 2 : 1;
  const base = randomInt(rng, Math.max(2, Math.floor(height / 2) - 2), Math.floor(height / 2) - 1);
  // A channel two tiles wide (on maps 8 or more wide, half the time), at
  // columns `channel` and `channel + 1`.
  const channel = width >= 8 && rng() < 0.5 ? randomInt(rng, 3, width - 5) : null;
  const inChannel = (x: number) => channel !== null && (x === channel || x === channel + 1);
  // The crossings: two or three columns at least two apart, one on each
  // side of any channel.
  const pick = (from: number, to: number, apart: readonly number[] = []) => {
    const columns = rect(from, 0, to, 0)
      .map((p) => p.x)
      .filter((x) => !inChannel(x) && apart.every((c) => Math.abs(x - c) >= 2));
    return columns.length > 0 ? columns[randomInt(rng, 0, columns.length - 1)] : null;
  };
  const crossings: number[] =
    channel !== null ? [pick(1, channel - 1)!, pick(channel + 2, width - 2)!] : [pick(1, width - 2)!];
  if (channel === null) crossings.push(pick(1, width - 2, crossings)!);
  if (width >= 8 && rng() < 0.5) {
    const spare = pick(1, width - 2, crossings);
    if (spare !== null) crossings.push(spare);
  }

  // The river's top row in each column: `base`, or a row lower. It holds
  // each row for at least two columns (so the bank never has a one-tile
  // notch), and stays level across each crossing and its neighbors (so a
  // bridge or ford never sits on a bend) and from the channel's west side
  // to just past it (so the channel meets a straight bank).
  const tops: number[] = [];
  let offset = rng() < 0.5 ? 0 : 1;
  let held = 0;
  for (let x = 0; x < width; x++) {
    const steady =
      x === width - 1 ||
      crossings.some((c) => x === c || x === c + 1) ||
      (channel !== null && x >= channel && x <= channel + 2);
    if (held >= 2 && !steady && rng() < 0.4) {
      offset = 1 - offset;
      held = 0;
    }
    tops.push(base + offset);
    held++;
  }
  const bottom = (x: number) => tops[x] + depth - 1;

  const order = shuffle(rng, crossings);

  const terrain: PlacedTerrain[] = [];
  for (let x = 0; x < width; x++) {
    const crossing = order.indexOf(x);
    const kind = crossing < 0 ? 'water' : crossing === 0 || rng() < 0.5 ? 'bridge' : 'ford';
    for (let y = tops[x]; y <= bottom(x); y++) terrain.push({ x, y, terrain: kind });
  }
  let channelBridge: Point | null = null;
  if (channel !== null) {
    channelBridge = { x: channel, y: randomInt(rng, 0, tops[channel] - 1) };
    for (const x of [channel, channel + 1]) {
      for (let y = 0; y < tops[x]; y++) terrain.push({ x, y, terrain: y === channelBridge.y ? 'bridge' : 'water' });
    }
  }

  // Rows wholly south (north) of the river, so a road along them stays dry.
  const southRow = Math.max(...tops.map((_, x) => bottom(x))) + 1;
  const northRow = Math.min(...tops) - 1;
  const deployX = randomInt(rng, 1, width - 2);
  const deploymentZone = deployRow(deployX, height - 1);
  const sameSide = (x: number) =>
    channel === null
      ? rect(0, 0, width - 1, 0)
      : rect(x < channel ? 0 : channel + 2, 0, x < channel ? channel - 1 : width - 1, 0);
  // Each crossing's road: winding from the deployment zone to the dry row
  // south of the river, straight up to its bridgehead; then from its far
  // bridgehead straight up to the dry row north of the river and winding
  // on to the top edge, staying on its own side of any channel.
  const crossingRoads = order.map((x) => {
    const south = carveRoad({ x: deployX, y: height - 1 }, { x, y: southRow }, rng);
    for (let y = southRow - 1; y > bottom(x); y--) south.push({ x, y });
    const north: Point[] = [];
    for (let y = tops[x] - 1; y > northRow; y--) north.push({ x, y });
    north.push(...carveRoad({ x, y: northRow }, { x: shuffle(rng, sameSide(x))[0].x, y: 0 }, rng));
    return { south, north };
  });

  const northBank = (from: number, to: number) => rect(from, 0, to, height - 1).filter((p) => p.y < tops[p.x]);
  const enemyZones =
    channel === null ? [northBank(0, width - 1)] : [northBank(0, channel - 1), northBank(channel + 2, width - 1)];
  const [road, ...others] = crossingRoads;
  const bridgeheads = order.flatMap((x) => [
    { x, y: tops[x] - 1 },
    { x, y: bottom(x) + 1 },
  ]);
  if (channelBridge) bridgeheads.push({ x: channel! - 1, y: channelBridge.y }, { x: channel! + 2, y: channelBridge.y });
  return {
    deploymentZone,
    enemyZones,
    path: dedupe([...road.south, ...road.north]),
    routes: others.flatMap(({ south, north }) => [south, north]),
    terrain,
    reserved: [...withNeighbors(deploymentZone, width, height), ...bridgeheads.filter((p) => p.y >= 0 && p.y < height)],
    buildings: [],
    fill: { lakes: 0 },
  };
}

// Fortress: a ring of wall five or six tiles wide (up to five tall) at the
// north end, a tile in from the sides (and from the top on maps 8 or more
// tall), with one or two gates in its south wall and a fort inside against
// its back wall. The enemy holds the inside; a road runs from the
// deployment zone through each gate and on inside to the fort.
export function planFortress(width: number, height: number, rng: Rng): ArchetypePlan {
  const fw = Math.min(width - 2, randomInt(rng, 5, 6));
  // A tile in from the top edge where there's room, since a wall along it
  // draws thick.
  const fy = height >= 8 ? 1 : 0;
  const fh = Math.max(3, Math.min(height - 3 - fy, randomInt(rng, 4, 5)));
  const fx = randomInt(rng, 1, width - 1 - fw);
  const gateRow = fy + fh - 1;
  const inner = rect(fx + 1, fy + 1, fx + fw - 2, gateRow - 1);
  // A second gate keeps two wall tiles from the first, so no lone stub of
  // wall stands between them.
  const first = randomInt(rng, fx + 1, fx + fw - 2);
  const others = rect(fx + 1, gateRow, fx + fw - 2, gateRow).filter((p) => Math.abs(p.x - first) >= 3);
  let gates = [first, ...(others.length > 0 && rng() < 0.5 ? [shuffle(rng, others)[0].x] : [])];
  const fort: BuildingPlacement = { x: randomInt(rng, fx + 1, fx + fw - 2), y: fy + 1, building: 'fort' };

  // A dirt road to each gate from the deployment zone, carrying on inside
  // up to the fort's door. If two gates' roads would touch in a 2x2 block,
  // the fort keeps just the first gate.
  const deployX = randomInt(rng, 1, width - 2);
  const deploymentZone = deployRow(deployX, height - 1);
  const door = { x: fort.x, y: Math.min(fort.y + 1, gateRow - 1) };
  const roads = gates.map((x) =>
    [
      ...carveRoad({ x: deployX, y: height - 1 }, { x, y: gateRow + 1 }, rng),
      ...carveRoad({ x, y: gateRow - 1 }, door, rng),
    ].filter((p) => p.x !== fort.x || p.y !== fort.y),
  );
  let path = dedupe(roads.flat());
  if (hasBlock(path)) {
    gates = [first];
    path = roads[0];
  }

  const terrain: PlacedTerrain[] = rect(fx, fy, fx + fw - 1, gateRow)
    .filter((p) => p.x === fx || p.x === fx + fw - 1 || p.y === fy || p.y === gateRow)
    .map((p) => ({ ...p, terrain: p.y === gateRow && gates.includes(p.x) ? 'gate' : 'wall' }));
  return {
    deploymentZone,
    enemyZones: [inner],
    path,
    routes: [],
    terrain,
    reserved: [
      ...rect(fx, fy, fx + fw - 1, gateRow),
      ...gates.map((x) => ({ x, y: gateRow + 1 })),
      ...withNeighbors(deploymentZone, width, height),
    ],
    buildings: [fort],
    seizeTile: { x: fort.x, y: fort.y },
  };
}

// Arena: the side view's battlefield, seen from the south, so the two sides
// face each other across it. The player deploys in three tiles down the
// west edge, around a middle row; the enemy is dealt into the north and
// south halves of the east half, so on a big field the fight still starts
// within a turn's walk. A dirt road runs from the deployment
// zone to the east edge, and on maps 5 or more rows deep a second route
// (kept clear, not dirt) runs along the other half, so there's a way
// around whatever the fill grows.
export function planArena(width: number, height: number, rng: Rng): ArchetypePlan {
  const cy = randomInt(rng, 1, height - 2);
  const deploymentZone = rect(0, cy - 1, 0, cy + 1);
  const path = carveRoad({ x: 0, y: cy }, { x: width - 1, y: randomInt(rng, 1, height - 2) }, rng);
  const routes: Point[][] = [];
  if (height >= 5) {
    // Along the half the deployment zone leaves more room in.
    const y = cy < height / 2 ? height - 1 : 0;
    routes.push(carveRoad({ x: 1, y }, { x: width - 1, y: randomInt(rng, 0, height - 1) }, rng));
  }
  const east = width - Math.max(2, Math.floor(width / 2));
  const middle = Math.floor(height / 2);
  return {
    deploymentZone,
    enemyZones: [rect(east, 0, width - 1, middle - 1), rect(east, middle, width - 1, height - 1)],
    path,
    routes,
    terrain: [],
    reserved: withNeighbors(deploymentZone, width, height),
    buildings: [],
    seizeTile: path[path.length - 1],
    fill: { mountains: 0 },
  };
}

const PLANNERS: Record<Exclude<MapArchetype, 'advance'>, (width: number, height: number, rng: Rng) => ArchetypePlan> = {
  crossroads: planCrossroads,
  ambush: planAmbush,
  gauntlet: planGauntlet,
  islands: planIslands,
  fortress: planFortress,
  arena: planArena,
};

// The plan for `archetype` (any but 'advance') on a `width` x `height` map.
export function planArchetype(
  archetype: Exclude<MapArchetype, 'advance'>,
  width: number,
  height: number,
  rng: Rng,
): ArchetypePlan {
  return PLANNERS[archetype](width, height, rng);
}
