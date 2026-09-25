import { describe, expect, it } from 'vitest';
import { Unit } from '../game/Unit.js';
import { toDamagePopupView, toRosterEntryView, toUnitView, worldToScreen } from './views.js';

const makeUnit = () =>
  new Unit({ name: 'Soldier', health: 10, mana: 5, attack: 4, defense: 2, movement: 5, team: 'player' });

describe('toUnitView', () => {
  it('returns null for no unit', () => {
    expect(toUnitView(null)).toBeNull();
    expect(toUnitView(undefined)).toBeNull();
  });

  it('copies the stats the UI displays', () => {
    expect(toUnitView(makeUnit())).toEqual({
      name: 'Soldier',
      team: 'player',
      level: 1,
      health: 10,
      maxHealth: 10,
      mana: 5,
      maxMana: 5,
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

describe('worldToScreen', () => {
  it('is the identity for an unscrolled, unzoomed camera', () => {
    expect(worldToScreen({ x: 16, y: 32 }, { x: 0, y: 0, zoom: 1 })).toEqual({ x: 16, y: 32 });
  });

  it('offsets by the camera position and scales by zoom', () => {
    expect(worldToScreen({ x: 16, y: 32 }, { x: 8, y: -4, zoom: 2 })).toEqual({ x: 16, y: 72 });
  });

  it('can land off screen', () => {
    expect(worldToScreen({ x: 0, y: 0 }, { x: 10, y: 10, zoom: 2 })).toEqual({ x: -20, y: -20 });
  });
});

describe('toDamagePopupView', () => {
  it('copies the popup fields into a frozen snapshot', () => {
    const view = toDamagePopupView({ id: 1, amount: 3, x: 40, y: 20, durationMs: 700, extra: true });
    expect(view).toEqual({ id: 1, amount: 3, x: 40, y: 20, durationMs: 700 });
    expect(Object.isFrozen(view)).toBe(true);
  });
});

describe('toRosterEntryView', () => {
  it('snapshots the unit for the roster menu', () => {
    const view = toRosterEntryView({ id: 'soldier', unit: makeUnit(), frame: 124, placed: false });
    expect(view).toEqual({ id: 'soldier', label: 'Soldier', frame: 124, placed: false });
    expect(Object.isFrozen(view)).toBe(true);
  });
});
