// What the overworld screen shows for a run on its realm: every site with
// how it stands for the warband (visited, here, a choice, or ahead), the
// roads it has travelled and the ones it can take next, and a card per
// choice saying what waits there. Pure: the React OverworldScreen draws
// this over the realm's parchment map (realmInk.ts).

import type { Point } from '../game/grid.ts';
import { SURVIVE_TURNS, TURN_LIMIT, type ObjectiveSpec } from '../game/objectives.ts';
import { DEFAULT_SEASON, getUnitSprite, type Season } from '../game/tileset.ts';
import { UNIT_CLASSES } from '../game/unitClasses.ts';
import { BATTLE_SITES, getRoad, getSite, type Realm, type Site, type SiteKind } from '../game/warband/realm/realm.ts';
import { findEvent, getEventChoices } from '../game/warband/events.ts';
import type { RegionSettings } from '../game/warband/regions.ts';
import { getStageSeed, type RunState } from '../game/warband/run.ts';
import { pickStageObjective } from '../game/warband/stageObjective.ts';
import { levelRegionForStage } from '../game/warband/enemyCurve.ts';
import { getCurrentSiteId, getTravelChoices } from '../game/warband/travel.ts';
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
  // The season of the region it plays, which its icon is drawn in.
  season: Season;
}

// A card for a site the warband can travel to next.
export interface SiteDetailView {
  siteId: string;
  name: string;
  kind: SiteKind;
  kindLabel: string;
  // One line on what happens there.
  blurb: string;
  // For a battle: the region it plays and what wins it. Who fights there
  // and what it pays stay unknown until the warband arrives.
  region: string | null;
  objective: string | null;
  // The stage it plays as.
  stage: number;
  // For a battle: the turns it has (the limit, or a survive objective's count).
  turns: number | null;
}

// One stage on the tape across the header: behind the warband, where it
// stands, ahead, a depth with an elite lair, or the Hold's.
export type TapeTick = 'done' | 'now' | 'ahead' | 'elite' | 'boss';

export interface OverworldView {
  realmName: string;
  // The run's final stage (the Hold's depth), and the depth it's at.
  finalStage: number;
  depth: number;
  // The region the warband stands in, or null at home.
  currentRegion: string | null;
  // One tick per stage, 1 to the final, and how many stages to the Hold.
  tape: readonly TapeTick[];
  holdIn: number;
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

export const KIND_TEXT: Readonly<Record<SiteKind, { label: string; blurb: string }>> = {
  home: { label: 'Camp', blurb: 'Where the warband set out.' },
  battle: { label: 'Battle', blurb: 'Fight for the road ahead.' },
  village: { label: 'Village', blurb: 'Defend the village. A villager fights beside you and may join after.' },
  fort: { label: 'Fort', blurb: 'A stronghold: enemies a level stronger, and double gold.' },
  elite: { label: 'Elite Lair', blurb: 'Elite enemies with dangerous traits. Win to pick a relic.' },
  town: { label: 'Town', blurb: 'No battle. Visit the merchant and rest for free.' },
  shrine: { label: 'Shrine', blurb: 'No battle. Receive a blessing: pick one of three rewards.' },
  event: { label: 'Wayside', blurb: 'No battle. Something waits by the road: a choice, for better or worse.' },
  hold: { label: 'The Hold', blurb: 'The final battle. Win it to win the run.' },
};

const BATTLE_KINDS: ReadonlySet<SiteKind> = BATTLE_SITES;

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
      season: settings.regions[site.region]?.season ?? DEFAULT_SEASON,
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
  const current = getSite(realm, currentSiteId);
  const depth = current?.depth ?? 0;
  const eliteDepths = new Set(realm.sites.filter((site) => site.kind === 'elite').map((site) => site.depth));
  const tape = Array.from({ length: realm.depth }, (_, i): TapeTick => {
    const stage = i + 1;
    if (stage === depth) return 'now';
    if (stage === realm.depth) return 'boss';
    if (stage < depth) return 'done';
    return eliteDepths.has(stage) ? 'elite' : 'ahead';
  });
  return Object.freeze({
    realmName: realm.name,
    finalStage: realm.depth,
    depth,
    currentRegion: current && current.kind !== 'home' ? (settings.regions[current.region]?.name ?? null) : null,
    tape: Object.freeze(tape),
    holdIn: realm.depth - depth,
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
// plays (its enemies at the site's depth's level, plus a fort's offset)
// and the objective the stage draws.
export function toSiteDetailView(run: RunState, site: Site, settings: RegionSettings): SiteDetailView {
  const { label, blurb } = KIND_TEXT[site.kind];
  const base = settings.regions[site.region];
  const fights = BATTLE_KINDS.has(site.kind) && base !== undefined;
  const region = fights ? levelRegionForStage(base, site.depth, site.levelOffset) : null;
  const spec = region ? pickStageObjective(site.depth, region, getStageSeed(run.seed, site.depth)) : null;
  return Object.freeze({
    siteId: site.id,
    name: site.name,
    kind: site.kind,
    kindLabel: label,
    blurb,
    region: region?.name ?? null,
    objective: spec ? describeObjectiveSpec(spec) : null,
    stage: site.depth,
    turns: spec ? (spec.kind === 'survive' ? (spec.turns ?? SURVIVE_TURNS) : TURN_LIMIT) : null,
  });
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
// with its `rows` tiles: as big as fits, up to double size, and never
// below half size (the map then scrolls).
export function getOverworldZoom(available: number, rows: number, tileSize: number): number {
  const fit = available / (rows * tileSize);
  return Math.min(2, Math.max(0.5, fit));
}

// The wayside event the run owes a choice, for the overworld's event
// panel; null when it owes none.
export interface EventView {
  title: string;
  text: string;
  choices: readonly { label: string; detail: string; blocked: string | null }[];
}

export function toEventView(run: RunState): EventView | null {
  const event = run.pendingEvent && findEvent(run.pendingEvent.id);
  if (!event) return null;
  return Object.freeze({
    title: event.title,
    text: event.text,
    choices: Object.freeze(
      getEventChoices(run).map(({ label, detail, blocked }) => Object.freeze({ label, detail, blocked })),
    ),
  });
}
