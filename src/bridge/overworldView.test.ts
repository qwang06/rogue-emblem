import { describe, expect, it } from 'vitest';
import { DEFAULT_CONTENT } from '../game/battleSetup.ts';
import { Soldier } from '../game/Soldier.ts';
import { generateRealm, getNextSites, getSite } from '../game/warband/realm/realm.ts';
import { getRealmInk, getRouteLine } from '../game/warband/realm/realmInk.ts';
import { createRun } from '../game/warband/run.ts';
import { startRoute, travelTo } from '../game/warband/travel.ts';
import {
  describeObjectiveSpec,
  getOverworldZoom,
  toOverworldView,
  toEventView,
  toSiteDetailView,
} from './overworldView.ts';

const SETTINGS = DEFAULT_CONTENT.regions;
const realm = generateRealm(3, SETTINGS);
const home = startRoute(createRun(7, new Map([['alden', new Soldier({ name: 'Alden', team: 'player' })]])));

describe('toOverworldView', () => {
  it('shows the warband at home with the roads on as its choices', () => {
    const view = toOverworldView(home, realm, SETTINGS);
    const next = getNextSites(realm, '0-0');
    expect(view).toMatchObject({ realmName: realm.name, finalStage: realm.depth, depth: 0, currentSiteId: '0-0' });
    expect(view.choices.map((choice) => choice.siteId)).toEqual(next.map((site) => site.id));
    expect(view.sites.find((site) => site.id === '0-0')?.state).toBe('current');
    expect(view.sites.filter((site) => site.state === 'choice')).toHaveLength(next.length);
    expect(view.travelled).toEqual([]);
    expect(view.team.map((unit) => unit.name)).toEqual(['Alden']);
    expect(view.leaderSprite).not.toBeNull();
  });

  it("runs each choice's road from the warband's site tile to the choice's", () => {
    const view = toOverworldView(home, realm, SETTINGS);
    const homeSite = view.sites.find((site) => site.id === '0-0')!;
    for (const choice of view.choices) {
      const site = view.sites.find((s) => s.id === choice.siteId)!;
      expect(choice.road[0]).toEqual({ x: homeSite.x, y: homeSite.y });
      expect(choice.road.at(-1)).toEqual({ x: site.x, y: site.y });
    }
  });

  it('marks where the warband has been, and has no choices mid-battle', () => {
    const [first] = getNextSites(realm, '0-0');
    const view = toOverworldView(travelTo(home, realm, first.id), realm, SETTINGS);
    expect(view.sites.find((site) => site.id === '0-0')?.state).toBe('visited');
    expect(view.sites.find((site) => site.id === first.id)?.state).toBe('current');
    expect(view.travelled).toHaveLength(1);
    expect(view.choices).toEqual([]);
    expect(view.depth).toBe(1);
  });

  it('gives each site the season of the region it plays, summer when the region has none', () => {
    const view = toOverworldView(home, realm, SETTINGS);
    for (const site of realm.sites) {
      const season = SETTINGS.regions[site.region].season ?? 'summer';
      expect(view.sites.find((shown) => shown.id === site.id)?.season).toBe(season);
    }
    expect(new Set(view.sites.map((site) => site.season))).toEqual(
      new Set(['summer', 'autumn', 'winter', 'underworld']),
    );
  });

  it('offers a connected branch after a battle even when it belongs to another original road', () => {
    // A 13-stage realm, whose roads from this seed have the junction below.
    const realm = generateRealm(1, { ...SETTINGS, stagesPerRegion: 1, finalStage: 13 });
    // These roads share a junction, but their original links omit the turn
    // from 3-2 to 4-1.
    const from = getSite(realm, '3-2')!;
    const to = getSite(realm, '4-1')!;
    expect(realm.roads.some((road) => road.from === from.id && road.to === to.id)).toBe(false);
    const run = { ...home, stage: from.depth + 1, route: { visited: [from.id], at: from } };
    const view = toOverworldView(run, realm, SETTINGS);
    const choice = view.choices.find((site) => site.siteId === to.id);
    expect(choice).toBeDefined();
    expect(view.sites.find((site) => site.id === to.id)?.state).toBe('choice');
    const line = getRouteLine(getRealmInk(realm), choice!.road);
    const centers = choice!.road.map((point) => ({ x: point.x * 32 + 16, y: point.y * 32 + 16 }));
    expect(line[0]).toEqual(centers[0]);
    expect(line.at(-1)).toEqual(centers.at(-1));
    expect(line).not.toEqual(centers); // Uses the drawn stretches, not the fallback through tile centers.
    const arrived = travelTo(run, realm, to.id);
    expect(arrived.route?.visited).toEqual([from.id, to.id]);
    expect(toOverworldView(arrived, realm, SETTINGS).travelled).toEqual([choice!.road]);
  });
});

