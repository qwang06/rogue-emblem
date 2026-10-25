// A Warband run's journey across its realm (realm/realm.ts): where the
// warband stands, where it can go next, and what arriving at a site does.
// A run that travels carries a `route` (see RunState): the sites it has
// visited and a snapshot of the one it's at, so a battle can be set up
// without rebuilding the realm. A run without a route is a plain linear
// run (stage after stage), as runs were before the realm.
//
// The run's `stage` is the depth of the site it's at, so everything keyed
// on the stage (enemy loot, the stage-1 rules, reward and gold amounts)
// keeps working: a battle at depth 4 plays as stage 4. Winning moves the
// stage on past the site, which is how a finished site is told apart from
// one still to fight. Pure: each function returns a new frozen run.

import { rollEvent } from './events.ts';
import { getStageClearGold, markRewardPending, rollStageRewards } from './rewards.ts';
import type { RegionConfig, RegionSettings } from './regions.ts';
import { BATTLE_SITES, getNextSites, getSite, type Realm, type Site, type SiteKind } from './realm/realm.ts';
import type { RunState } from './run.ts';

// The site a run stands at, as the run saves it.
export interface RunSite {
  id: string;
  name: string;
  kind: SiteKind;
  depth: number;
  // The region it plays (an index into the region settings) and its
  // enemies' level shift (see realm/realmRegions.ts).
  region: number;
  levelOffset: number;
}

export interface RunRoute {
  // The ids of the sites visited, from home: the last is where it is.
  visited: readonly string[];
  // The site it's at; absent while it's still at home.
  at?: RunSite;
}

// The id of every realm's starting site.
export const HOME_SITE_ID = '0-0';

// `run` set out on its realm, at home.
export function startRoute(run: RunState): RunState {
  return Object.freeze({ ...run, route: Object.freeze({ visited: Object.freeze([HOME_SITE_ID]) }) });
}

// Whether `run` travels a realm (rather than fighting stage after stage).
export function isRealmRun(run: RunState): boolean {
  return run.route !== undefined;
}

// The id of the site `run` is at.
export function getCurrentSiteId(run: RunState): string {
  return run.route?.visited.at(-1) ?? HOME_SITE_ID;
}

// The site `run` is at, or undefined at home (or on a linear run).
export function getRunSite(run: Pick<RunState, 'route'>): RunSite | undefined {
  return run.route?.at;
}

// Whether the run has done what its site is for: a battle won (the stage
// has moved past it), a shrine's blessing picked, a wayside's event
// settled, home. A town is never
// done: the warband can shop and rest until it leaves.
export function isSiteDone(run: RunState): boolean {
  const at = getRunSite(run);
  if (!at) return true;
  if (BATTLE_SITES.has(at.kind)) return run.stage > at.depth;
  if (at.kind === 'shrine') return !run.pendingReward;
  if (at.kind === 'event') return !run.pendingEvent;
  return at.kind !== 'town';
}

// The sites `run` can travel to next: those the roads lead to from where
// it is, once its site is done (a town can be left any time). None for a
// linear run.
export function getTravelChoices(run: RunState, realm: Realm): Site[] {
  const ready = isSiteDone(run) || isInTown(run);
  if (!isRealmRun(run) || !ready) return [];
  return getNextSites(realm, getCurrentSiteId(run));
}

export function canTravel(run: RunState, realm: Realm, siteId: string): boolean {
  return getTravelChoices(run, realm).some((site) => site.id === siteId);
}

// `run` arrived at site `siteId` of `realm`: the site added to its route,
// the stage set to its depth, and at a shrine its blessing owed (a reward
// pick with no gold for a clear, see rewards.ts) and at a wayside its
// event owed (events.ts). Throws when the roads
// don't lead there from where the run is.
export function travelTo(run: RunState, realm: Realm, siteId: string): RunState {
  if (!canTravel(run, realm, siteId)) throw new Error(`Can't travel to ${siteId} from ${getCurrentSiteId(run)}`);
  const site = getSite(realm, siteId)!;
  const at: RunSite = Object.freeze({
    id: site.id,
    name: site.name,
    kind: site.kind,
    depth: site.depth,
    region: site.region,
    levelOffset: site.levelOffset,
  });
  const visited = Object.freeze([...(run.route?.visited ?? [HOME_SITE_ID]), site.id]);
  const arrived: RunState = Object.freeze({ ...run, stage: site.depth, route: Object.freeze({ visited, at }) });
  if (site.kind === 'event') {
    const event = rollEvent(run.seed, site.depth, run.seenEvents);
    return Object.freeze({ ...arrived, pendingEvent: Object.freeze({ id: event.id, depth: site.depth }) });
  }
  if (site.kind !== 'shrine' || rollStageRewards(arrived, site.depth).length === 0) return arrived;
  return markRewardPending(arrived, { stage: site.depth, rerolls: 0, clearGold: 0, flawless: false });
}

// Whether the warband is in a town: where the merchant is, and rest is free.
export function isInTown(run: Pick<RunState, 'route'>): boolean {
  return getRunSite(run)?.kind === 'town';
}

// The region the run's site plays, with its enemies' levels shifted by the
// site's offset; null for a linear run, or when the region no longer
// exists (the settings changed since the run set out).
export function getSiteRegion(run: RunState, settings: RegionSettings): RegionConfig | null {
  const at = getRunSite(run);
  const region = at && settings.regions[at.region];
  if (!at || !region) return null;
  return shiftEnemyLevels(region, at.levelOffset);
}

// `region` with every enemy group `offset` levels up (down when negative,
// never below level 1).
export function shiftEnemyLevels(region: RegionConfig, offset: number): RegionConfig {
  if (offset === 0) return region;
  return Object.freeze({
    ...region,
    enemies: Object.freeze(
      region.enemies.map((group) => Object.freeze({ ...group, level: Math.max(1, (group.level ?? 1) + offset) })),
    ),
  });
}

// How much a fort's clear pays, as a multiple of a battle's.
export const FORT_GOLD_MULTIPLIER = 2;

// The gold for clearing the run's current stage with `losses` units lost:
// a stage's clear gold (getStageClearGold, with its bounty `extras`),
// doubled at a fort.
export function getClearGold(
  run: RunState,
  losses: number,
  extras: Parameters<typeof getStageClearGold>[2] = {},
): { gold: number; flawless: boolean } {
  const clear = getStageClearGold(run.stage, losses, extras);
  return getRunSite(run)?.kind === 'fort' ? { ...clear, gold: clear.gold * FORT_GOLD_MULTIPLIER } : clear;
}

// Whether winning the run's current battle wins the run: on the realm, the
// Hold; on a linear run, the final stage.
export function isFinalBattle(run: RunState, finalStage?: number): boolean {
  if (getRunSite(run)?.kind === 'hold') return true;
  return finalStage !== undefined && run.stage >= finalStage;
}
