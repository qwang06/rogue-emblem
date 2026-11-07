import { describe, expect, it } from 'vitest';
import { Unit } from '../game/Unit.ts';
import { summarizeThreats, toIntentViews } from './intentView.ts';

function unit(name: string, team: 'player' | 'enemy') {
  return new Unit({ name, health: 10, strength: 4, defense: 2, movement: 5, team, unitClass: 'soldier' });
}

describe('toIntentViews', () => {
  const units = new Map([
    ['a', unit('Ash', 'player')],
    ['e', unit('Goblin', 'enemy')],
    ['f', unit('Orc', 'enemy')],
  ]);

  it("names the target and carries the strike's numbers", () => {
    const [view] = toIntentViews({ units }, [
      {
        unitId: 'e',
        path: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
        target: { x: 2, y: 0, unitId: 'a' },
        damage: 4,
        strikes: 2,
        hit: 61,
      },
    ]);
    expect(view).toEqual({ unitId: 'e', targetName: 'Ash', damage: 4, strikes: 2, hit: 61, holds: false });
  });

  it('marks an enemy that neither moves nor strikes as holding', () => {
    const [stays, walks] = toIntentViews({ units }, [
      { unitId: 'e', path: [{ x: 0, y: 0 }], target: null, damage: 0, strikes: 0, hit: 0 },
      {
        unitId: 'f',
        path: [
          { x: 0, y: 1 },
          { x: 1, y: 1 },
        ],
        target: null,
        damage: 0,
        strikes: 0,
        hit: 0,
      },
    ]);
    expect(stays).toMatchObject({ targetName: null, holds: true });
    expect(walks).toMatchObject({ targetName: null, holds: false });
  });

  it('drops the target name when the unit is gone', () => {
    const [view] = toIntentViews({ units }, [
      { unitId: 'e', path: [{ x: 0, y: 0 }], target: { x: 1, y: 0, unitId: 'zzz' }, damage: 1, strikes: 1, hit: 50 },
    ]);
    expect(view.targetName).toBeNull();
    expect(view.holds).toBe(false);
  });
});

describe('summarizeThreats', () => {
  it('adds up the threatened units, their damage and the lethal ones', () => {
    expect(
      summarizeThreats([
        { unitId: 'a', at: { x: 0, y: 0 }, damage: 8, attackers: 2, lethal: false },
        { unitId: 'b', at: { x: 1, y: 0 }, damage: 12, attackers: 1, lethal: true },
      ]),
    ).toEqual({ units: 2, damage: 20, lethal: 1 });
  });

  it('is all zeros with no threats', () => {
    expect(summarizeThreats([])).toEqual({ units: 0, damage: 0, lethal: 0 });
  });
});
