// Makes a season's overworld sheet from the summer one (see "Seasonal
// terrain sheets" in the tileset skill). Each season swaps colors by rules,
// the first rule covering a pixel winning, and redraws the forest tiles
// (bare trees, or planters), each item standing where a leafy tree stood (3
// conifers, 3 round trees, 2 big round trees). The starship also redraws
// the base grass tile as deck plating and the mountains as machinery. Run
// from the repo root:
//
//   node .claude/skills/tileset/scripts/recolor-season.js autumn src/assets/overworld.png src/assets/overworld-autumn.png
//   node .claude/skills/tileset/scripts/recolor-season.js underworld src/assets/overworld.png src/assets/overworld-underworld.png
//   node .claude/skills/tileset/scripts/recolor-season.js starship src/assets/overworld.png src/assets/overworld-starship.png

import { decode, encode } from './dump-png.js';

const [season, input, output] = process.argv.slice(2);

const TILE = 32;
// Sheet areas, in tiles: [first column, last column + 1, first row, last row + 1].
const ALL = [0, 42, 0, 63];
const TERRAIN = [0, 42, 0, 33]; // everything above the buildings
const PEAKS = [0, 42, 0, 3]; // trees, mountains and bridges
const MEADOW = [8, 15, 3, 8]; // the dark-grass set
const LIQUID = [0, 42, 3, 33]; // the puddle set and every water set
const WALKWAY = [0, 4, 3, 7]; // the sand-patch set, the dirt path
const BEACH = [0, 42, 13, 25]; // the sandy-beach water set and its island rings
const DEEP = [0, 42, 28, 33]; // deep water

// Hand-drawn 16px tiles, drawn at 2x. Each character is a color key of the
// season's `colors`; '.' is transparent.

// The forest tiles (FOREST_ART in src/game/tileset.ts) as bare trees:
// T trunk, D branch, L and l the pile at its foot (fallen leaves, ash).
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

// The forest tiles as hydroponic planters, one per tree: d, F, f, h the
// plant (outline, lit, shade, highlight), o, P, g the planter (outline,
// metal, light).
const PLANTERS = [
  [
    '................',
    '................',
    '..ddd...........',
    '.dFffd.....ddd..',
    '.dhffd....dFffd.',
    '.dFffd.ddddhffd.',
    '.dFffddFffdFffd.',
    '.dFffddhffdFffd.',
    '..ddd.dFffdFffd.',
    '.ooooodFffdFffd.',
    '.oPgPodFffdddd..',
    '.ooooo.dddooooo.',
    '......oooooPgPo.',
    '......oPgPooooo.',
    '......ooooo.....',
    '................',
  ],
  [
    '................',
    '........ddd.....',
    '........dfd.....',
    '.......dhffd....',
    '...ddd.dFffd....',
    '..dFffddFffd....',
    '..dhffddFffd....',
    '..dFffddFffddd..',
    '..dFffd.dfdFffd.',
    '...ddd..dddhffd.',
    '..oooooooodFffd.',
    '..oPgPooPgPddd..',
    '..ooooooooooooo.',
    '..........oPgPo.',
    '..........ooooo.',
    '................',
  ],
  [
    '..dddd..........',
    '.dFFffd.........',
    '.dhFffd..dddd...',
    'dFFFfffddFFffd..',
    'dFFFfffddhFffd..',
    'dFFFfffddFFffd..',
    '.dFFffddFFFfffd.',
    '.dFFffddFFFfffd.',
    '..dddd..dFFffd..',
    'oooooooodFFffd..',
    'oPPgPPPodFFffd..',
    'oooooooo.dddd...',
    '.......oooooooo.',
    '.......oPPgPPPo.',
    '.......oooooooo.',
    '................',
  ],
];

// Deck plating for the base grass tile: b seam, c lit edge, a plate,
// s shaded edge, r rivet.
const DECK = [
  'bbbbbbbbbbbbbbbb',
  'bccccccccccccccs',
  'bcrcaaaaaaaacrcs',
  'bcaaaaaaaaaaaaas',
  'bcaaaaaaaaaaaaas',
  'bcaaaaaaaaaaaaas',
  'bcaaaaaaaaaaaaas',
  'bcaaaaaaaaaaaaas',
  'bcaaaaaaaaaaaaas',
  'bcaaaaaaaaaaaaas',
  'bcaaaaaaaaaaaaas',
  'bcaaaaaaaaaaaaas',
  'bcaaaaaaaaaaaaas',
  'bcrcaaaaaaaacrcs',
  'bcaaaaaaaaaaaaas',
  'bsssssssssssssss',
];

