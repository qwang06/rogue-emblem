import { describe, expect, it } from 'vitest';
import { describeTerrain, getTerrainIconTiles, getTerrainLabel } from './terrainInfo.ts';

describe('getTerrainLabel', () => {
  it('names the known terrains', () => {
    expect(getTerrainLabel('grass')).toBe('Plains');
    expect(getTerrainLabel('forest')).toBe('Forest');
    expect(getTerrainLabel('spikes')).toBe('Spike Trap');
  });

  it('treats no terrain as plains and capitalizes unknown ids', () => {
    expect(getTerrainLabel(null)).toBe('Plains');
    expect(getTerrainLabel('lava_pool')).toBe('Lava pool');
  });
});

describe('describeTerrain', () => {
  it('reports the move cost of passable terrain', () => {
    expect(describeTerrain('forest')).toEqual({ label: 'Forest', moveCost: 2 });
    expect(describeTerrain(null)).toEqual({ label: 'Plains', moveCost: 1 });
  });

  it('reports impassable terrain as having no move cost', () => {
    expect(describeTerrain('water')).toEqual({ label: 'Water', moveCost: null });
    expect(describeTerrain('mountain').moveCost).toBeNull();
  });

  it('takes other cost tables', () => {
    expect(describeTerrain('water', { water: 1 })).toEqual({ label: 'Water', moveCost: 1 });
  });
});

describe('getTerrainIconTiles', () => {
  it('layers grass under a patch, a feature or a crossing', () => {
    expect(getTerrainIconTiles(null)).toEqual([[0, 0]]);
    expect(getTerrainIconTiles('grass')).toEqual([[0, 0]]);
    expect(getTerrainIconTiles('water')).toEqual([
      [0, 0],
      [5, 9],
    ]);
    expect(getTerrainIconTiles('forest')).toEqual([
      [0, 0],
      [0, 1],
    ]);
    expect(getTerrainIconTiles('bridge')).toHaveLength(3);
  });

  it('shows the grass under a terrain with no plain tile', () => {
    expect(getTerrainIconTiles('wall')).toEqual([[0, 0]]);
    expect(getTerrainIconTiles('spikes')).toEqual([[0, 0]]);
  });
});
