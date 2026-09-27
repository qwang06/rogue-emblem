import { describe, expect, it } from 'vitest';
import { Unit } from '../game/Unit.js';
import {
  toDamagePopupView,
  toDialogView,
  toPhaseBannerView,
  toRosterEntryView,
  toTileAnchorView,
  toTurnView,
  toCanvasFraction,
  toUnitView,
  worldToScreen,
} from './views.js';
import { advanceDialog, createDialog } from '../game/dialog.js';
import { HEALTH_POTION } from '../game/items.js';
import { createTurnState, markDone } from '../game/turns.js';

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
      items: [],
    });
  });

  it('lists the items the unit carries', () => {
    const unit = new Unit({
      name: 'Soldier',
      health: 10,
      attack: 4,
      defense: 2,
      movement: 5,
      team: 'player',
      items: [{ item: HEALTH_POTION, quantity: 2 }],
    });
    const view = toUnitView(unit);
    expect(view.items).toEqual([{ id: 'health-potion', label: 'Health Potion', quantity: 2 }]);
    expect(Object.isFrozen(view.items)).toBe(true);
    expect(Object.isFrozen(view.items[0])).toBe(true);
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

describe('toCanvasFraction', () => {
  it('divides by the canvas size', () => {
    expect(toCanvasFraction({ x: 480, y: 180 }, { width: 960, height: 720 })).toEqual({ x: 0.5, y: 0.25 });
  });

  it('maps the corners to 0 and 1', () => {
    expect(toCanvasFraction({ x: 0, y: 0 }, { width: 960, height: 720 })).toEqual({ x: 0, y: 0 });
    expect(toCanvasFraction({ x: 960, y: 720 }, { width: 960, height: 720 })).toEqual({ x: 1, y: 1 });
  });

  it('goes outside 0–1 for points off the canvas', () => {
    expect(toCanvasFraction({ x: -96, y: 1440 }, { width: 960, height: 720 })).toEqual({ x: -0.1, y: 2 });
  });
});

// Compares each edge of an anchor, allowing for floating-point rounding.
function expectAnchor(anchor, expected) {
  for (const [edge, value] of Object.entries(expected)) expect(anchor[edge]).toBeCloseTo(value);
}

describe('toTileAnchorView', () => {
  it('gives the tile edges as fractions of the canvas', () => {
    // Tile (2, 1) at 32px, zoom 2, camera at the world origin, 400x200 canvas:
    // the tile spans x 128–192 and y 64–128 canvas pixels.
    const anchor = toTileAnchorView({ x: 2, y: 1 }, 32, { x: 0, y: 0, zoom: 2 }, { width: 400, height: 200 });
    expectAnchor(anchor, { left: 0.32, top: 0.32, right: 0.48, bottom: 0.64 });
    expect(Object.isFrozen(anchor)).toBe(true);
  });

  it('accounts for the camera offset', () => {
    const anchor = toTileAnchorView({ x: 0, y: 0 }, 32, { x: -16, y: -8, zoom: 1 }, { width: 100, height: 100 });
    expectAnchor(anchor, { left: 0.16, top: 0.08, right: 0.48, bottom: 0.4 });
  });
});

describe('toDamagePopupView', () => {
  it('copies the popup fields into a frozen snapshot', () => {
    const view = toDamagePopupView({ id: 1, amount: 3, x: 40, y: 20, durationMs: 700, extra: true });
    expect(view).toEqual({ id: 1, amount: 3, kind: 'damage', text: '3', x: 40, y: 20, durationMs: 700 });
    expect(Object.isFrozen(view)).toBe(true);
  });

  it('labels health and mana recovery', () => {
    expect(toDamagePopupView({ id: 1, amount: 5, kind: 'health', x: 0, y: 0, durationMs: 700 }).text).toBe('+5 HP');
    expect(toDamagePopupView({ id: 1, amount: 3, kind: 'mana', x: 0, y: 0, durationMs: 700 }).text).toBe('+3 MP');
  });

  it('shows a recovery of 0 rather than hiding it', () => {
    expect(toDamagePopupView({ id: 1, amount: 0, kind: 'health', x: 0, y: 0, durationMs: 700 }).text).toBe('+0 HP');
  });

  it('falls back to the bare number for an unknown kind', () => {
    expect(toDamagePopupView({ id: 1, amount: 4, kind: 'poison', x: 0, y: 0, durationMs: 700 }).text).toBe('4');
  });
});

describe('toRosterEntryView', () => {
  it('snapshots the unit for the roster menu', () => {
    const view = toRosterEntryView({ id: 'soldier', unit: makeUnit(), sprite: 'Villager_01', placed: false });
    expect(view).toEqual({ id: 'soldier', label: 'Soldier', sprite: 'Villager_01', placed: false });
    expect(Object.isFrozen(view)).toBe(true);
  });
});

describe('toTurnView', () => {
  it('returns null before the battle starts', () => {
    expect(toTurnView(null)).toBeNull();
  });

  it('names the player and enemy phases', () => {
    expect(toTurnView(createTurnState(1, 'player'))).toEqual({ turn: 1, team: 'player', label: 'Player Phase' });
    expect(toTurnView(createTurnState(4, 'enemy'))).toEqual({ turn: 4, team: 'enemy', label: 'Enemy Phase' });
  });

  it('leaves out who has moved or acted', () => {
    expect(toTurnView(markDone(createTurnState(), 'a'))).not.toHaveProperty('done');
  });

  it('is frozen', () => {
    expect(Object.isFrozen(toTurnView(createTurnState()))).toBe(true);
  });
});

describe('toPhaseBannerView', () => {
  it('carries the id, phase, and duration', () => {
    const view = toPhaseBannerView({ id: 3, turnState: createTurnState(2, 'enemy'), durationMs: 1200 });
    expect(view).toEqual({ id: 3, turn: 2, team: 'enemy', label: 'Enemy Phase', durationMs: 1200 });
    expect(Object.isFrozen(view)).toBe(true);
  });
});

describe('toDialogView', () => {
  const dialog = createDialog([
    { speaker: 'Alden', team: 'player', side: 'left', text: 'Onward.' },
    { speaker: 'Foe', team: 'enemy', side: 'right', text: 'Never!' },
  ]);

  it('snapshots the current line with its stand-in sprite and typing speed', () => {
    const view = toDialogView({ id: 3, dialog, sprite: 'Villager_01', charsPerSecond: 40 });
    expect(view).toEqual({
      id: 3,
      speaker: 'Alden',
      side: 'left',
      text: 'Onward.',
      sprite: 'Villager_01',
      revealed: false,
      charsPerSecond: 40,
      isLast: false,
    });
    expect(Object.isFrozen(view)).toBe(true);
  });

  it('follows the dialog to its revealed, last line', () => {
    const last = advanceDialog(dialog, 10_000);
    const view = toDialogView({ id: 4, dialog: advanceDialog(last, 0), charsPerSecond: 40 });
    expect(view.speaker).toBe('Foe');
    expect(view.revealed).toBe(true);
    expect(view.isLast).toBe(true);
    expect(view.sprite).toBeNull();
  });
});
