import { describe, expect, it } from 'vitest';
import { applyRunCommand, getRelicOffers, startRunSession } from './runCommands.ts';
import {
  BASE_ORIGINS,
  createOriginRun,
  createOriginWarband,
  findOrigin,
  getRelicPicks,
  BEAST_TAMER,
  MILITIA,
  ORIGINS,
  PEDDLERS,
  SURVIVORS,
  UNLOCKABLE_ORIGINS,
} from './origins.ts';
import { parseRun, serializeRun } from './run.ts';
import { STARTING_CLASSES } from './startingClasses.ts';
import { createStartingWarband } from './stageLevel.ts';
import { UNIT_CLASSES } from '../unitClasses.ts';

describe('ORIGINS', () => {
  it('has a lone-unit origin for every starting class, by its id', () => {
    for (const { id } of STARTING_CLASSES) {
      expect(findOrigin(id)?.units).toEqual([id]);
    }
    expect(BASE_ORIGINS.map(({ id }) => id)).toEqual(STARTING_CLASSES.map(({ id }) => id));
  });

  it('only unlocks the bands', () => {
    expect(UNLOCKABLE_ORIGINS).toEqual([MILITIA, BEAST_TAMER, PEDDLERS, SURVIVORS]);
    expect(ORIGINS).toEqual([...BASE_ORIGINS, ...UNLOCKABLE_ORIGINS]);
  });

  it('retires the Sellswords, Pilgrims and Lone Wolf', () => {
    for (const id of ['sellswords', 'pilgrims', 'lone-wolf']) expect(findOrigin(id)).toBeNull();
  });

  it('starts every unit at level 1 as a Villager or the Whelp, never a full specialist', () => {
    for (const { units } of ORIGINS) expect(units.every((id) => id === 'villager' || id === 'whelp')).toBe(true);
    expect(BEAST_TAMER.units).toEqual(['villager', 'whelp']);
  });

  it('has unique ids and only real classes', () => {
    expect(new Set(ORIGINS.map(({ id }) => id)).size).toBe(ORIGINS.length);
    const classIds = new Set(UNIT_CLASSES.map(({ id }) => id));
    expect(ORIGINS.every(({ units }) => units.length > 0 && units.every((id) => classIds.has(id)))).toBe(true);
  });

  it('finds nothing for an unknown id', () => {
    expect(findOrigin('nobody')).toBeNull();
    expect(findOrigin(undefined)).toBeNull();
  });
});

describe('createOriginWarband', () => {
  it('starts a lone class just as createStartingWarband does', () => {
    const warband = createOriginWarband(findOrigin('villager')!, 'Alden', 3);
    const expected = createStartingWarband('villager', 'Alden');
    expect([...warband.keys()]).toEqual([...expected.keys()]);
    expect(warband.get('villager-1')!.name).toBe('Alden');
  });

  it('names the leader and gives the rest different names, the same for the same seed', () => {
    const warband = createOriginWarband(BEAST_TAMER, 'Alden', 3);
    expect([...warband.keys()]).toEqual(['villager-1', 'whelp-1']);
    const names = [...warband.values()].map((unit) => unit.name);
    expect(names[0]).toBe('Alden');
    expect(names[1]).not.toBe('Alden');
    expect([...createOriginWarband(BEAST_TAMER, 'Alden', 3).values()].map((unit) => unit.name)).toEqual(names);
    expect([...warband.values()].every((unit) => unit.team === 'player' && unit.level === 1)).toBe(true);
  });

  it('counts a class it starts twice', () => {
    expect([...createOriginWarband(SURVIVORS, 'Alden', 1).keys()]).toEqual(['villager-1', 'villager-2', 'villager-3']);
  });
});

describe('createOriginRun', () => {
  it("starts with the origin's warband, gold and id, and its Heat", () => {
    const run = createOriginRun(9, 'militia', 'Alden', 2);
    expect(run.roster.map((unit) => unit.classId)).toEqual(['villager', 'villager']);
    expect(run.gold).toBe(MILITIA.gold);
    expect(run.convoy).toEqual([]);
    expect(run.origin).toBe('militia');
    expect(run.heat).toBe(2);
    expect(run.stage).toBe(1);
    expect(Object.isFrozen(run)).toBe(true);
  });

  it('keeps no Heat at none, and survives a save', () => {
    const run = createOriginRun(9, 'beast-tamer', 'Alden');
    expect(run).not.toHaveProperty('heat');
    expect(run.gold).toBe(0);
    expect(parseRun(serializeRun(run))).toEqual(run);
  });

  it("packs the Peddlers' gold and potions into the convoy", () => {
    const run = createOriginRun(9, 'peddlers', 'Alden');
    expect(run.roster.map((unit) => unit.classId)).toEqual(['villager']);
    expect(run.gold).toBe(60);
    expect(run.convoy.map(({ itemId }) => itemId)).toEqual(['health-potion', 'health-potion', 'mana-potion']);
    expect(parseRun(serializeRun(run))).toEqual(run);
  });

  it('throws on an unknown origin', () => {
    expect(() => createOriginRun(9, 'nobody', 'Alden')).toThrow(/nobody/);
  });
});

describe('starting relic picks', () => {
  it('picks one for most origins, a run from before origins and a retired origin', () => {
    expect(getRelicPicks(createOriginRun(1, 'villager', 'A'))).toBe(1);
    expect(getRelicPicks({})).toBe(1);
    expect(getRelicPicks({ origin: 'lone-wolf' })).toBe(1);
    expect(getRelicPicks(createOriginRun(1, 'survivors', 'A'))).toBe(0);
  });

  it('sets out after one pick for a one-pick origin', () => {
    const session = startRunSession(createOriginRun(4, 'militia', 'Alden'));
    expect(session.phase).toBe('relic');
    expect(getRelicOffers(session)).toHaveLength(3);
    expect(applyRunCommand(session, { type: 'pick-relic', index: 0 }).session.phase).toBe('battle');
  });

  it('sets the Survivors out with no relic pick at all', () => {
    const session = startRunSession(createOriginRun(4, 'survivors', 'Alden'));
    expect(session.phase).toBe('battle');
    expect(session.run.relics).toEqual([]);
    expect(getRelicOffers(session)).toEqual([]);
  });
});
