// Renders a little map through the game's own autotile logic
// (src/game/autotile.ts), so a candidate autotile set can be judged as it
// will really look: a base tile everywhere (grass unless --base), the set
// drawn over the cells marked `#`.
// Needs Node 22.6+ (runs TypeScript by stripping types). Usage (from the repo root):
//   node .claude/skills/tileset/scripts/autotile-preview.ts [--scale 3] [--block 1,33] [--inner 2,34] [--base 0,0] [--over 5,34=G] out.png "....../.###G./.#..#./......"
// The map lists rows separated by `/`. `#` is a cell of the set and `.` is
// the base. `--over c,r=X` (repeatable) draws sheet tile [c, r] over every cell
// marked X; uppercase X also counts as a cell of the set (e.g. a gatehouse
// set into a wall), lowercase doesn't.

import { getQuarterShapes, getShapeTile, QUARTERS, type SheetTile } from '../../../../src/game/autotile.ts';
import { createGrid, setTerrain, type Grid } from '../../../../src/game/grid.ts';
import { decode, encode } from './dump-png.js';

const TILE = 32;
const HALF = TILE / 2;

const args = process.argv.slice(2);
const option = (name: string, fallback: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : fallback;
};
const tile = (text: string) => text.split(',').map(Number) as unknown as SheetTile;
const overlays = new Map<string, SheetTile>();
for (let i = args.indexOf('--over'); i >= 0; i = args.indexOf('--over')) {
  const [at, mark] = args.splice(i, 2)[1].split('=');
  overlays.set(mark, tile(at));
}
const scale = Number(option('--scale', '3'));
const base = tile(option('--base', '0,0'));
const autotile = { block: tile(option('--block', '1,33')), inner: tile(option('--inner', '2,34')) };
const [output, layout] = args;

const sheet = decode('src/assets/overworld.png');
const rows = layout.split('/');
const isSet = (mark: string) => mark === '#' || (overlays.has(mark) && mark === mark.toUpperCase());
let grid: Grid = createGrid(rows[0].length, rows.length);
rows.forEach((row, y) =>
  [...row].forEach((mark, x) => {
    if (isSet(mark)) grid = setTerrain(grid, x, y, 'set');
  }),
);

const width = grid.width * TILE;
const height = grid.height * TILE;
// The base tile under everything.
const scene: number[][][] = Array.from({ length: height }, (_, y) =>
  Array.from({ length: width }, (_, x) => sheet[base[1] * TILE + (y % TILE)][base[0] * TILE + (x % TILE)].slice(0, 3)),
);
// Blends a size x size block of the sheet at (sx, sy) onto the scene at (x, y).
const blend = (sx: number, sy: number, x: number, y: number, size: number) => {
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const px = sheet[sy + j][sx + i];
      const a = px[3] / 255;
      const under = scene[y + j][x + i];
      scene[y + j][x + i] = [0, 1, 2].map((k) => Math.round(px[k] * a + under[k] * (1 - a)));
    }
  }
};

for (let y = 0; y < grid.height; y++) {
  for (let x = 0; x < grid.width; x++) {
    const shapes = getQuarterShapes(grid, x, y, 'set');
    if (!shapes) continue;
    for (const { name, dx, dy } of QUARTERS) {
      const [column, row] = getShapeTile(autotile, shapes[name], name);
      const ox = dx < 0 ? 0 : HALF;
      const oy = dy < 0 ? 0 : HALF;
      blend(column * TILE + ox, row * TILE + oy, x * TILE + ox, y * TILE + oy, HALF);
    }
  }
}
rows.forEach((row, y) =>
  [...row].forEach((mark, x) => {
    const over = overlays.get(mark);
    if (over) blend(over[0] * TILE, over[1] * TILE, x * TILE, y * TILE, TILE);
  }),
);

encode(
  output,
  Array.from({ length: height * scale }, (_, y) =>
    Array.from({ length: width * scale }, (_, x) => [...scene[Math.floor(y / scale)][Math.floor(x / scale)], 255]),
  ),
);
console.log(`${output}: ${width * scale}x${height * scale}`);
