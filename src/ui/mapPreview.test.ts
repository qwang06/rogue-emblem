import { describe, expect, it } from 'vitest';
import { createDemoLevel } from '../game/demoLevel.ts';
import { REGION_CONFIGS } from '../data/regions.ts';
import { createStageLevel } from '../game/warband/stageLevel.ts';
import { getMapPreview } from './mapPreview.ts';

describe('getMapPreview', () => {
  const level = createStageLevel(5, REGION_CONFIGS[0]);
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
    // A unit standing on a building shows instead (see 'marks each enemy').
    const free = (level.buildings ?? []).filter(
      ({ x, y }) => !level.grid.cells.find((c) => c.x === x && c.y === y)!.unitId,
    );
    expect(free.length).toBeGreaterThan(0);
    for (const { x, y } of free) expect(at(x, y).marker).toBe('building');
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
