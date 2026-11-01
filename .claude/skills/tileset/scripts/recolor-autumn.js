// Recolors the summer overworld sheet into the autumn one: only its greens
// change (grass, tree bodies and shade, mountain tufts, the dark-grass
// meadow set, and the grass lip under buildings and walls). The green
// building palette keeps its greens. Run from the repo root:
//
//   node .claude/skills/tileset/scripts/recolor-autumn.js src/assets/overworld.png src/assets/overworld-autumn.png

import { decode, encode } from './dump-png.js';

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: recolor-autumn.js <summer sheet> <autumn sheet>');

const TILE = 32;
// Everywhere on the sheet, except tree shade, which is also the green
// building palette's: only swapped in the terrain rows (0-32).
const COLORS = {
  b7d463: 'e0a24e', // grass
  ceda62: 'ebb55c', // grass specks
  '84b14d': 'c06a32', // tree bodies, mountain tufts, building and wall lip
  abc75c: 'd68a3f', // meadow specks
};
const TREE_SHADE = { '3b7d4f': '8a3424' };
const TERRAIN_ROWS = 33;
// The dark-grass meadow set (columns 8-14, rows 3-7) goes a deeper rust so
// it reads against the golden grass.
const MEADOW = { '84b14d': 'a94f27', abc75c: 'c06a32' };
const inMeadow = (x, y) => x >= 8 * TILE && x < 15 * TILE && y >= 3 * TILE && y < 8 * TILE;

const hex = ([r, g, b]) => [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
const rgb = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));

const rows = decode(input).map((row, y) =>
  row.map((px, x) => {
    if (px[3] === 0) return px;
    const color = hex(px);
    const swap = (inMeadow(x, y) && MEADOW[color]) || COLORS[color] || (y < TERRAIN_ROWS * TILE && TREE_SHADE[color]);
    return swap ? [...rgb(swap), px[3]] : px;
  }),
);
encode(output, rows);
console.log(`${input} -> ${output}`);
