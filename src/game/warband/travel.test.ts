import { describe, expect, it } from 'vitest';
import { DEFAULT_CONTENT } from '../battleSetup.ts';
import { Soldier } from '../Soldier.ts';
import type { Unit } from '../Unit.ts';
import { generateRealm, getNextSites, type Realm, type Site, type SiteKind } from './realm/realm.ts';
import { getStageClearGold } from './rewards.ts';
import { createRun, type RunState } from './run.ts';
import {
  canTravel,
  FORT_GOLD_MULTIPLIER,
  getClearGold,
  getCurrentSiteId,
  getRunSite,
  getSiteRegion,
  getTravelChoices,
  HOME_SITE_ID,
  isFinalBattle,
  isInTown,
  isRealmRun,
  isSiteDone,
  shiftEnemyLevels,
  startRoute,
  travelTo,
} from './travel.ts';

const SETTINGS = DEFAULT_CONTENT.regions;
const REALMS = Array.from({ length: 8 }, (_, i) => generateRealm(i * 31 + 1, SETTINGS));

function linearRun(): RunState {
  return createRun(7, new Map<string, Unit>([['alden', new Soldier({ name: 'Alden', team: 'player' })]]));
}

// A realm with a road leading into a site of `kind`, and that road's ends.
function findRoadTo(kind: SiteKind): { realm: Realm; from: Site; to: Site } {
  for (const realm of REALMS) {
    for (const from of realm.sites) {
      const to = getNextSites(realm, from.id).find((site) => site.kind === kind);
      if (to) return { realm, from, to };
    }
  }
  throw new Error(`No road to a ${kind}`);
}

// `run` standing at `site`, with what the site is for done when `done`.
function standingAt(run: RunState, site: Site, done = true): RunState {
  const at = {
    id: site.id,
    name: site.name,
    kind: site.kind,
    depth: site.depth,
    region: site.region,
    levelOffset: site.levelOffset,
  };
  const stage = done && site.kind !== 'town' && site.kind !== 'shrine' ? site.depth + 1 : site.depth;
  return { ...run, stage, route: { visited: [HOME_SITE_ID, site.id], at } };
}

describe('startRoute', () => {
  it('sets the run out at home on its realm', () => {
    const run = startRoute(linearRun());
    expect(isRealmRun(run)).toBe(true);
    expect(getCurrentSiteId(run)).toBe(HOME_SITE_ID);
    expect(getRunSite(run)).toBeUndefined();
    expect(isSiteDone(run)).toBe(true);
    expect(Object.isFrozen(run.route)).toBe(true);
  });

  it('leaves a linear run without a route, and nowhere to travel', () => {
    expect(isRealmRun(linearRun())).toBe(false);
    expect(getTravelChoices(linearRun(), REALMS[0])).toEqual([]);
  });
});

describe('travelTo', () => {
  const realm = REALMS[0];
  const home = startRoute(linearRun());

  it('travels from home to a first-depth site, which sets the stage', () => {
    const [first] = getTravelChoices(home, realm);
    const run = travelTo(home, realm, first.id);
    expect(run.route?.visited).toEqual([HOME_SITE_ID, first.id]);
    expect(getRunSite(run)).toMatchObject({ id: first.id, kind: 'battle', depth: 1 });
    expect(run.stage).toBe(1);
    expect(isSiteDone(run)).toBe(false);
    expect(getTravelChoices(run, realm)).toEqual([]);
  });

  it('refuses a site the roads do not lead to', () => {
    const far = realm.sites.find((site) => site.depth === 3)!;
    expect(canTravel(home, realm, far.id)).toBe(false);
    expect(() => travelTo(home, realm, far.id)).toThrow(/travel/);
  });

  it('opens the next roads once a battle is won', () => {
    const [first] = getTravelChoices(home, realm);
    const won = { ...travelTo(home, realm, first.id), stage: 2 };
    expect(isSiteDone(won)).toBe(true);
    expect(getTravelChoices(won, realm).map((site) => site.id)).toEqual(getNextSites(realm, first.id).map((s) => s.id));
  });

  it('owes a blessing at a shrine: a reward pick with no clear gold', () => {
    const { realm: shrineRealm, from, to } = findRoadTo('shrine');
    const run = travelTo(standingAt(startRoute(linearRun()), from), shrineRealm, to.id);
    expect(run.pendingReward).toMatchObject({ stage: to.depth, clearGold: 0 });
    expect(isSiteDone(run)).toBe(false);
    expect(isSiteDone({ ...run, pendingReward: undefined })).toBe(true);
  });

  it('can leave a town at any time', () => {
    const { realm: townRealm, from, to } = findRoadTo('town');
    const run = travelTo(standingAt(startRoute(linearRun()), from), townRealm, to.id);
    expect(isInTown(run)).toBe(true);
    expect(isSiteDone(run)).toBe(false);
    expect(getTravelChoices(run, townRealm).length).toBeGreaterThan(0);
  });
});