describe('toSiteDetailView', () => {
  it('names a battle’s region and objective, and a town has neither', () => {
    const battle = realm.sites.find((site) => site.kind === 'battle')!;
    const card = toSiteDetailView(home, battle, SETTINGS);
    expect(card).toMatchObject({
      kindLabel: 'Battle',
      stage: battle.depth,
      region: SETTINGS.regions[battle.region].name,
    });
    expect(card.objective).not.toBeNull();
    const town = realm.sites.find((site) => site.kind === 'town')!;
    expect(toSiteDetailView(home, town, SETTINGS)).toMatchObject({ kindLabel: 'Town', region: null, objective: null });
  });
});

describe('describeObjectiveSpec', () => {
  it('says what wins each objective', () => {
    expect(describeObjectiveSpec({ kind: 'rout' })).toBe('Defeat every enemy');
    expect(describeObjectiveSpec({ kind: 'survive', turns: 1 })).toBe('Survive 1 turn');
    expect(describeObjectiveSpec({ kind: 'survive', turns: 6 })).toBe('Survive 6 turns');
  });
});

describe('getOverworldZoom', () => {
  it('fills the height it has, from half size up to double', () => {
    expect(getOverworldZoom(18 * 32, 18, 32)).toBe(1);
    expect(getOverworldZoom(18 * 32 * 1.5, 18, 32)).toBe(1.5);
    expect(getOverworldZoom(18 * 32 * 5, 18, 32)).toBe(2);
    expect(getOverworldZoom(18 * 32 * 0.75, 18, 32)).toBe(0.75);
    expect(getOverworldZoom(10, 18, 32)).toBe(0.5);
  });
});

describe('toEventView', () => {
  it("shows the owed event's story and choices, with why one is blocked", () => {
    const view = toEventView({ ...home, gold: 0, pendingEvent: { id: 'gambler', depth: 3 } })!;
    expect(view.title).toBe('Gambler');
    expect(view.choices.map((choice) => choice.blocked)).toEqual(['Needs 30 gold', null]);
    expect(toEventView(home)).toBeNull();
  });
});

describe('the realm view', () => {
  it('tapes the stages, the Hold last, and counts the stages to it', () => {
    const view = toOverworldView(home, realm, SETTINGS);
    expect(view.tape).toHaveLength(realm.depth);
    expect(view.tape.at(-1)).toBe('boss');
    expect(view.tape.filter((tick) => tick === 'now')).toHaveLength(0);
    expect(view.holdIn).toBe(realm.depth);
    expect(view.currentRegion).toBeNull();
    const [first] = getNextSites(realm, '0-0');
    const there = toOverworldView(travelTo(home, realm, first.id), realm, SETTINGS);
    expect(there.tape[0]).toBe('now');
    expect(there.holdIn).toBe(realm.depth - 1);
    expect(there.currentRegion).toBe(SETTINGS.regions[first.region].name);
  });

  it('gives a battle its turns and keeps its foes and spoils unknown, and a town has neither', () => {
    const battle = toSiteDetailView(
      home,
      realm.sites.find((site) => site.kind === 'battle')!,
      SETTINGS,
    );
    expect(battle.turns).toBeGreaterThan(0);
    expect(battle).not.toHaveProperty('foes');
    expect(battle).not.toHaveProperty('spoils');
    expect(battle).not.toHaveProperty('enemies');
    const town = toSiteDetailView(
      home,
      realm.sites.find((site) => site.kind === 'town')!,
      SETTINGS,
    );
    expect(town).toMatchObject({ objective: null, turns: null });
  });
});
