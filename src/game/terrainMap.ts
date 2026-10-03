// Builds a grid from a text layout: one string per row, one character per
// tile, with a legend mapping each character to its terrain. Lets maps be
// written as data that reads like the map itself.

import { createGrid, type Grid, type Terrain } from './grid.ts';

export type TerrainLegend = Readonly<Record<string, Terrain>>;

export const DEFAULT_TERRAIN_LEGEND: TerrainLegend = Object.freeze({
  '.': 'grass',
  '~': 'water',
  ',': 'dirt',
  '#': 'wall',
});

// Throws if the rows are empty, ragged, or use a character the legend
// doesn't define.
export function parseTerrainMap(rows: readonly string[], legend: TerrainLegend = DEFAULT_TERRAIN_LEGEND): Grid {
  if (rows.length === 0 || rows[0].length === 0) {
    throw new Error('A terrain map needs at least one row and one column');
  }
  const width = rows[0].length;
  const grid = createGrid(width, rows.length);

  const cells = grid.cells.map((cell) => {
    const row = rows[cell.y];
    if (row.length !== width) {
      throw new Error(`Row ${cell.y} is ${row.length} tiles wide, expected ${width}`);
    }
    const char = row[cell.x];
    if (!Object.hasOwn(legend, char)) {
      throw new Error(`Unknown terrain character "${char}" at (${cell.x}, ${cell.y})`);
    }
    return { ...cell, terrain: legend[char] };
  });

  return { ...grid, cells };
}
