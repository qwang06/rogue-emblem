// The road connections shared by travel and the parchment map. Routes
// can change roads at a shared tile, but not between neighboring tiles
// unless a road actually joins them.

import type { Point } from '../../grid.ts';
import type { Realm, Road } from './realm.ts';

export function getRoadNetwork(realm: Pick<Realm, 'sites' | 'roads'>): {
  links: Map<string, Set<string>>;
  points: Map<string, Point>;
} {
  const links = new Map<string, Set<string>>();
  const points = new Map<string, Point>();
  const sites = new Map(realm.sites.map((site) => [site.id, site]));
  for (const road of realm.roads) {
    const from = sites.get(road.from);
    const to = sites.get(road.to);
    if (!from || !to) continue;
    const tiles = [from, ...road.path, to];
    for (let i = 1; i < tiles.length; i++) {
      const a = tiles[i - 1];
      const b = tiles[i];
      if (key(a) === key(b)) continue;
      for (const [start, end] of [
        [a, b],
        [b, a],
      ]) {
        const id = key(start);
        points.set(id, { x: start.x, y: start.y });
        if (!links.has(id)) links.set(id, new Set());
        links.get(id)!.add(key(end));
      }
    }
  }
  return { links, points };
}

const routeCache = new WeakMap<Realm, Map<string, readonly Road[]>>();

// Roads to the next depth through the drawn junctions. Stop at every
// site, so reaching a destination cannot unlock the roads beyond it or
// allow a detour through another site in the current column. Keep the
// original paths where possible so existing journeys keep their routes.
export function getOnwardRoads(realm: Realm, fromId: string): readonly Road[] {
  const cached = routeCache.get(realm)?.get(fromId);
  if (cached) return cached;
  const from = realm.sites.find((site) => site.id === fromId);
  if (!from) return [];
  const sites = new Map(realm.sites.map((site) => [key(site), site]));
  const column = new Set(realm.sites.filter((site) => site.depth === from.depth).map((site) => site.id));
  const roads = realm.roads.filter((road) => column.has(road.from));
  const { links, points } = getRoadNetwork({ sites: realm.sites, roads });
  const start = key(from);
  const previous = new Map<string, string>([[start, start]]);
  const queue = [start];
  const routes: Road[] = [];
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    const site = sites.get(current);
    if (current !== start && site) {
      if (site.depth === from.depth + 1) {
        const original = roads.find((road) => road.from === fromId && road.to === site.id);
        const path: Point[] = [];
        for (let at = previous.get(current)!; at !== start; at = previous.get(at)!) path.push(points.get(at)!);
        routes.push(original ?? Object.freeze({ from: fromId, to: site.id, path: Object.freeze(path.reverse()) }));
      }
      continue;
    }
    for (const next of links.get(current) ?? []) {
      if (previous.has(next)) continue;
      previous.set(next, current);
      queue.push(next);
    }
  }
  if (!routeCache.has(realm)) routeCache.set(realm, new Map());
  const result = Object.freeze(routes);
  routeCache.get(realm)!.set(fromId, result);
  return result;
}

function key(point: Point): string {
  return `${point.x},${point.y}`;
}
