// What the overworld screen shows for a run on its realm: every site with
// how it stands for the warband (visited, here, a choice, or ahead), the
// roads it has travelled and the ones it can take next, and a card per
// choice saying what waits there. Pure: the React OverworldScreen draws
// this and the realm's art (realmArt.ts).

import type { Point } from '../game/grid.ts';
import { SURVIVE_TURNS, type ObjectiveSpec } from '../game/objectives.ts';
import { getUnitSprite } from '../game/tileset.ts';
import { UNIT_CLASSES } from '../game/unitClasses.ts';
import { getRoad, getSite, type Realm, type Site, type SiteKind } from '../game/warband/realm/realm.ts';
import type { RegionSettings } from '../game/warband/regions.ts';
import { getStageSeed, type RunState } from '../game/warband/run.ts';
import { pickStageObjective } from '../game/warband/stageObjective.ts';
import { getRunHeatRules } from '../game/warband/heat.ts';
import { getCurrentSiteId, getTravelChoices, shiftEnemyLevels } from '../game/warband/travel.ts';
import { toTeamView, type TeamUnitView } from './views.ts';

export type SiteState = 'visited' | 'current' | 'choice' | 'ahead';

export interface OverworldSiteView {
  id: string;
  name: string;
  kind: SiteKind;
  depth: number;
  // The site's tile on the realm.
  x: number;
  y: number;
  state: SiteState;
}

// A card for a site the warband can travel to next.
export interface SiteDetailView {
  siteId: string;
  name: string;
  kind: SiteKind;
  kindLabel: string;
  // One line on what happens there.
  blurb: string;
  // For a battle: the region it plays, what fights there and what wins it.
  region: string | null;
  enemies: string | null;
  objective: string | null;
  // The stage it plays as.
  stage: number;
}

export interface OverworldView {
  realmName: string;
  // The run's final stage (the Hold's depth), and the depth it's at.
  finalStage: number;
  depth: number;
  gold: number;
  // The realm's size, in tiles.
  width: number;
  height: number;
  sites: readonly OverworldSiteView[];
  currentSiteId: string;
  // The roads the warband has come along, oldest first, each from site
  // tile to site tile.
  travelled: readonly (readonly Point[])[];
  // A card per site it can go to next, north to south, with the road
  // there from where the warband stands, site tile to site tile.
  choices: readonly (SiteDetailView & { road: readonly Point[] })[];
  team: readonly TeamUnitView[];
  // The unit art of the warband's first unit, which marks it on the map.
  leaderSprite: string | null;
}

const KIND_TEXT: Readonly<Record<SiteKind, { label: string; blurb: string }>> = {
  home: { label: 'Camp', blurb: 'Where the warband set out.' },
  battle: { label: 'Battle', blurb: 'Fight for the road ahead.' },
  village: { label: 'Village', blurb: 'Defend the village. A villager fights beside you and may join after.' },
  fort: { label: 'Fort', blurb: 'A stronghold: enemies a level stronger, and double gold.' },
  town: { label: 'Town', blurb: 'No battle. Visit the merchant and rest for free.' },
  shrine: { label: 'Shrine', blurb: 'No battle. Receive a blessing: pick one of three rewards.' },
  hold: { label: 'The Hold', blurb: 'The final battle. Win it to win the run.' },
};

const BATTLE_KINDS: ReadonlySet<SiteKind> = new Set(['battle', 'village', 'fort', 'hold']);