// The mountains as machinery stacks (MOUNTAIN_ART): the cap pokes into the
// cell north of a column's top, as a mountain's peak does; three bodies;
// a compact one for the top of a column. o outline, H lit, M metal,
// S shade, K dark band, G and g glow, Y warning stripe.
const MACHINE_CAP = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.......oo.......',
  '.......GG.......',
  '......oKKo......',
  '....ooHHMMoo....',
  '...oHHMMMMMSo...',
  '..oHMMMMMMMSSo..',
  '..oHMMMMMMMSSo..',
  '..oKKKKKKKKKKo..',
  '..oHHMMMMMMSSo..',
];
const MACHINE_BODIES = [
  [
    '..oHMMMMMMMSSo..',
    '..oHMoooooMSSo..',
    '..oHMoGGgoMSSo..',
    '..oHMoGggoMSSo..',
    '..oHMoooooMSSo..',
    '..oHMMMMMMMSSo..',
    '..oKKKKKKKKKKo..',
    '..oYKYKYKYKYKo..',
    '..oKYKYKYKYKYo..',
    '..oHMMMMMMMSSo..',
    '..oHMMMMMMMSSo..',
    '.ooHMMMMMMMSSoo.',
    '.oHHMMMMMMMSSSo.',
    '.oKKKKKKKKKKKKo.',
    '.oooooooooooooo.',
    '................',
  ],
  [
    '..oHMMMMMMMSSo..',
    '..oHMKKKKKMSSo..',
    '..oHMMMMMMMSSo..',
    '..oHMKKKKKMSSo..',
    '..oHMMMMMMMSSo..',
    '..oHMKKKKKMSSo..',
    '..oHMMMMMMMSSo..',
    '..oHMMMGMMMSSo..',
    '..oHMMMgMMMSSo..',
    '..oKKKKKKKKKKo..',
    '..oHMMMMMMMSSo..',
    '.ooHMMMMMMMSSoo.',
    '.oHHMMMMMMMSSSo.',
    '.oKKKKKKKKKKKKo.',
    '.oooooooooooooo.',
    '................',
  ],
  [
    '..oHMMMMMMMSSo..',
    '.KoHMMMMMMMSSoK.',
    '.KoHMMoooMMSSoK.',
    '.KoHMMoGoMMSSoK.',
    '.GoHMMoooMMSSoG.',
    '.KoHMMMMMMMSSoK.',
    '.KoKKKKKKKKKKoK.',
    '.KoHMMMMMMMSSoK.',
    '.KoHMMMMMMMSSoK.',
    '.KoYKYKYKYKYKoK.',
    '.KoHMMMMMMMSSoK.',
    '.ooHMMMMMMMSSoo.',
    '.oHHMMMMMMMSSSo.',
    '.oKKKKKKKKKKKKo.',
    '.oooooooooooooo.',
    '................',
  ],
];
const MACHINE_COMPACT = [
  '................',
  '................',
  '.......GG.......',
  '......oKKo......',
  '....ooHHMMoo....',
  '...oHHMMMMMSo...',
  '..oHMMMMMMMSSo..',
  '..oKKKKKKKKKKo..',
  '..oHMMMMMMMSSo..',
  '..oHMoooooMSSo..',
  '..oHMoGGgoMSSo..',
  '..oHMoooooMSSo..',
  '.ooHMMMMMMMSSoo.',
  '.oKKKKKKKKKKKKo.',
  '.oooooooooooooo.',
  '................',
];

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
    forest: { art: BARE_TREES, colors: { T: '8f4d57', D: '5e2f36', L: 'c06a32', l: '8a3424' } },
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
    forest: { art: BARE_TREES, colors: { T: '4a3a3a', D: '231c1e', L: '8a7a70', l: '5a4c46' } },
  },
  // A habitable starship deck: steel plating, green hydroponic beds and
  // planters, glowing coolant channels, viewports onto space, lit walkways,
  // and machinery for mountains.
  starship: {
    rules: [
      [MEADOW, {}],
      [DEEP, { '686f99': '121628', '4c6885': '1e2440', a3a7c2: 'e8f0ff', '4fa4b8': '29b6d6' }],
      [WALKWAY, { ffc2a1: 'c9ced6', d09c8e: 'f2c84b', f0b541: 'f2c84b' }],
      [BEACH, { ffc2a1: 'a9b3c2', ffae70: '8b96a9', d09c8e: '5c6578' }],
      [
        LIQUID,
        {
          '4fa4b8': '29b6d6', // coolant
          '686f99': '1d6f95', // deep coolant
          '4c6885': '1d6f95', // coolant shade
          a3a7c2: '8ff0ff', // ripples
          dfe0e8: 'e6fdff', // foam
          '92e8c0': 'b8fbff', // mint foam
          a47d72: '8b96a9', // rim
          865757: '5c6578', // rim shade
          d09c8e: 'c3ccd9', // rim light
        },
      ],
      [ALL, { '84b14d': '5c6578' }], // building and wall lip: a shadow on the deck
    ],
    forest: {
      art: PLANTERS,
      colors: { d: '2f5a3c', F: '9ccc5a', f: '5d9a45', h: 'c4e07a', o: '3a4152', P: '8b96a9', g: '6ff3ff' },
    },
    deck: { art: DECK, colors: { b: '5f6879', c: '939dae', a: '7f899b', s: '6b7486', r: 'b4bdcb' } },
    machines: {
      colors: {
        o: '262b38',
        H: 'c3ccd9',
        M: '8b96a9',
        S: '5c6578',
        K: '3a4152',
        G: '6ff3ff',
        g: '23a9cf',
        Y: 'f2c84b',
      },
    },
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

// Paints 16px `art` (2x) into sheet tile [column, row], in `colors`;
// `over` keeps what's there under the art's transparent pixels.
function paint(column, row, art, colors, over = false) {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const key = art[y >> 1][x >> 1];
      if (key === '.' && over) continue;
      rows[row * TILE + y][column * TILE + x] = key === '.' ? [0, 0, 0, 0] : [...rgb(colors[key]), 255];
    }
  }
}

