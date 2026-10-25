// A Warband run's realm: the big map the warband travels across, from its
// camp in the west to the Warlord's Hold in the east. Sites stand in
// columns by depth (stops from the start), joined by roads that only lead
// east, so the player picks a route: battlefields, villages to defend (and
// recruit from), forts, elite lairs that pay a relic, towns with a merchant
// and a free rest, shrines that grant a blessing without a fight, and
// waysides where something happens (events.ts). Each site plays a region
// (realmRegions.ts) that suits the land around it and its depth.
//
// The realm is rebuilt from the run's seed and the region settings
// whenever it's needed (getRealm caches it), so a run saves only the route
// it took. Pure: the same seed and settings always give the same realm.

import type { BuildingKind, BuildingPlacement } from '../../buildings.ts';
import type { Rng } from '../../combatStats.ts';
import { createGrid, type Grid, type Point } from '../../grid.ts';
import { createSeededRng, randomInt, shuffle } from '../../rng.ts';
import type { BuildingPaletteName } from '../../tileset.ts';
import type { RegionSettings } from '../regions.ts';
import { nameRealm, nameSite } from './realmNames.ts';
import { detectBiome, pickSiteRegion } from './realmRegions.ts';
import { carveRoad, linkColumns } from './realmRoads.ts';
import { clearSpecks, generateRealmLand, LAND_RULES, landAt, setLand, type RealmLand } from './realmTerrain.ts';

// What stands at a site, which says what happens there:
//   'home'    the warband's starting camp (nothing happens)
//   'battle'  a battle
//   'village' a battle with a villager fighting alongside as a guest, who
//             can be recruited after
//   'fort'    a harder battle (enemies a level up) that pays double gold
//   'elite'   a harder battle (enemies with elite affixes, elites.ts) whose
//             reward pick is a pick of relics
//   'town'    no battle: the merchant, and a free rest
//   'shrine'  no battle: a free reward pick (a blessing)
//   'event'   no battle: a wayside event, a short choice (events.ts)
//   'hold'    the final battle; winning it wins the run
export type SiteKind = 'home' | 'battle' | 'village' | 'fort' | 'elite' | 'town' | 'shrine' | 'event' | 'hold';

// The kinds where the warband fights.
export const BATTLE_SITES: ReadonlySet<SiteKind> = new Set(['battle', 'village', 'fort', 'elite', 'hold']);

// The land around a site (see detectBiome).
export type Biome = 'meadow' | 'lake' | 'forest' | 'hills';

export interface Site extends Point {
  // Unique on the realm: `<depth>-<row>`, e.g. "3-1".
  id: string;
  name: string;
  kind: SiteKind;
  // Stops from the start: home is 0, the Hold is the realm's depth.
  depth: number;
  biome: Biome;
  // The index of the region (in the settings' regions) the site plays,
  // and how many levels its enemies are shifted by (see realmRegions.ts).
  region: number;
  levelOffset: number;
}

export interface Road {
  // Site ids: `from` is the western end, at one depth less than `to`.
  from: string;
  to: string;
  // The road's tiles between the two sites, west to east.
  path: readonly Point[];
}

export interface Realm {
  seed: number;
  name: string;
  // The Hold's depth: the run's final stage.
  depth: number;
  grid: Grid;
  sites: readonly Site[];
  roads: readonly Road[];
  buildings: readonly BuildingPlacement[];
  palette: BuildingPaletteName;
}

// The map's size: four columns per stop, with a margin, and this tall.
export const REALM_COLUMN_SPACING = 4;
export const REALM_HEIGHT = 18;
const REALM_MARGIN = 2;

// The palette every building on the realm is drawn in.
export const REALM_PALETTE: BuildingPaletteName = 'a-orange';

// How often each kind appears at an ordinary depth (3 and on), as weights.
// Forts only appear from FORT_FROM on, and a depth has at most one each of
// a town, a shrine, an elite lair and a wayside event.
export const SITE_WEIGHTS: Readonly<Partial<Record<SiteKind, number>>> = Object.freeze({
  battle: 38,
  village: 22,
  town: 4,
  shrine: 5,
  fort: 12,
  elite: 9,
  event: 12,
});
export const FORT_FROM = 4;
const ONE_PER_DEPTH: ReadonlySet<SiteKind> = new Set(['town', 'shrine', 'elite', 'event']);
// Every this many depths there's at least one town to reach.
export const TOWN_EVERY = 3;

