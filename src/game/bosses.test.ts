import { describe, expect, it } from 'vitest';
import {
  canArrive,
  createBossState,
  findBossRules,
  getBossRules,
  isHornTurn,
  ORC_WARLORD,
  pickHornTile,
  shouldEnrage,
} from './bosses.ts';
import { createGrid, setTerrain, setUnit } from './grid.ts';

const HORN = ORC_WARLORD.horn!;
const ENRAGE = ORC_WARLORD.enrage!;

describe('findBossRules', () => {
  it('finds the Orc Warlord by its title, in any case', () => {
    expect(findBossRules('Orc Warlord')).toBe(ORC_WARLORD);
    expect(findBossRules('  orc warlord ')).toBe(ORC_WARLORD);
    expect(getBossRules('orc-warlord')).toBe(ORC_WARLORD);
  });

  it('has none for a generic chief or an unknown id', () => {
    expect(findBossRules('Goblin Chief')).toBeNull();
    expect(getBossRules('nobody')).toBeNull();
  });
});

describe('createBossState', () => {
  it('starts a boss with rules calm, with nothing called', () => {
    expect(createBossState({ kind: 'boss', unitId: 'enemy-1', name: 'Orc Warlord' })).toEqual({
      unitId: 'enemy-1',
      rulesId: 'orc-warlord',
      enraged: false,
      incoming: null,
      called: 0,
    });
  });

  it('is null for a boss without rules and for any other objective', () => {
    expect(createBossState({ kind: 'boss', unitId: 'enemy-1', name: 'Skeleton Chief' })).toBeNull();
    expect(createBossState({ kind: 'rout' })).toBeNull();
    expect(createBossState({ kind: 'survive', turns: 4 })).toBeNull();
  });
});

describe('isHornTurn', () => {
  const calm = { called: 0, incoming: null };

  it('sounds on turn 1 and every other turn after', () => {
    const turns = [1, 2, 3, 4, 5, 6].filter((turn) => isHornTurn(HORN, turn, calm));
    expect(turns).toEqual([1, 3, 5]);
  });

  it('stops once the limit is called or marked', () => {
    expect(isHornTurn(HORN, 5, { called: 2, incoming: null })).toBe(true);
    expect(isHornTurn(HORN, 5, { called: 2, incoming: { x: 0, y: 0 } })).toBe(false);
    expect(isHornTurn(HORN, 7, { called: HORN.limit, incoming: null })).toBe(false);
  });

  it('never sounds with no turns between calls', () => {
    expect(isHornTurn({ ...HORN, every: 0 }, 1, calm)).toBe(false);
  });
});

describe('pickHornTile', () => {
  it('marks the open tile nearest the boss, northmost then westmost', () => {
    const grid = setUnit(createGrid(5, 5, 'grass'), 2, 2, 'boss');
    expect(pickHornTile(grid, { x: 2, y: 2 }, 3)).toEqual({ x: 2, y: 1 });
  });

  it('walks around taken and impassable tiles, within its reach', () => {
    let grid = setUnit(createGrid(5, 1, 'grass'), 0, 0, 'boss');
    grid = setUnit(grid, 1, 0, 'guard');
    expect(pickHornTile(grid, { x: 0, y: 0 }, 3)).toEqual({ x: 2, y: 0 });
    expect(pickHornTile(grid, { x: 0, y: 0 }, 1)).toBeNull();
    const walled = setTerrain(setUnit(createGrid(3, 1, 'grass'), 0, 0, 'boss'), 1, 0, 'water');
    expect(pickHornTile(walled, { x: 0, y: 0 }, 3)).toBeNull();
  });
});

describe('canArrive', () => {
  it('needs the tile on the map and empty', () => {
    const grid = setUnit(createGrid(2, 1, 'grass'), 1, 0, 'hero');
    expect(canArrive(grid, { x: 0, y: 0 })).toBe(true);
    expect(canArrive(grid, { x: 1, y: 0 })).toBe(false);
    expect(canArrive(grid, { x: 5, y: 0 })).toBe(false);
  });
});

describe('shouldEnrage', () => {
  const calm = { enraged: false };

  it('enrages at half health or under, once', () => {
    expect(shouldEnrage(ENRAGE, calm, 11, 20)).toBe(false);
    expect(shouldEnrage(ENRAGE, calm, 10, 20)).toBe(true);
    expect(shouldEnrage(ENRAGE, calm, 1, 20)).toBe(true);
    expect(shouldEnrage(ENRAGE, { enraged: true }, 5, 20)).toBe(false);
  });

  it('never enrages a fallen boss or one without the rule', () => {
    expect(shouldEnrage(ENRAGE, calm, 0, 20)).toBe(false);
    expect(shouldEnrage(undefined, calm, 5, 20)).toBe(false);
  });
});
