import { describe, expect, it } from 'vitest';
import { DEFAULT_CONTENT } from '../game/battleSetup.ts';
import { Soldier } from '../game/Soldier.ts';
import { generateRealm, getNextSites } from '../game/warband/realm/realm.ts';
import { createRun } from '../game/warband/run.ts';
import { startRoute, travelTo } from '../game/warband/travel.ts';
import {
  describeEnemies,
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
});

describe('toSiteDetailView', () => {
  it('tells what fights at a battle, and nothing of the sort at a town', () => {
    const battle = realm.sites.find((site) => site.kind === 'battle')!;
    const card = toSiteDetailView(home, battle, SETTINGS);
    expect(card).toMatchObject({
      kindLabel: 'Battle',
      stage: battle.depth,
      region: SETTINGS.regions[battle.region].name,
    });
    expect(card.enemies).toMatch(/Lv/);
    expect(card.objective).not.toBeNull();
    const town = realm.sites.find((site) => site.kind === 'town')!;
    expect(toSiteDetailView(home, town, SETTINGS)).toMatchObject({ kindLabel: 'Town', region: null, enemies: null });
  });
});

describe('describeEnemies', () => {
  it('counts each class and spans the levels', () => {
    expect(
      describeEnemies([
        { count: 2, unitClass: 'goblin', level: 2 },
        { count: 1, unitClass: 'goblin', level: 3 },
      ]),
    ).toBe('Goblin ×3 · Lv 2–3');
    expect(describeEnemies([{ count: 1 }])).toBe('Soldier · Lv 1');
    expect(describeEnemies([])).toBeNull();
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
  it('scales by whole steps up to 2 when the map fits, shrinking to half size at most', () => {
    expect(getOverworldZoom(18 * 32, 18, 32)).toBe(1);
    expect(getOverworldZoom(18 * 32 * 1.9, 18, 32)).toBe(1);
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

describe('elite lair cards', () => {
  it("list the lair's affixes after its enemies", () => {
    const lair = generateRealm(3, SETTINGS).sites.find((site) => site.kind === 'elite');
    if (!lair) return;
    expect(toSiteDetailView(home, lair, SETTINGS).enemies).toMatch(/· [A-Z]\w+, [A-Z]\w+$/);
  });
});
