import { describe, expect, it } from 'vitest';
import { canPlaceUnit } from './deployment.ts';
import { createDialog } from './dialog.ts';
import { DIALOGS } from '../data/dialogs.ts';
import {
  createDemoLevel,
  DEMO_MAP,
  DEPLOYMENT_ZONE,
  ENEMY_POSITIONS,
  PLAYER_ROSTER,
  STRUCTURE_POSITIONS,
  TREE_POSITIONS,
} from './demoLevel.ts';
import { findUnit, getCell } from './grid.ts';
import { getMovePath, getMoveCost } from './movement.ts';
import { Soldier } from './Soldier.ts';
import { Villager } from './Villager.ts';
import { STRUCTURE_SPRITES, TREE_SPRITES } from './tileset.ts';

describe('createDemoLevel', () => {
  const level = createDemoLevel();

  it('builds its terrain from the demo map, sized 16x14', () => {
    expect(level.grid.width).toBe(16);
    expect(level.grid.height).toBe(14);
    expect(level.grid.height).toBe(DEMO_MAP.length);
  });

  it('is grass with a dirt path', () => {
    const terrains = new Set(level.grid.cells.map((c) => c.terrain));
    expect([...terrains].sort()).toEqual(['dirt', 'grass']);
  });

  it('runs the dirt path from the south edge up through the middle of the gate', () => {
    const [{ x: gateX, y: gateY }] = STRUCTURE_POSITIONS;
    const pathX = gateX + 1;
    for (let y = gateY; y < level.grid.height; y++) expect(getCell(level.grid, pathX, y)!.terrain).toBe('dirt');
    expect(getCell(level.grid, pathX, gateY - 1)!.terrain).toBe('grass');
  });

  it('lets units walk on every tile under the gate, the path down its middle', () => {
    expect(level.structures).toEqual(STRUCTURE_POSITIONS);
    expect(level.structures[0]).not.toBe(STRUCTURE_POSITIONS[0]);
    const [{ x, y, structure }] = level.structures;
    const { width, height } = STRUCTURE_SPRITES[structure];
    expect([width, height]).toEqual([3, 2]);
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const { terrain } = getCell(level.grid, x + dx, y + dy)!;
        expect(terrain).toBe(dx === 1 ? 'dirt' : 'grass');
        expect(getMoveCost(terrain)).toBe(1);
      }
    }
  });

  it('starts with no player units on the map', () => {
    for (const unitId of level.roster) expect(findUnit(level.grid, unitId)).toBeNull();
  });

  it('offers three named player soldiers for deployment', () => {
    expect(level.roster).toEqual(['villager-1', 'villager-2', 'villager-3']);
    for (const unitId of level.roster) {
      expect(level.units.get(unitId)!.team).toBe('player');
      expect(level.units.get(unitId)!.name).toBe(PLAYER_ROSTER[unitId]);
    }
  });

  it('puts each tree on open grass, clear of units, deployment and the gate', () => {
    expect(level.decorations.length).toBeGreaterThan(0);
    for (const { x, y } of level.decorations) {
      expect(getCell(level.grid, x, y)!.terrain).toBe('grass');
      expect(getCell(level.grid, x, y)!.unitId).toBeFalsy();
      expect(level.deploymentZone).not.toContainEqual({ x, y });
    }
  });

  it('places gold ginkgos behind the gate and green ones in the field, one per tile', () => {
    const [gate] = level.structures;
    for (const { y, tree } of level.decorations) {
      expect(TREE_SPRITES).toHaveProperty([tree]);
      if (tree === 'gold_ginkgo') expect(y).toBeLessThan(gate.y);
    }
    const kinds = new Set(level.decorations.map((t) => t.tree));
    expect([...kinds].sort()).toEqual(['gold_ginkgo', 'green_ginkgo']);
    expect(new Set(level.decorations.map(({ x, y }) => `${x},${y}`)).size).toBe(level.decorations.length);
  });

  it('copies the tree positions', () => {
    expect(level.decorations).toEqual(TREE_POSITIONS);
    expect(level.decorations[0]).not.toBe(TREE_POSITIONS[0]);
  });

  it('has room in the deployment zone for the whole roster', () => {
    expect(level.roster.length).toBeLessThanOrEqual(level.deploymentZone.length);
  });

  it('places the enemies on open ground at their positions', () => {
    const enemies = level.grid.cells.filter((c) => c.unitId).map(({ x, y, unitId }) => ({ x, y, unitId }));
    expect(enemies.map(({ x, y }) => ({ x, y }))).toEqual([...ENEMY_POSITIONS].sort((a, b) => a.y - b.y || a.x - b.x));
    for (const { x, y, unitId } of enemies) {
      expect(getMoveCost(getCell(level.grid, x, y)!.terrain)).toBe(1);
      expect(level.units.get(unitId!)!.team).toBe('enemy');
    }
  });

  it('makes the player units level 1 villagers and the enemies level 1 soldiers', () => {
    for (const unit of level.units.values()) {
      expect(unit).toBeInstanceOf(unit.team === 'player' ? Villager : Soldier);
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
      expect(getMoveCost(getCell(level.grid, x, y)!.terrain)).toBe(1);
      expect(canPlaceUnit(level.grid, level.deploymentZone, 'villager-1', x, y)).toBe(true);
    }
  });

  it('lets every enemy walk to the deployment zone', () => {
    for (const unitId of ['enemy-1', 'enemy-2', 'enemy-3']) {
      const origin = findUnit(level.grid, unitId)!;
      const path = getMovePath(level.grid, origin, level.deploymentZone[1], Infinity, {
        canPassThrough: () => true,
      });
      expect(path).not.toBeNull();
    }
  });

  it('opens with a dialog spoken by the roster and the enemy', () => {
    expect(level.dialogs).toBe(DIALOGS.demo);
    expect(() => createDialog(level.dialogs.opening)).not.toThrow();
    const speakers = new Set(level.dialogs.opening.map((line) => line.speaker));
    for (const name of Object.values(PLAYER_ROSTER)) expect(speakers.has(name)).toBe(true);
    for (const line of level.dialogs.opening) {
      expect(line.side).toBe(line.team === 'player' ? 'left' : 'right');
      // The stand-in art matches the units on the map: villagers vs. soldiers.
      expect(line.unitClass).toBe(line.team === 'player' ? 'villager' : 'soldier');
    }
  });

  it('builds a fresh level each call', () => {
    const other = createDemoLevel();
    expect(other.units.get('villager-1')).not.toBe(level.units.get('villager-1'));
  });
});
