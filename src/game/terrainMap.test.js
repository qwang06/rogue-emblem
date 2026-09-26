import { describe, expect, it } from 'vitest';
import { getCell } from './grid.js';
import { parseTerrainMap } from './terrainMap.js';

describe('parseTerrainMap', () => {
  it('sizes the grid from the rows', () => {
    const grid = parseTerrainMap(['...', '...']);
    expect(grid.width).toBe(3);
    expect(grid.height).toBe(2);
    expect(grid.cells).toHaveLength(6);
  });

  it('maps each character to its terrain with the default legend', () => {
    const grid = parseTerrainMap(['.~', '~.']);
    expect(getCell(grid, 0, 0).terrain).toBe('grass');
    expect(getCell(grid, 1, 0).terrain).toBe('water');
    expect(getCell(grid, 0, 1).terrain).toBe('water');
    expect(getCell(grid, 1, 1).terrain).toBe('grass');
  });

  it('leaves every tile empty of units', () => {
    const grid = parseTerrainMap(['.~.']);
    for (const cell of grid.cells) expect(cell.unitId).toBeNull();
  });

  it('accepts a custom legend', () => {
    const grid = parseTerrainMap(['ab'], { a: 'forest', b: 'mountain' });
    expect(getCell(grid, 0, 0).terrain).toBe('forest');
    expect(getCell(grid, 1, 0).terrain).toBe('mountain');
  });

  it('handles a single tile', () => {
    const grid = parseTerrainMap(['~']);
    expect(grid.width).toBe(1);
    expect(getCell(grid, 0, 0).terrain).toBe('water');
  });

  it('throws on an empty map', () => {
    expect(() => parseTerrainMap([])).toThrow();
    expect(() => parseTerrainMap([''])).toThrow();
  });

  it('throws on ragged rows', () => {
    expect(() => parseTerrainMap(['...', '..'])).toThrow(/Row 1/);
  });

  it('throws on a character missing from the legend', () => {
    expect(() => parseTerrainMap(['.x.'])).toThrow(/"x" at \(1, 0\)/);
  });

  it("doesn't treat inherited object keys as legend entries", () => {
    expect(() => parseTerrainMap(['.'], Object.create({ '.': 'grass' }))).toThrow();
  });
});
