import { describe, expect, it } from 'vitest';
import { Unit } from '../game/Unit.js';
import { toUnitView } from './views.js';

const makeUnit = () =>
  new Unit({ name: 'Soldier', health: 10, attack: 4, defense: 2, movement: 5, team: 'player' });

describe('toUnitView', () => {
  it('returns null for no unit', () => {
    expect(toUnitView(null)).toBeNull();
    expect(toUnitView(undefined)).toBeNull();
  });

  it('copies the stats the UI displays', () => {
    expect(toUnitView(makeUnit())).toEqual({
      name: 'Soldier',
      team: 'player',
      health: 10,
      maxHealth: 10,
      attack: 4,
      defense: 2,
      movement: 5,
      range: 1,
    });
  });

  it('is a detached, frozen snapshot', () => {
    const unit = makeUnit();
    const view = toUnitView(unit);
    unit.takeDamage(3);
    expect(view.health).toBe(10);
    expect(Object.isFrozen(view)).toBe(true);
  });
});
