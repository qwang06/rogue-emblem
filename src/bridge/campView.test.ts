import { describe, expect, it } from 'vitest';
import { Soldier } from '../game/Soldier.ts';
import type { Unit } from '../game/Unit.ts';
import { Villager } from '../game/Villager.ts';
import { PROMOTION_LEVEL } from '../game/promotions.ts';
import { createRun, type RunState } from '../game/warband/run.ts';
import type { RegionSettings } from '../game/warband/regions.ts';
import { getCampNotes, toCampView } from './campView.ts';

const SETTINGS: RegionSettings = { regions: [], finalStage: 30 };

function campRun(): RunState {
  const run = createRun(
    7,
    new Map<string, Unit>([
      ['alden', new Soldier({ name: 'Alden', team: 'player' })],
      ['cato', new Villager({ name: 'Cato', team: 'player' })],
    ]),
  );
  return {
    ...run,
    gold: 40,
    convoy: [
      { itemId: 'health-potion', quantity: 3 },
      { itemId: 'iron-axe', quantity: 1 },
    ],
  };
}

describe('toCampView', () => {
  it('lists the roster with the picked unit in full, the supplies and the stage', () => {
    const view = toCampView(campRun(), SETTINGS, 1);
    expect(view.stage).toBe(1);
    expect(view.finalStage).toBe(30);
    expect(view.site).toBeNull();
    expect(view.units.map((unit) => [unit.name, unit.classLabel, unit.hurt, unit.promotable])).toEqual([
      ['Alden', 'Soldier', false, false],
      ['Cato', 'Villager', false, false],
    ]);
    expect(view.unitIndex).toBe(1);
    expect(view.unit?.name).toBe('Cato');
    expect(view.gold).toBe(40);
    // Only the potions count as supplies; the convoy's size counts everything.
    expect(view.supplies).toEqual([{ id: 'health-potion', label: 'Health Potion', quantity: 3 }]);
    expect(view.convoyCount).toBe(2);
    expect(Object.isFrozen(view)).toBe(true);
  });

  it('keeps the picked index on the roster', () => {
    expect(toCampView(campRun(), SETTINGS, 9).unitIndex).toBe(1);
    expect(toCampView(campRun(), SETTINGS, -3).unitIndex).toBe(0);
    const empty = { ...campRun(), roster: [] };
    expect(toCampView(empty, SETTINGS, 0)).toMatchObject({ unitIndex: -1, unit: null });
  });

  it('flags a hurt unit and one that can promote', () => {
    const run = campRun();
    const roster = run.roster.map((unit, i) =>
      i === 0 ? { ...unit, health: unit.maxHealth - 2 } : { ...unit, level: PROMOTION_LEVEL },
    );
    const view = toCampView({ ...run, roster }, SETTINGS, 0);
    expect(view.units.map((unit) => [unit.hurt, unit.promotable])).toEqual([
      [true, false],
      [false, true],
    ]);
  });
});

describe('getCampNotes', () => {
  it('notes the roster size, the rest and the march', () => {
    const run = campRun();
    expect(getCampNotes(run)).toMatchObject({ roster: '2 units', rest: '15 gold', march: 'stage 1' });
  });

  it('counts the wounded a rest would heal and who can promote', () => {
    const run = campRun();
    const roster = run.roster.map((unit, i) =>
      i === 0 ? { ...unit, health: 1 } : { ...unit, level: PROMOTION_LEVEL },
    );
    const notes = getCampNotes({ ...run, roster });
    expect(notes.rest).toBe('15 gold · heals 1');
    expect(notes.promote).toBe('Cato');
  });
});
