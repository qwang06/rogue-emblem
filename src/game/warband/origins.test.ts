import { describe, expect, it } from 'vitest';
import { applyRunCommand, getRelicOffers, startRunSession } from './runCommands.ts';
import {
  BASE_ORIGINS,
  createOriginRun,
  createOriginWarband,
  findOrigin,
  getRelicPicks,
  LONE_WOLF,
  ORIGINS,
  PILGRIMS,
  SELLSWORDS,
  UNLOCKABLE_ORIGINS,
} from './origins.ts';
import { parseRun, serializeRun } from './run.ts';
import { STARTING_CLASSES, UNLOCKABLE_STARTING_CLASSES } from './startingClasses.ts';
import { createStartingWarband } from './stageLevel.ts';
import { UNIT_CLASSES } from '../unitClasses.ts';

describe('ORIGINS', () => {
  it('has a lone-unit origin for every starting class, by its id', () => {
    for (const { id } of [...STARTING_CLASSES, ...UNLOCKABLE_STARTING_CLASSES]) {
      expect(findOrigin(id)?.units).toEqual([id]);
    }
    expect(BASE_ORIGINS.map(({ id }) => id)).toEqual(STARTING_CLASSES.map(({ id }) => id));
  });

  it('only unlocks the bands', () => {
    for (const band of [SELLSWORDS, PILGRIMS, LONE_WOLF]) expect(UNLOCKABLE_ORIGINS).toContain(band);
    expect(ORIGINS).toEqual([...BASE_ORIGINS, ...UNLOCKABLE_ORIGINS]);
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
    const warband = createOriginWarband(findOrigin('soldier')!, 'Alden', 3);
    const expected = createStartingWarband('soldier', 'Alden');
    expect([...warband.keys()]).toEqual([...expected.keys()]);
    expect(warband.get('soldier-1')!.name).toBe('Alden');
  });

  it('names the leader and gives the rest different names, the same for the same seed', () => {
    const warband = createOriginWarband(SELLSWORDS, 'Alden', 3);
    expect([...warband.keys()]).toEqual(['soldier-1', 'archer-1']);
    const names = [...warband.values()].map((unit) => unit.name);
    expect(names[0]).toBe('Alden');
    expect(names[1]).not.toBe('Alden');
    expect([...createOriginWarband(SELLSWORDS, 'Alden', 3).values()].map((unit) => unit.name)).toEqual(names);
    expect([...warband.values()].every((unit) => unit.team === 'player' && unit.level === 1)).toBe(true);
  });

  it('counts a class it starts twice', () => {
    const twins = { ...SELLSWORDS, units: ['archer', 'archer'] };
    expect([...createOriginWarband(twins, 'Alden', 1).keys()]).toEqual(['archer-1', 'archer-2']);
  });
});

describe('createOriginRun', () => {
  it("starts with the origin's warband, gold and id, and its Heat", () => {
    const run = createOriginRun(9, 'sellswords', 'Alden', 2);
    expect(run.roster.map((unit) => unit.classId)).toEqual(['soldier', 'archer']);
    expect(run.gold).toBe(SELLSWORDS.gold);
    expect(run.origin).toBe('sellswords');
    expect(run.heat).toBe(2);
    expect(run.stage).toBe(1);
    expect(Object.isFrozen(run)).toBe(true);
  });

  it('keeps no Heat at none, and survives a save', () => {
    const run = createOriginRun(9, 'pilgrims', 'Alden');
    expect(run).not.toHaveProperty('heat');
    expect(run.gold).toBe(0);
    expect(parseRun(serializeRun(run))).toEqual(run);
  });

  it('throws on an unknown origin', () => {
    expect(() => createOriginRun(9, 'nobody', 'Alden')).toThrow(/nobody/);
  });
});

describe('starting relic picks', () => {
  it('picks one for most origins, and a run from before origins', () => {
    expect(getRelicPicks(createOriginRun(1, 'warrior', 'A'))).toBe(1);
    expect(getRelicPicks({})).toBe(1);
    expect(getRelicPicks(createOriginRun(1, 'lone-wolf', 'A'))).toBe(2);
  });

  it('offers a second pick of three new relics to the Lone Wolf, then sets out', () => {
    const session = startRunSession(createOriginRun(4, 'lone-wolf', 'Alden'));
    const first = getRelicOffers(session);
    const once = applyRunCommand(session, { type: 'pick-relic', index: 0 }).session;
    expect(once.phase).toBe('relic');
    const second = getRelicOffers(once);
    expect(second).toHaveLength(3);
    expect(second.map(({ id }) => id)).not.toContain(first[0].id);
    expect(getRelicOffers(once)).toEqual(second);
    const twice = applyRunCommand(once, { type: 'pick-relic', index: 2 }).session;
    expect(twice.phase).toBe('battle');
    expect(twice.run.relics).toEqual([first[0].id, second[2].id]);
  });

  it('sets out after one pick for a one-pick origin', () => {
    const session = startRunSession(createOriginRun(4, 'sellswords', 'Alden'));
    expect(applyRunCommand(session, { type: 'pick-relic', index: 0 }).session.phase).toBe('battle');
  });
});