export function toOverworldView(run: RunState, realm: Realm, settings: RegionSettings): OverworldView {
  const visited = run.route?.visited ?? [getCurrentSiteId(run)];
  const currentSiteId = getCurrentSiteId(run);
  const choices = getTravelChoices(run, realm);
  const choiceIds = new Set(choices.map((site) => site.id));
  const visitedIds = new Set(visited);
  const travelled = visited.slice(1).map((id, i) => getRoadTiles(realm, visited[i], id));
  const sites = realm.sites.map((site): OverworldSiteView =>
    Object.freeze({
      id: site.id,
      name: site.name,
      kind: site.kind,
      depth: site.depth,
      x: site.x,
      y: site.y,
      state:
        site.id === currentSiteId
          ? 'current'
          : choiceIds.has(site.id)
            ? 'choice'
            : visitedIds.has(site.id)
              ? 'visited'
              : 'ahead',
    }),
  );
  const leader = run.roster[0];
  const leaderClass = leader && UNIT_CLASSES.find((unitClass) => unitClass.id === leader.classId);
  return Object.freeze({
    realmName: realm.name,
    finalStage: realm.depth,
    depth: getSite(realm, currentSiteId)?.depth ?? 0,
    gold: run.gold,
    width: realm.grid.width,
    height: realm.grid.height,
    sites: Object.freeze(sites),
    currentSiteId,
    travelled: Object.freeze(travelled),
    choices: Object.freeze(
      choices.map((site) =>
        Object.freeze({
          ...toSiteDetailView(run, site, settings),
          road: getRoadTiles(realm, currentSiteId, site.id),
        }),
      ),
    ),
    team: toTeamView(run.roster),
    leaderSprite: leaderClass ? getUnitSprite(leaderClass.id) : null,
  });
}

// The tiles from site `from` to site `to` along their road, both sites'
// tiles included; empty when no road joins them.
function getRoadTiles(realm: Realm, from: string, to: string): readonly Point[] {
  const road = getRoad(realm, from, to);
  const start = getSite(realm, from);
  const end = getSite(realm, to);
  if (!road || !start || !end) return Object.freeze([]);
  return Object.freeze([{ x: start.x, y: start.y }, ...road.path, { x: end.x, y: end.y }]);
}

// The card for `site`: its kind's text, and for a battle the region it
// plays (its enemies' levels shifted as the site and the run's Heat say), what fights there
// and the objective the stage draws.
export function toSiteDetailView(run: RunState, site: Site, settings: RegionSettings): SiteDetailView {
  const { label, blurb } = KIND_TEXT[site.kind];
  const base = settings.regions[site.region];
  const fights = BATTLE_KINDS.has(site.kind) && base !== undefined;
  const region = fights ? shiftEnemyLevels(base, site.levelOffset + getRunHeatRules(run).enemyLevels) : null;
  return Object.freeze({
    siteId: site.id,
    name: site.name,
    kind: site.kind,
    kindLabel: label,
    blurb,
    region: region?.name ?? null,
    enemies: region ? describeEnemies(region.enemies) : null,
    objective: region
      ? describeObjectiveSpec(pickStageObjective(site.depth, region, getStageSeed(run.seed, site.depth)))
      : null,
    stage: site.depth,
  });
}

// "Goblin ×2, Skeleton · Lv 2–3": the enemies by class, in the order they
// first appear, and the levels they span.
export function describeEnemies(
  groups: readonly { count: number; unitClass?: string; level?: number }[],
): string | null {
  if (groups.length === 0) return null;
  const counts = new Map<string, number>();
  for (const group of groups) {
    const classId = group.unitClass ?? 'soldier';
    counts.set(classId, (counts.get(classId) ?? 0) + group.count);
  }
  const names = [...counts].map(([classId, count]) => {
    const label = UNIT_CLASSES.find((unitClass) => unitClass.id === classId)?.label ?? classId;
    return count > 1 ? `${label} ×${count}` : label;
  });
  const levels = groups.map((group) => group.level ?? 1);
  const low = Math.min(...levels);
  const high = Math.max(...levels);
  return `${names.join(', ')} · Lv ${low === high ? low : `${low}–${high}`}`;
}

// What wins a battle with objective `spec`, in a few words.
export function describeObjectiveSpec(spec: ObjectiveSpec): string {
  switch (spec.kind) {
    case 'rout':
      return 'Defeat every enemy';
    case 'boss':
      return 'Defeat the boss';
    case 'seize':
      return 'Seize the stronghold';
    case 'survive': {
      const turns = spec.turns ?? SURVIVE_TURNS;
      return `Survive ${turns} turn${turns === 1 ? '' : 's'}`;
    }
  }
}

// The scale the realm map draws at to fill `available` pixels of height
// with its `rows` tiles: whole multiples from 1 up to 2 when it fits, so
// pixels stay crisp, else shrunk to fit, but never below half size.
export function getOverworldZoom(available: number, rows: number, tileSize: number): number {
  const fit = available / (rows * tileSize);
  if (fit >= 1) return Math.min(2, Math.floor(fit));
  return Math.max(0.5, fit);
}