// The building each kind of site shows on its own tile (battlefields show
// none); towns, villages and the Hold add a few more around it.
const SITE_BUILDINGS: Readonly<Partial<Record<SiteKind, BuildingKind>>> = {
  home: 'camp',
  village: 'farm',
  fort: 'fort',
  elite: 'tower',
  town: 'house',
  shrine: 'temple',
  event: 'fountain',
  hold: 'castle',
};
const SITE_EXTRAS: Readonly<Partial<Record<SiteKind, readonly BuildingKind[]>>> = {
  town: ['windmill', 'house'],
  village: ['house'],
  hold: ['tower', 'tower'],
};

// The depth of the realm for `settings`: its final stage, else one stop
// per region.
export function getRealmDepth(settings: RegionSettings): number {
  return Math.max(3, settings.finalStage ?? settings.regions.length);
}

// The realm for a run of `seed` with `settings` (see the top of this file).
export function generateRealm(seed: number, settings: RegionSettings): Realm {
  const rng = createSeededRng((seed ^ 0x7265616c) >>> 0);
  const depth = getRealmDepth(settings);
  const width = depth * REALM_COLUMN_SPACING + REALM_MARGIN * 2 + 1;
  const height = REALM_HEIGHT;
  const land = generateRealmLand(width, height, rng);
  const columns = layOutColumns(depth, height, rng);
  const kinds = pickKinds(
    columns.map((column) => column.length),
    rng,
  );

  // Sites stand on open ground: clear each site's tile and the tiles next
  // to it of water and mountains.
  for (const column of columns) {
    for (const { x, y } of column) {
      for (const [dx, dy] of [
        [0, 0],
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const terrain = landAt(land, x + dx, y + dy);
        if (terrain === 'water' || terrain === 'mountain' || (dx === 0 && dy === 0))
          setLand(land, x + dx, y + dy, 'grass');
      }
    }
  }

  clearSpecks(land, 'water', LAND_RULES.minLake);

  const sitePoints = columns.flat();
  const roads: Road[] = [];
  for (let d = 0; d < depth; d++) {
    for (const [i, j] of linkColumns(columns[d], columns[d + 1], rng)) {
      const from = columns[d][i];
      const to = columns[d + 1][j];
      roads.push({ from: siteId(d, i), to: siteId(d + 1, j), path: layRoad(land, from, to, sitePoints) });
    }
  }

  // Every site is a stop on its roads: its tile is road too.
  for (const { x, y } of sitePoints) setLand(land, x, y, 'dirt');

  const taken = new Set<string>();
  const sites: Site[] = columns.flatMap((column, d) =>
    column.map((point, i) => {
      const kind = kinds[d][i];
      const biome = detectBiome(land, point.x, point.y);
      const { region, levelOffset } = pickSiteRegion(settings, d, depth, kind, biome, rng);
      const name = kind === 'hold' ? settings.regions[region].name : nameSite(kind, biome, rng, taken);
      taken.add(name);
      return Object.freeze({ id: siteId(d, i), name, kind, depth: d, biome, region, levelOffset, ...point });
    }),
  );

  return Object.freeze({
    seed,
    name: nameRealm(rng),
    depth,
    grid: toGrid(land),
    sites: Object.freeze(sites),
    roads: Object.freeze(roads.map((road) => Object.freeze(road))),
    buildings: Object.freeze(placeBuildings(sites, land, rng)),
    palette: REALM_PALETTE,
  });
}

// The site with `id`, or undefined.
export function getSite(realm: Realm, id: string): Site | undefined {
  return realm.sites.find((site) => site.id === id);
}

// The realm's starting site (depth 0).
export function getHomeSite(realm: Realm): Site {
  return realm.sites.find((site) => site.depth === 0)!;
}

// The sites the roads lead to from site `id`, north to south.
export function getNextSites(realm: Realm, id: string): Site[] {
  return realm.roads
    .filter((road) => road.from === id)
    .map((road) => getSite(realm, road.to)!)
    .sort((a, b) => a.y - b.y);
}

// The road from `from` to `to`, or undefined when none joins them.
export function getRoad(realm: Realm, from: string, to: string): Road | undefined {
  return realm.roads.find((road) => road.from === from && road.to === to);
}

const cache = new Map<string, { settings: RegionSettings; realm: Realm }>();

// generateRealm, remembering the last few realms made so screens and
// battle setup can ask for a run's realm as often as they like.
export function getRealm(seed: number, settings: RegionSettings): Realm {
  const key = String(seed);
  const hit = cache.get(key);
  if (hit && hit.settings === settings) return hit.realm;
  const realm = generateRealm(seed, settings);
  cache.set(key, { settings, realm });
  if (cache.size > 4) cache.delete(cache.keys().next().value!);
  return realm;
}

function siteId(depth: number, row: number): string {
  return `${depth}-${row}`;
}

// Where the sites stand: one column per depth, each sorted north to
// south. Home and the Hold stand alone near the middle row; the first
// depth and the one before the Hold have two sites; the rest two or three,
// spread over the map's height with a little jitter.
export function layOutColumns(depth: number, height: number, rng: Rng): Point[][] {
  const top = 2;
  const bottom = height - 3;
  return Array.from({ length: depth + 1 }, (_, d) => {
    const x = REALM_MARGIN + d * REALM_COLUMN_SPACING;
    const count = d === 0 || d === depth ? 1 : d === 1 || d === depth - 1 ? 2 : randomInt(rng, 2, 3);
    if (count === 1) return [{ x, y: Math.round((top + bottom) / 2) + randomInt(rng, -2, 2) }];
    const slot = (bottom - top) / count;
    return Array.from({ length: count }, (_, i) => ({
      x,
      y: Math.round(top + slot * (i + 0.5) + randomInt(rng, -1, 1)),
    }));
  });
}

// What stands at each site, column by column (see SiteKind): home, then
// two battlefields for the run's opener, villages at depth 2 so an early
// recruit is always on offer, then a weighted mix with at least one fight
// per depth, at most one each of a town, shrine, elite lair and wayside
// event per depth (ONE_PER_DEPTH), and a town at least
// every TOWN_EVERY depths; the depth before the Hold always has a town (a
// last stop before the end), and the end is the Hold.
export function pickKinds(counts: readonly number[], rng: Rng): SiteKind[][] {
  const depth = counts.length - 1;
  let lastTown = 1;
  return counts.map((count, d) => {
    if (d === 0) return ['home'];
    if (d === depth) return ['hold'];
    if (d === 1) return Array(count).fill('battle');
    if (d === 2) return Array(count).fill('village');
    const kinds: SiteKind[] = [];
    const needTown = d === depth - 1 || d - lastTown >= TOWN_EVERY;
    if (needTown) kinds.push('town');
    while (kinds.length < count) {
      const allowed = (Object.entries(SITE_WEIGHTS) as [SiteKind, number][]).filter(
        ([kind]) => !(kind === 'fort' && d < FORT_FROM) && !(ONE_PER_DEPTH.has(kind) && kinds.includes(kind)),
      );
      const total = allowed.reduce((sum, [, weight]) => sum + weight, 0);
      let roll = rng() * total;
      kinds.push((allowed.find(([, weight]) => (roll -= weight) < 0) ?? allowed[0])[0]);
    }
    if (!kinds.some((kind) => BATTLE_SITES.has(kind))) kinds[kinds.length - 1] = 'battle';
    if (kinds.includes('town')) lastTown = d;
    return shuffle(rng, kinds);
  });
}

// carveRoad, falling back to a road that may have a 2x2 block of road in
// it when there's no way to lay one without (rare, on crowded land).
function layRoad(land: RealmLand, from: Point, to: Point, sites: readonly Point[]): Point[] {
  try {
    return carveRoad(land, from, to, sites);
  } catch {
    return carveRoad(land, from, to, sites, false);
  }
}

// Each site's own building, and the extras around towns, villages and the
// Hold on open tiles next to the site (grass or meadow, not road).
function placeBuildings(sites: readonly Site[], land: RealmLand, rng: Rng): BuildingPlacement[] {
  const placed: BuildingPlacement[] = [];
  const used = new Set(sites.map(({ x, y }) => `${x},${y}`));
  for (const site of sites) {
    const own = SITE_BUILDINGS[site.kind];
    if (own) placed.push({ x: site.x, y: site.y, building: own });
    for (const building of SITE_EXTRAS[site.kind] ?? []) {
      const spots = shuffle(rng, [
        [1, 0],
        [-1, 0],
        [0, 1],
        [1, 1],
        [-1, 1],
        [0, -1],
      ])
        .map(([dx, dy]) => ({ x: site.x + dx, y: site.y + dy }))
        .filter(({ x, y }) => {
          const terrain = landAt(land, x, y);
          return (terrain === 'grass' || terrain === 'meadow') && !used.has(`${x},${y}`);
        });
      const spot = spots[0];
      if (!spot) continue;
      used.add(`${spot.x},${spot.y}`);
      placed.push({ ...spot, building });
    }
  }
  return placed;
}

function toGrid(land: RealmLand): Grid {
  const grid = createGrid(land.width, land.height);
  return Object.freeze({
    ...grid,
    cells: grid.cells.map((cell) => Object.freeze({ ...cell, terrain: land.cells[cell.y * land.width + cell.x] })),
  });
}
