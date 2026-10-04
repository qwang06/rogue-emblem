import { describe, expect, it } from 'vitest';
import { createDemoLevel } from '../game/demoLevel.ts';
import { DUNGEON_CONFIGS } from '../data/dungeon.ts';
import { createDungeonLevel } from '../game/dungeonLevel.ts';
import { getMapPreview } from './mapPreview.ts';

describe('getMapPreview', () => {
  const level = createDungeonLevel(5, DUNGEON_CONFIGS[0]);
  const cells = getMapPreview(level);
  const at = (x: number, y: number) => cells.find((c) => c.x === x && c.y === y)!;

  it('has a cell per tile with its terrain', () => {
    expect(cells).toHaveLength(level.grid.width * level.grid.height);
    for (const cell of level.grid.cells) expect(at(cell.x, cell.y).terrain).toBe(cell.terrain);
  });

  it('marks each enemy', () => {
    const enemies = level.grid.cells.filter((c) => c.unitId?.startsWith('enemy'));
    expect(enemies.length).toBeGreaterThan(0);
    for (const { x, y } of enemies) expect(at(x, y).marker).toBe('enemy');
    expect(cells.filter((c) => c.marker === 'enemy')).toHaveLength(enemies.length);
  });

  it('marks buildings and the deployment zone', () => {
    for (const { x, y } of level.buildings ?? []) expect(at(x, y).marker).toBe('building');
    for (const { x, y } of level.deploymentZone) expect(at(x, y).marker).toBe('deploy');
  });

  it('marks trees on tiles with nothing else', () => {
    for (const { x, y } of level.decorations ?? []) expect(['tree', 'enemy']).toContain(at(x, y).marker);
  });

  it('works for levels without buildings or trees', () => {
    const demo = createDemoLevel();
    expect(getMapPreview({ ...demo, buildings: undefined, decorations: undefined })).toHaveLength(
      demo.grid.width * demo.grid.height,
    );
  });
});
