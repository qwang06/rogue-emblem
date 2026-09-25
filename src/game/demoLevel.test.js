import { describe, expect, it } from 'vitest';
import { canPlaceUnit } from './deployment.js';
import { createDemoLevel, DEPLOYMENT_ZONE_SIZE, ENEMY_COUNT, PLAYER_ROSTER } from './demoLevel.js';
import { findUnit, getCell } from './grid.js';
import { Soldier } from './Soldier.js';

describe('createDemoLevel', () => {
  const level = createDemoLevel(20, 15);

  it('starts with no player units on the map', () => {
    for (const unitId of level.roster) expect(findUnit(level.grid, unitId)).toBeNull();
  });

  it('offers three named player soldiers for deployment', () => {
    expect(level.roster).toEqual(['soldier-1', 'soldier-2', 'soldier-3']);
    for (const unitId of level.roster) {
      expect(level.units.get(unitId).team).toBe('player');
      expect(level.units.get(unitId).name).toBe(PLAYER_ROSTER[unitId]);
    }
  });

  it('has room in the deployment zone for the whole roster', () => {
    expect(level.roster.length).toBeLessThanOrEqual(level.deploymentZone.length);
  });

  it('places the enemies on the last tiles of the bottom-right', () => {
    const enemies = level.grid.cells.filter((c) => c.unitId).map(({ x, y, unitId }) => ({ x, y, unitId }));
    expect(enemies).toEqual([
      { x: 17, y: 14, unitId: 'enemy-1' },
      { x: 18, y: 14, unitId: 'enemy-2' },
      { x: 19, y: 14, unitId: 'enemy-3' },
    ]);
    expect(enemies).toHaveLength(ENEMY_COUNT);
    for (const { unitId } of enemies) expect(level.units.get(unitId).team).toBe('enemy');
  });

  it('makes every unit a level 1 soldier', () => {
    for (const unit of level.units.values()) {
      expect(unit).toBeInstanceOf(Soldier);
      expect(unit.level).toBe(1);
    }
  });

  it('gives every enemy its own Unit', () => {
    const [a, b] = ['enemy-1', 'enemy-2'].map((id) => level.units.get(id));
    expect(a).not.toBe(b);
  });

  it('makes the first tiles of the top-left the deployment zone', () => {
    expect(level.deploymentZone).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]);
    expect(level.deploymentZone).toHaveLength(DEPLOYMENT_ZONE_SIZE);
  });

  it('leaves the whole deployment zone open and placeable', () => {
    for (const { x, y } of level.deploymentZone) {
      expect(getCell(level.grid, x, y).terrain).toBe('grass');
      expect(canPlaceUnit(level.grid, level.deploymentZone, 'soldier-1', x, y)).toBe(true);
    }
  });

  it('builds a fresh level each call', () => {
    const other = createDemoLevel(20, 15);
    expect(other.units.get('soldier-1')).not.toBe(level.units.get('soldier-1'));
  });
});
