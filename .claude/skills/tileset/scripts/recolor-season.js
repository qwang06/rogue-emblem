// Makes a season's overworld sheet from the summer one (see "Seasonal
// terrain sheets" in the tileset skill). Each season swaps colors by rules,
// the first rule covering a pixel winning, and redraws the forest tiles as
// bare trees, each standing where a leafy one stood (3 conifers, 3 round
// trees, 2 big round trees), over a little pile at its foot. Run from the
// repo root:
//
//   node .claude/skills/tileset/scripts/recolor-season.js autumn src/assets/overworld.png src/assets/overworld-autumn.png
//   node .claude/skills/tileset/scripts/recolor-season.js underworld src/assets/overworld.png src/assets/overworld-underworld.png

import { decode, encode } from './dump-png.js';

const [season, input, output] = process.argv.slice(2);

const TILE = 32;
// Sheet areas, in tiles: [first column, last column + 1, first row, last row + 1].
const ALL = [0, 42, 0, 63];
const TERRAIN = [0, 42, 0, 33]; // everything above the buildings
const PEAKS = [0, 42, 0, 3]; // trees, mountains and bridges
const MEADOW = [8, 15, 3, 8]; // the dark-grass set
const LIQUID = [0, 42, 3, 33]; // the puddle set and every water set

const SEASONS = {
  // Golden grass and rust meadows; the green building palette keeps its
  // greens (tree shade #3b7d4f is one of them, so it only changes above).
  autumn: {
    rules: [
      [MEADOW, { '84b14d': 'a94f27', abc75c: 'c06a32' }],
      [TERRAIN, { '3b7d4f': '8a3424' }],
      [
        ALL,
        {
          b7d463: 'e0a24e', // grass
          ceda62: 'ebb55c', // grass specks
          '84b14d': 'c06a32', // mountain tufts, building and wall lip
          abc75c: 'd68a3f', // meadow specks
        },
      ],
    ],
    bare: { T: '8f4d57', D: '5e2f36', L: 'c06a32', l: '8a3424' },
  },
  // Dead ash ground, charred meadows, black rock, and lava for water.
  underworld: {
    rules: [
      [MEADOW, { '84b14d': '3f3330', abc75c: '524240' }],
      [PEAKS, { a3a7c2: '6e5f5c', f5ffe8: 'a8968c', a47d72: '574846', 865757: '3a2f30' }],
      [
        LIQUID,
        {
          '4fa4b8': 'd23c1e', // water
          '686f99': 'a3241a', // deep water
          '4c6885': '7a1a18', // water shade
          a3a7c2: 'ef7a26', // ripples
          dfe0e8: 'ffcf4a', // foam
          '92e8c0': 'ffa733', // mint foam
          a47d72: '574846', // shore rock
          865757: '3a2f30', // shore rock shade
          d09c8e: '7a6862', // shore rock and sand edge
          ffc2a1: '8f7d70', // sand beach and dirt path
          ffae70: '6f5d52', // beach sand shade
          f0b541: 'a99686', // sand specks
        },
      ],
      [TERRAIN, { '3b7d4f': '2e2424' }],
      [
        ALL,
        {
          b7d463: '6b5c50', // grass
          ceda62: '766656', // grass specks
          '84b14d': '524240', // mountain tufts, building and wall lip
          abc75c: '5e4c46', // meadow specks
        },
      ],
    ],
    bare: { T: '4a3a3a', D: '231c1e', L: '8a7a70', l: '5a4c46' },
  },
};

const config = SEASONS[season];
if (!config || !input || !output) {
  throw new Error(`Usage: recolor-season.js <${Object.keys(SEASONS).join('|')}> <summer sheet> <output sheet>`);
}

const hex = ([r, g, b]) => [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
const rgb = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
const inArea = ([c0, c1, r0, r1], x, y) => x >= c0 * TILE && x < c1 * TILE && y >= r0 * TILE && y < r1 * TILE;

const rows = decode(input).map((row, y) =>
  row.map((px, x) => {
    if (px[3] === 0) return px;
    const color = hex(px);
    for (const [area, colors] of config.rules) {
      if (inArea(area, x, y) && colors[color]) return [...rgb(colors[color]), px[3]];
    }
    return px;
  }),
);

// The forest tiles (FOREST_ART in src/game/tileset.ts), as 16px art drawn
// at 2x: T trunk, D branch, L and l the pile at its foot (fallen leaves,
// ash), colored by the season's `bare`.
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
// Each forest tile, and its variant with a mountain peak poking up from the
// cell below, whose peak (these summer colors) is kept over the bare trees.
const FOREST_TILES = [
  [0, 8],
  [1, 9],
  [2, 10],
];
const summer = decode(input);
const PEAK_COLORS = new Set(['a47d72', '865757', 'f5ffe8', 'a3a7c2']);
FOREST_TILES.forEach(([plain, peaked], i) => {
  for (const column of [plain, peaked]) {
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const px = summer[TILE + y][column * TILE + x];
        if (column === peaked && px[3] > 0 && PEAK_COLORS.has(hex(px))) continue;
        const art = BARE_TREES[i][y >> 1][x >> 1];
        rows[TILE + y][column * TILE + x] = art === '.' ? [0, 0, 0, 0] : [...rgb(config.bare[art]), 255];
      }
    }
  }
});

encode(output, rows);
console.log(`${input} -> ${output}`);
