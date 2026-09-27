import { describe, expect, it } from 'vitest';
import { parseTerrainMap } from './terrainMap.js';
import { getEdgePiece, getTerrainFrame } from './terrainTiles.js';
import { TERRAIN_EDGE_FRAMES, TERRAIN_FRAMES } from './tileset.js';

describe('getEdgePiece', () => {
  // A 3x3 pond ringed by grass covers every piece of the set.
  const pond = parseTerrainMap([
    '.....',
    '.~~~.',
    '.~~~.',
    '.~~~.',
    '.....',
  ]);

  it('picks corners where two sides border other terrain', () => {
    expect(getEdgePiece(pond, 1, 1)).toBe('top-left');
    expect(getEdgePiece(pond, 3, 1)).toBe('top-right');
    expect(getEdgePiece(pond, 1, 3)).toBe('bottom-left');
    expect(getEdgePiece(pond, 3, 3)).toBe('bottom-right');
  });

  it('picks edges where one side borders other terrain', () => {
    expect(getEdgePiece(pond, 2, 1)).toBe('top');
    expect(getEdgePiece(pond, 1, 2)).toBe('left');
    expect(getEdgePiece(pond, 3, 2)).toBe('right');
    expect(getEdgePiece(pond, 2, 3)).toBe('bottom');
  });

  it('picks center when no side borders other terrain', () => {
    expect(getEdgePiece(pond, 2, 2)).toBe('center');
  });

  it('treats the map edge as more of the same terrain', () => {
    const grid = parseTerrainMap(['~~', '~.']);
    expect(getEdgePiece(grid, 0, 0)).toBe('inner-bottom-right');
    expect(getEdgePiece(grid, 1, 0)).toBe('bottom');
    expect(getEdgePiece(grid, 0, 1)).toBe('right');
  });

  it('picks an inner corner when only one diagonal borders other terrain', () => {
    const lake = parseTerrainMap([
      '.~~~.',
      '~~~~~',
      '~~~~~',
      '~~~~~',
      '.~~~.',
    ]);
    expect(getEdgePiece(lake, 1, 1)).toBe('inner-top-left');
    expect(getEdgePiece(lake, 3, 1)).toBe('inner-top-right');
    expect(getEdgePiece(lake, 3, 3)).toBe('inner-bottom-right');
    expect(getEdgePiece(lake, 1, 3)).toBe('inner-bottom-left');
  });

  it('falls back to center when more than one diagonal borders other terrain', () => {
    const grid = parseTerrainMap(['.~.', '~~~', '~~~']);
    expect(getEdgePiece(grid, 1, 1)).toBe('center');
  });

  it('keeps an edge piece even when a diagonal also borders other terrain', () => {
    const grid = parseTerrainMap(['...', '~~~', '~~.']);
    expect(getEdgePiece(grid, 1, 1)).toBe('top');
  });

  it('stays center when bordered on both sides of an axis, whatever the diagonals', () => {
    const grid = parseTerrainMap(['~~~', '.~.', '~~~']);
    expect(getEdgePiece(grid, 1, 1)).toBe('center');
  });

  it('falls back to the middle of an axis bordered on both sides', () => {
    const channel = parseTerrainMap(['...', '~~~', '...']);
    expect(getEdgePiece(channel, 1, 1)).toBe('center');
    const column = parseTerrainMap(['.~.', '.~.', '.~.']);
    expect(getEdgePiece(column, 1, 1)).toBe('center');
  });

  it('keeps the other axis when one axis is bordered on both sides', () => {
    const inlet = parseTerrainMap(['.~.', '.~.', '...']);
    expect(getEdgePiece(inlet, 1, 0)).toBe('center');
    expect(getEdgePiece(inlet, 1, 1)).toBe('bottom');
  });

  it('works for any terrain, relative to its neighbors', () => {
    const island = parseTerrainMap(['~~~', '~.~', '~~~']);
    expect(getEdgePiece(island, 1, 1)).toBe('center');
    expect(getEdgePiece(island, 0, 0)).toBe('inner-bottom-right');
    expect(getEdgePiece(island, 1, 0)).toBe('bottom');
  });
});

describe('getTerrainFrame', () => {
  const grid = parseTerrainMap([
    '...',
    '.~~',
    '.~~',
  ]);

  it('uses the edge set for terrain that has one', () => {
    expect(getTerrainFrame(grid, 1, 1)).toBe(TERRAIN_EDGE_FRAMES.water['top-left']);
    expect(getTerrainFrame(grid, 2, 1)).toBe(TERRAIN_EDGE_FRAMES.water.top);
    expect(getTerrainFrame(grid, 1, 2)).toBe(TERRAIN_EDGE_FRAMES.water.left);
    expect(getTerrainFrame(grid, 2, 2)).toBe(TERRAIN_EDGE_FRAMES.water.center);
  });

  it('maps the water set to frames 18-20, 36-38, 54-56 and inner corners to 90-93', () => {
    expect(getTerrainFrame(grid, 1, 1)).toBe(18);
    expect(getTerrainFrame(grid, 2, 2)).toBe(37);
    expect(TERRAIN_EDGE_FRAMES.water).toMatchObject({
      'inner-top-left': 90,
      'inner-top-right': 91,
      'inner-bottom-right': 92,
      'inner-bottom-left': 93,
    });
  });

  it('uses the inner corner frame for a diagonal-only border', () => {
    const lake = parseTerrainMap(['.~~', '~~~', '~~~']);
    expect(getTerrainFrame(lake, 1, 1)).toBe(90);
  });

  it("falls back to the set's center when it lacks a piece", () => {
    const lake = parseTerrainMap(['.~~', '~~~', '~~~']);
    const edgeFrames = { water: { center: 7 } };
    expect(getTerrainFrame(lake, 1, 1, { edgeFrames })).toBe(7);
  });

  it('uses the plain frame for terrain without an edge set', () => {
    expect(getTerrainFrame(grid, 0, 0)).toBe(TERRAIN_FRAMES.grass);
  });

  it('falls back to grass for unknown terrain', () => {
    const unknown = { ...grid, cells: grid.cells.map((cell) => ({ ...cell, terrain: 'lava' })) };
    expect(getTerrainFrame(unknown, 0, 0)).toBe(TERRAIN_FRAMES.grass);
  });

  it('accepts custom frame tables', () => {
    const frames = { grass: 1 };
    const edgeFrames = { grass: { center: 99, bottom: 98 } };
    expect(getTerrainFrame(grid, 0, 0, { frames, edgeFrames })).toBe(99);
    expect(getTerrainFrame(grid, 1, 0, { frames, edgeFrames })).toBe(98);
  });
});
