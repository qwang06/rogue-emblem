import { describe, expect, it } from 'vitest';
import { canPlaceUnit } from './deployment.js';
import { createDemoLevel, DEMO_MAP, DEPLOYMENT_ZONE, ENEMY_POSITIONS, PLAYER_ROSTER } from './demoLevel.js';
import { findUnit, getCell } from './grid.js';
import { getMovePath } from './movement.js';
import { Soldier } from './Soldier.js';

describe('createDemoLevel', () => {
  const level = createDemoLevel();

  it('builds its terrain from the demo map, sized 20x15', () => {
    expect(level.grid.width).toBe(20);
    expect(level.grid.height).toBe(15);
    expect(level.grid.height).toBe(DEMO_MAP.length);
  });

  it('is only grass and water', () => {
    const terrains = new Set(level.grid.cells.map((c) => c.terrain));
    expect([...terrains].sort()).toEqual(['grass', 'water']);
  });

  it('separates the two islands with water except for the bridge', () => {
    expect(getCell(level.grid, 7, 5).terrain).toBe('water');
    expect(getCell(level.grid, 7, 7).terrain).toBe('grass');
    expect(getCell(level.grid, 7, 8).terrain).toBe('grass');
    expect(getCell(level.grid, 7, 9).terrain).toBe('water');
  });

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

  it('places the enemies on grass at their positions', () => {
    const enemies = level.grid.cells.filter((c) => c.unitId).map(({ x, y, unitId }) => ({ x, y, unitId }));
    expect(enemies.map(({ x, y }) => ({ x, y }))).toEqual(
      [...ENEMY_POSITIONS].sort((a, b) => a.y - b.y || a.x - b.x),
    );
    for (const { x, y, unitId } of enemies) {
      expect(getCell(level.grid, x, y).terrain).toBe('grass');
      expect(level.units.get(unitId).team).toBe('enemy');
    }
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

  it('uses the deployment zone tiles, as a copy', () => {
    expect(level.deploymentZone).toEqual(DEPLOYMENT_ZONE);
    expect(level.deploymentZone[0]).not.toBe(DEPLOYMENT_ZONE[0]);
  });

  it('leaves the whole deployment zone open and placeable', () => {
    for (const { x, y } of level.deploymentZone) {
      expect(getCell(level.grid, x, y).terrain).toBe('grass');
      expect(canPlaceUnit(level.grid, level.deploymentZone, 'soldier-1', x, y)).toBe(true);
    }
  });

  it('lets every enemy walk to the deployment zone', () => {
    for (const unitId of ['enemy-1', 'enemy-2', 'enemy-3']) {
      const origin = findUnit(level.grid, unitId);
      const path = getMovePath(level.grid, origin, level.deploymentZone[1], Infinity, {
        canPassThrough: () => true,
      });
      expect(path).not.toBeNull();
    }
  });

  it('builds a fresh level each call', () => {
    const other = createDemoLevel();
    expect(other.units.get('soldier-1')).not.toBe(level.units.get('soldier-1'));
  });
});