// Each forest tile, and its variant with a mountain peak poking up from the
// cell below, whose peak (these summer colors, recolored) is kept over the new art,
// or, with machines, replaced by a machine's cap.
const FOREST_TILES = [
  [0, 8],
  [1, 9],
  [2, 10],
];
const summer = decode(input);
const recolored = rows.map((row) => row.slice());
const PEAK_COLORS = new Set(['a47d72', '865757', 'f5ffe8', 'a3a7c2']);
const { forest, deck, machines } = config;
FOREST_TILES.forEach(([plain, peaked], i) => {
  paint(plain, 1, forest.art[i], forest.colors);
  paint(peaked, 1, forest.art[i], forest.colors);
  if (machines) {
    paint(peaked, 1, MACHINE_CAP, machines.colors, true);
    return;
  }
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const px = summer[TILE + y][peaked * TILE + x];
      if (px[3] > 0 && PEAK_COLORS.has(hex(px)))
        rows[TILE + y][peaked * TILE + x] = recolored[TILE + y][peaked * TILE + x];
    }
  }
});

if (deck) paint(0, 0, deck.art, deck.colors);

// The mountain tiles (MOUNTAIN_ART and the compact tops beside them).
if (machines) {
  const { colors } = machines;
  for (const [column, row] of [
    [4, 0],
    [5, 0],
  ])
    paint(column, row, MACHINE_CAP, colors);
  for (const column of [6, 7]) {
    paint(column, 0, MACHINE_COMPACT, colors);
    paint(column, 0, MACHINE_CAP, colors, true);
  }
  const bodies = [
    [4, 1, 0],
    [6, 1, 1],
    [5, 2, 2],
    [7, 2, 0],
    [8, 2, 1],
    [9, 2, 2],
    [10, 2, 0],
  ];
  for (const [column, row, body] of bodies) paint(column, row, MACHINE_BODIES[body], colors);
  for (const [column, body] of [
    [5, 0],
    [7, 1],
  ]) {
    paint(column, 1, MACHINE_BODIES[body], colors);
    paint(column, 1, MACHINE_CAP, colors, true);
  }
}

encode(output, rows);
console.log(`${input} -> ${output}`);