describe('getSiteRegion', () => {
  it("is the site's region with its enemies shifted, or null off the realm", () => {
    const { realm, to } = findRoadTo('fort');
    const run = standingAt(startRoute(linearRun()), to, false);
    const region = getSiteRegion(run, SETTINGS)!;
    expect(region.name).toBe(SETTINGS.regions[to.region].name);
    expect(region.enemies[0].level).toBe(
      Math.max(1, (SETTINGS.regions[to.region].enemies[0].level ?? 1) + to.levelOffset),
    );
    expect(getSiteRegion(linearRun(), SETTINGS)).toBeNull();
    expect(realm).toBeDefined();
  });
});

describe('shiftEnemyLevels', () => {
  const region = SETTINGS.regions[2];

  it('moves every group by the offset, never below level 1', () => {
    expect(shiftEnemyLevels(region, 0)).toBe(region);
    expect(shiftEnemyLevels(region, 2).enemies.map((g) => g.level)).toEqual(
      region.enemies.map((g) => (g.level ?? 1) + 2),
    );
    expect(shiftEnemyLevels(region, -99).enemies.every((g) => g.level === 1)).toBe(true);
  });
});

describe('getClearGold', () => {
  it('pays a stage clear, doubled at a fort', () => {
    const { to } = findRoadTo('fort');
    const fort = { ...standingAt(startRoute(linearRun()), to, false) };
    const base = getStageClearGold(fort.stage, 0);
    expect(getClearGold(fort, 0)).toEqual({ ...base, gold: base.gold * FORT_GOLD_MULTIPLIER });
    expect(getClearGold(linearRun(), 1)).toEqual(getStageClearGold(1, 1));
  });
});

describe('isFinalBattle', () => {
  it('is the Hold on the realm, the final stage on a linear run', () => {
    const realm = REALMS[0];
    const hold = realm.sites.find((site) => site.kind === 'hold')!;
    expect(isFinalBattle(standingAt(startRoute(linearRun()), hold, false))).toBe(true);
    expect(isFinalBattle({ ...linearRun(), stage: 10 }, 10)).toBe(true);
    expect(isFinalBattle({ ...linearRun(), stage: 9 }, 10)).toBe(false);
  });
});

describe('waysides and elite lairs', () => {
  it('owes an event on arriving at a wayside, done once it is settled', () => {
    const { realm, from, to } = findRoadTo('event');
    const run = travelTo(standingAt(startRoute(linearRun()), from), realm, to.id);
    expect(run.pendingEvent).toMatchObject({ depth: to.depth });
    expect(isSiteDone(run)).toBe(false);
    expect(getTravelChoices(run, realm)).toEqual([]);
    expect(isSiteDone({ ...run, pendingEvent: undefined })).toBe(true);
  });

  it('meets an event it has not seen when it can', () => {
    const { realm, from, to } = findRoadTo('event');
    const first = travelTo(standingAt(startRoute(linearRun()), from), realm, to.id).pendingEvent!.id;
    const seen = { ...standingAt(startRoute(linearRun()), from), seenEvents: [first] };
    expect(travelTo(seen, realm, to.id).pendingEvent!.id).not.toBe(first);
  });

  it('fights at an elite lair', () => {
    const { realm, from, to } = findRoadTo('elite');
    const run = travelTo(standingAt(startRoute(linearRun()), from), realm, to.id);
    expect(isSiteDone(run)).toBe(false);
    expect(run.stage).toBe(to.depth);
  });
});
