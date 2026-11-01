// Makes the autumn overworld sheet from the summer one: its greens are
// recolored (grass, mountain tufts, the dark-grass meadow set, and the grass
// lip under buildings and walls; the green building palette keeps its
// greens), and the forest tiles are redrawn as bare trees, each standing
// where a leafy one stood (3 conifers, 3 round trees, 2 big round trees),
// over a little pile of its fallen leaves. Run from the repo root:
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
// The forest tiles (FOREST_ART in src/game/tileset.ts), as 16px art drawn
// at 2x: T trunk, D branch, L and l fallen leaves.
const BARE_TREES = [
  [
    '................',
    '...D............',
    '...D........D...',
    '..DTD.......D...',
    '.D.T........TD..',
    '...TD...D..DT...',
    '.DDT....D...T.D.',
    '...T.D.DTD.DT...',
    '..DT....T...TDD.',
    '.D.TD..DT..DT...',
    '...T.D..TD..T.D.',
    '..lTL..DT...T...',
    '..LlL...T..lTL..',
    '........T..LlL..',
    '.......lTL......',
    '.......LlL......',
  ],
  [
    '................',
    '.........D......',
    '.......D.D.D....',
    '........DDD.....',
    '....D....D......',
    '..D.D.D..T.D....',
    '...DDD...TD.....',
    '....T....T......',
    '....T....T.D.D..',
    '....T....T..D...',
    '....T....T.DDD.D',
    '....T....T..T.D.',
    '...lTL..LTl.T...',
    '...LlL..lLL.T...',
    '...........lTL..',
    '...........LlL..',
  ],
  [
    '...D............',
    '.D.D.D..........',
    '..DD.D...D.D....',
    'D..DD...D..D..D.',
    '.D.TD.D..D.D.D..',
    '..DTDD....DDD...',
    '...TD....D.TD.D.',
    '...TD.....DTDD..',
    '...TD......TD...',
    '...TD......TD...',
    '...TD......TD...',
    '..lTDL.....TD...',
    '..LllL.....TD...',
    '...........TD...',
    '..........lTDL..',
    '..........LllL..',
  ],
];
const BARE_COLORS = { T: '8f4d57', D: '5e2f36', L: 'c06a32', l: '8a3424' };
// Each forest tile, and its variant with a mountain peak poking up from the
// cell below, whose peak (these colors) is kept over the bare trees.
const FOREST_TILES = [
  [0, 8],
  [1, 9],
  [2, 10],
];
const PEAK_COLORS = new Set(['a47d72', '865757', 'f5ffe8', 'a3a7c2']);
FOREST_TILES.forEach(([plain, peaked], i) => {
  for (const column of [plain, peaked]) {
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const px = rows[TILE + y][column * TILE + x];
        if (column === peaked && px[3] > 0 && PEAK_COLORS.has(hex(px))) continue;
        const art = BARE_TREES[i][y >> 1][x >> 1];
        rows[TILE + y][column * TILE + x] = art === '.' ? [0, 0, 0, 0] : [...rgb(BARE_COLORS[art]), 255];
      }
    }
  }
});

encode(output, rows);
console.log(`${input} -> ${output}`);
