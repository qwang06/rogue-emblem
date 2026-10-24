import { describe, expect, it } from 'vitest';
import { Soldier } from '../Soldier.ts';
import type { Unit } from '../Unit.ts';
import { Warrior } from '../Warrior.ts';
import { canRest, getCampActions, needsRest, REST_COST, restAtCamp } from './camp.ts';
import { createRun, type RunState } from './run.ts';
import { HOME_SITE_ID, type RunSite } from './travel.ts';

function campRun(gold: number, hurt = true): RunState {
  const run = createRun(
    7,
    new Map<string, Unit>([
      ['alden', new Soldier({ name: 'Alden', team: 'player' })],
      ['cato', new Warrior({ name: 'Cato', team: 'player' })],
    ]),
  );
  const roster = hurt ? run.roster.map((unit, i) => (i === 0 ? { ...unit, health: 1 } : unit)) : run.roster;
  return { ...run, gold, roster };
}

describe('getCampActions', () => {
  it('offers the roster, the merchant and rest before moving on', () => {
    expect(getCampActions(campRun(100)).map((action) => action.id)).toEqual(['roster', 'merchant', 'rest', 'march']);
  });

  it('names the cost of resting', () => {
    expect(getCampActions(campRun(100))[2].label).toBe(`Rest (${REST_COST} gold)`);
  });

  it("disables Rest when it can't be afforded or nobody needs it", () => {
    expect(getCampActions(campRun(100))[2].disabled).toBe(false);
    expect(getCampActions(campRun(REST_COST - 1))[2].disabled).toBe(true);
    expect(getCampActions(campRun(100, false))[2].disabled).toBe(true);
  });
});

describe('needsRest', () => {
  it('is true when someone is missing HP or mana', () => {
    expect(needsRest(campRun(0))).toBe(true);
    expect(needsRest(campRun(0, false))).toBe(false);
    const tired = campRun(0, false);
    expect(needsRest({ ...tired, roster: [{ ...tired.roster[0], maxMana: 3, mana: 1 }] })).toBe(true);
  });

  it('is false for an empty roster', () => {
    expect(needsRest({ ...campRun(100), roster: [] })).toBe(false);
  });
});

describe('restAtCamp', () => {
  it('spends the cost and restores everyone to full HP and mana', () => {
    const run = campRun(REST_COST + 5);
    const tired = { ...run, roster: run.roster.map((unit) => ({ ...unit, maxMana: 4, mana: 0 })) };
    const after = restAtCamp(tired);
    expect(after.gold).toBe(5);
    for (const unit of after.roster) {
      expect(unit.health).toBe(unit.maxHealth);
      expect(unit.mana).toBe(unit.maxMana);
    }
    expect(Object.isFrozen(after.roster[0])).toBe(true);
  });

  it('never heals past max HP', () => {
    const after = restAtCamp(campRun(REST_COST));
    expect(after.roster.map((unit) => unit.health)).toEqual(after.roster.map((unit) => unit.maxHealth));
  });

  it("throws when it can't rest", () => {
    expect(canRest(campRun(REST_COST - 1))).toBe(false);
    expect(() => restAtCamp(campRun(REST_COST - 1))).toThrow(/gold/);
    expect(() => restAtCamp(campRun(100, false))).toThrow(/Nobody/);
  });

  it('leaves the input alone', () => {
    const run = campRun(100);
    restAtCamp(run);
    expect(run.gold).toBe(100);
    expect(run.roster[0].health).toBe(1);
  });
});

describe('camp on the realm', () => {
  const at = (kind: RunSite['kind']): RunSite => ({
    id: '3-0',
    name: 'Ashford',
    kind,
    depth: 3,
    region: 2,
    levelOffset: 0,
  });
  const onRealm = (run: RunState, kind: RunSite['kind']): RunState => ({
    ...run,
    route: { visited: [HOME_SITE_ID, '3-0'], at: at(kind) },
  });

  it('has the merchant only in a town, where rest is free', () => {
    const town = onRealm(campRun(0), 'town');
    expect(getCampActions(town).map((action) => [action.id, action.label])).toEqual([
      ['roster', 'Manage Roster'],
      ['merchant', 'Merchant'],
      ['rest', 'Rest (free)'],
      ['march', 'Travel'],
    ]);
    expect(canRest(town)).toBe(true);
    expect(restAtCamp(town).gold).toBe(0);
  });

  it('has no merchant after a battle, and rest costs gold', () => {
    const field = onRealm(campRun(100), 'battle');
    expect(getCampActions(field).map((action) => action.id)).toEqual(['roster', 'rest', 'march']);
    expect(restAtCamp(field).gold).toBe(100 - REST_COST);
  });
});
