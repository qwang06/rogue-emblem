// Draws the hand-made monster unit sheets pixel by pixel. Usage (from the
// repo root): node .claude/skills/tileset/scripts/draw-monsters.js [outDir] [Name...]
// writes <outDir>/<Name>_01_{Idle,Move}.png (default src/assets/units/, every
// monster) at the game's 2x, in the pack's layout: 128x128, a row per facing
// (down, left, right, up), 4 frames per row.
//
// Each monster is 16px art. A facing has a `base` grid (16 strings of 16
// characters, one per art pixel, '.' clear, other characters PALETTE keys)
// and named `frames` derived from it: `rows` replaces whole rows of the base,
// `dy` shifts the result up (-) or down (+), `squash` sinks everything above
// row 12 by 1px onto the feet. `idle` and `move` list the four frames of each
// animation by name ('base' is the base). Right (east) is left mirrored unless
// it has its own facing. Uses only Node built-ins.

import path from 'node:path';
import { encode } from './dump-png.js';

// Every color is one of the unit pack's (see the spec's palette table).
const PALETTE = {
  '#': '#291d2b', // outline
  d: '#3d2936',
  p: '#633d4c',
  x: '#52333f',
  W: '#f5ffe8',
  w: '#d7d3bd',
  g: '#9d9387',
  s: '#dfe0e8',
  S: '#a3a7c2',
  z: '#686f99',
  L: '#3a3f5e',
  l: '#4c6885',
  c: '#283540',
  r: '#e64539',
  R: '#ad2f45',
  q: '#bd6a62',
  b: '#8f4d57',
  B: '#7d3833',
  n: '#a47d72',
  N: '#865757',
  e: '#ffc2a1',
  E: '#d09c8e',
  y: '#f0b541',
  Y: '#ffae70',
  o: '#ff8933',
  O: '#cf752b',
  a: '#ab5130',
  G: '#63ab3f',
  k: '#3b7d4f',
  K: '#2f5753',
  m: '#92e8c0',
  t: '#4fa4b8',
  v: '#692464',
  V: '#9c2a70',
  u: '#4f1d4c',
  M: '#781d4f',
};

export const MONSTERS = {};

// ---------------------------------------------------------------- Skeleton
MONSTERS.Skeleton = {
  south: {
    base: [
      '.#....######....',
      '#s#..#WWWWww#...',
      '#s#.#WWWWWWwg#..',
      '#S#.#WddWWddg#..',
      '#S#.#WdrWwrdg#..',
      '#a#.#wWWdgwwg#..',
      '#S#..#wdwdwd#...',
      '#a#.#ww####wg#..',
      'OOO#w#WWWWwg#g#.',
      '#B#w##ddWgdd#g#.',
      '.Bww#.#dWgd#.#w#',
      '#O#..#gWWWwg#...',
      '.#....#w##w#....',
      '......#w##w#....',
      '.....#ww##ww#...',
      '................',
    ],
    frames: {
      stepA: { rows: { 12: '.#....#w##w#....', 13: '......#w#.###...', 14: '.....#ww#.......' } },
      stepB: { rows: { 12: '.#....#w##w#....', 13: '......###.#w#...', 14: '..........#ww#..' } },
      bob: { squash: true },
    },
    idle: ['base', 'base', 'bob', 'bob'],
    move: ['base', 'stepA', 'base', 'stepB'],
  },
  west: {
    base: [
      '.....######.....',
      '....#WWWWWw#....',
      '.#.#WWWWWWwg#...',
      '#s#WddWWWWwg#...',
      '#s#WdrWWWwgg#...',
      '#S#dwWWWwwg#....',
      '#a##wdwdg##.....',
      '#S#.####w#......',
      'OOO###WWwg#.....',
      '#BWwwwdWgd#.....',
      '#B#####Wg##w#...',
      '#O#.##gWWg##....',
      '.#....#w#w#.....',
      '......#w#w#.....',
      '.....#ww#ww#....',
      '................',
    ],
    frames: {
      stepA: { rows: { 12: '.#....#w#w#.....', 13: '.....#w#.#w#....', 14: '....#ww#.#ww#...' } },
      stepB: { rows: { 12: '.#....#w#w#.....', 13: '......#w#w#.....', 14: '......#ww#w#....' } },
      bob: { squash: true },
    },
    idle: ['base', 'base', 'bob', 'bob'],
    move: ['base', 'stepA', 'base', 'stepB'],
  },
  north: {
    base: [
      '....######....#.',
      '...#WWWWww#..#s#',
      '..#WWWWWWwg#.#s#',
      '..#WWWWWwwg#.#S#',
      '..#WWWWwwgg#.#S#',
      '..#wWWwwggg#.#a#',
      '...#wwwggg#..#S#',
      '..#gw####wg#.#a#',
      '.#g#gWWWwg#w#OOO',
      '.#g#dWgWgd##w#B#',
      '#w#.#wWWg#.#ww#.',
      '.#..#gWWwg#..#O#',
      '.....#w##w#...#.',
      '.....#w##w#.....',
      '....#ww##ww#....',
      '................',
    ],
    frames: {
      stepA: { rows: { 13: '.....#w#.###....', 14: '....#ww#........' } },
      stepB: { rows: { 13: '.....###.#w#....', 14: '.........#ww#...' } },
      bob: { squash: true },
    },
    idle: ['base', 'base', 'bob', 'bob'],
    move: ['base', 'stepA', 'base', 'stepB'],
  },
};

// ---------------------------------------------------------------- Bat
// Mirrors 8-wide left halves into 16-wide rows (for the symmetric facings).
const sym = (half) => half.map((h) => h + [...h].reverse().join(''));
const pad = (rows) => [...rows, ...Array(16 - rows.length).fill('................')];
const asRows = (grid) => Object.fromEntries(grid.map((r, i) => [i, r]));

const BAT_UP = sym([
  '#.......',
  '#q#.....',
  '#Mq#.#..',
  '#MMq#q#.',
  '#uMM#qV#',
  '.#uM#VVV',
  '.#uM#VyV',
  '..#u#Vuu',
  '..#MV#WV',
  '...##.vv',
  '......vv',
  '.......#',
  '........',
  '........',
  '........',
  '........',
]);
const BAT_MID = sym([
  '........',
  '........',
  '.....#..',
  '....#q#.',
  '#...#qV#',
  '##..#VVV',
  '#q#.#VyV',
  '#Mq##Vuu',
  '#MMqV#WV',
  '#MuMMM#v',
  '#M#uMM#v',
  '#..#MM##',
  '....##..',
  '........',
  '........',
  '........',
]);
const BAT_DOWN = sym([
  '........',
  '........',
  '.....#..',
  '....#q#.',
  '....#qV#',
  '....#VVV',
  '...##VyV',
  '..#qV#uu',
  '.#qMM#WV',
  '#qMuM#vv',
  '#MuMM#vv',
  '#M#uM##.',
  '#.##M#..',
  '....#...',
  '........',
  '........',
]);
// Back view: same shape, the face (cols 6-9) painted over with body color.
const batBack = (rows) =>
  rows.map((r) => r.slice(0, 6) + r.slice(6, 10).replace(/[yu]/g, 'V').replace(/W/g, 'v') + r.slice(10));

const BAT_WEST_MID = pad([
  '................',
  '................',
  '...#............',
  '..#q#.......##..',
  '..#qV##...##qq#.',
  '.#VVVVV#.#qqMM#.',
  '#VyVVVVq#qMMuM#.',
  '#uuVVVqqqMuMM#..',
  '.#WVVVVMMuMMuM#.',
  '..#vVVvMuMM#u#..',
  '...#vvvMM#.##...',
  '....####........',
]);
const BAT_WEST_UP = pad([
  '..........#.....',
  '.........#q#....',
  '...#.....#qM#...',
  '..#q#...#qMM#...',
  '..#qV##.#qMuM#..',
  '.#VVVVV##qMuM#..',
  '#VyVVVVqqMuMM#..',
  '#uuVVVqqMuMM#...',
  '.#WVVVVVMMM#....',
  '..#vVVvv###.....',
  '...#vvv#........',
  '....###.........',
]);
const BAT_WEST_DOWN = pad([
  '................',
  '................',
  '...#............',
  '..#q#...........',
  '..#qV##.........',
  '.#VVVVV#........',
  '#VyVVVVq#.......',
  '#uuVVVqqq##.....',
  '.#WVVVVMMMq#....',
  '..#vVVvMMuMq#...',
  '...#vvvMuMMMq#..',
  '....###MuM#uM#..',
  '.......#M#.##...',
  '........#.......',
]);

MONSTERS.Bat = {
  south: {
    base: BAT_MID,
    frames: { up: { rows: asRows(BAT_UP) }, down: { rows: asRows(BAT_DOWN), dy: -1 } },
    idle: ['base', 'up', 'base', 'down'],
    move: ['base', 'up', 'base', 'down'],
  },
  west: {
    base: BAT_WEST_MID,
    frames: { up: { rows: asRows(BAT_WEST_UP) }, down: { rows: asRows(pad(BAT_WEST_DOWN)), dy: -1 } },
    idle: ['base', 'up', 'base', 'down'],
    move: ['base', 'up', 'base', 'down'],
  },
  north: {
    base: batBack(BAT_MID),
    frames: { up: { rows: asRows(batBack(BAT_UP)) }, down: { rows: asRows(batBack(BAT_DOWN)), dy: -1 } },
    idle: ['base', 'up', 'base', 'down'],
    move: ['base', 'up', 'base', 'down'],
  },
};

// ---------------------------------------------------------------- Wolf
MONSTERS.Wolf = {
  south: {
    base: [
      '................',
      '..#..........#..',
      '.#s#........#S#.',
      '.#sz########zS#.',
      '.#ssSSSSSSSSSzz#',
      '.#sS#ySSSSy#Sz#.',
      '#ssSSSSwwSSSSzz#',
      '.#zsSSwWwwSSzz#.',
      '..##zSwwwwSz##..',
      '....#zw##wz#....',
      '..#sS#gwwg#Sz#..',
      '..#sSz####zSz#..',
      '.#z#sS#wg#Sz#z#.',
      '.#L#sS####Sz#L#.',
      '.###sS#..#Sz###.',
      '................',
    ],
    frames: {
      bob: { squash: true },
      stepA: { rows: { 14: '.##......#Sz#...' } },
      stepB: { rows: { 14: '...#sS#......##.' } },
    },
    idle: ['base', 'base', 'bob', 'bob'],
    move: ['base', 'stepA', 'base', 'stepB'],
  },
  west: {
    base: [
      '................',
      '................',
      '................',
      '...#.#..........',
      '..#S#S#.........',
      '..#SSSS#......#.',
      '.#sSySSS######s#',
      '#ssSSSzSSSSSSSz#',
      '#sswSzSSSSSSSz#.',
      '.##wzzzzzzzzz#..',
      '..#wzL#####zLz#.',
      '...#SL#....#LS#.',
      '...#SL#....#LS#.',
      '...#S##....##S#.',
      '..#SS#.....#SS#.',
      '................',
    ],
    frames: {
      bob: { squash: true },
      stepA: {
        rows: { 11: '..#S#L#....#L#S#', 12: '.#S#.#L#..#L#.#S', 13: '.##..#L#..#L#..#', 14: '.....##....##...' },
      },
      stepB: {
        rows: { 11: '...#LS#....#SL#.', 12: '...#LS#....#SL#.', 13: '...#S##....##S#.', 14: '..#SS#.....#SS#.' },
      },
    },
    idle: ['base', 'base', 'bob', 'bob'],
    move: ['base', 'stepA', 'base', 'stepB'],
  },
  north: {
    base: [
      '................',
      '...#........#...',
      '..#s#......#S#..',
      '..#sS#....#Sz#..',
      '..#sSS####SSz#..',
      '.#sSSSSSSSSSSz#.',
      '.#sSSSSSSSSSzz#.',
      '.#sSSSSSSSSSzz#.',
      '..#sSSzzzzSSz#..',
      '.#sSSzzzzzzSSz#.',
      '.#sSSz#Sz#zSzz#.',
      '.#sSS#sSSz#SSz#.',
      '.#sS#sSSSzz#Sz#.',
      '.#sS#sSSzzz#Sz#.',
      '.#SS##zLLz##zz#.',
      '................',
    ],
    frames: {
      bob: { squash: true },
      stepA: { rows: { 14: '.#SS##zLLz#.....' } },
      stepB: { rows: { 14: '.....#zLLz##zz#.' } },
    },
    idle: ['base', 'base', 'bob', 'bob'],
    move: ['base', 'stepA', 'base', 'stepB'],
  },
};

// ---------------------------------------------------------------- Orc
MONSTERS.Orc = {
  south: {
    base: [
      '.###............',
      '#sSS#..######...',
      '#sSSz##GGkkkK#..',
      '#sSz##GKKkKKkK#.',
      '.##z#kkrkkrkKK#.',
      '..#n##kkkkkKKK#.',
      '..#n##WkddkWK#..',
      '..#n#Gn#####bK#.',
      '.#Gk#bnbkkKbbkK#',
      '.#kK#bnbbkbbNkK#',
      '.#Gk#dxxyyxxd#k#',
      '..#n##pppyppx#K#',
      '...#.#ppx#pxx##.',
      '.....#px#.#px#..',
      '....#ddd#.#ddd#.',
      '................',
    ],
    frames: {
      bob: { squash: true },
      stepA: { rows: { 13: '.....#px#.###...', 14: '....#ddd#.......' } },
      stepB: { rows: { 13: '.....###.#px#...', 14: '..........#ddd#.' } },
    },
    idle: ['base', 'base', 'bob', 'bob'],
    move: ['base', 'stepA', 'base', 'stepB'],
  },
  west: {
    base: [
      '...........###..',
      '....#####.#sSS#.',
      '...#GGkkkK#sSz#.',
      '..#GKKkkkKK#z##.',
      '..#krkkkKKKK#n#.',
      '.#GkkkkkKKKK#n#.',
      '.#WdkkkKKKK##n#.',
      '..###bnbbbKb#n#.',
      '..#Gk#bnbbbbkK#.',
      '..#kK#bNbbbbx#n#',
      '..#Gk#yyddxd#.#.',
      '...#.#ppppxx#...',
      '.....#ppx#px#...',
      '.....#px##px#...',
      '....#ddd##ddd#..',
      '................',
    ],
    frames: {
      bob: { squash: true },
      stepA: { rows: { 12: '....#ppx#.#px#..', 13: '...#px#...#px#..', 14: '..#ddd#....#ddd#' } },
      stepB: { rows: { 12: '.....#ppppx#....', 13: '.....#px#px#....', 14: '....#ddd#dd#....' } },
    },
    idle: ['base', 'base', 'bob', 'bob'],
    move: ['base', 'stepA', 'base', 'stepB'],
  },
  north: {
    base: [
      '............###.',
      '...######..#sSS#',
      '..#GGkkkK#.#zSS#',
      '.#GGkkkkKK##z##.',
      '.#GkkkkkKK#.#n#.',
      '.#kkkkkKKK#.#n#.',
      '..#kKKKKK#..#n#.',
      '.#nb######bN#n#.',
      '#Gkbnbbbbbbbkn#.',
      '#kKbNbbbbbbNkK#.',
      '#Gk#xxxxxxxx#n#.',
      '.#.#ppppppxx##..',
      '...#ppx##pxx#...',
      '...#px#..#px#...',
      '..#ddd#..#ddd#..',
      '................',
    ],
    frames: {
      bob: { squash: true },
      stepA: { rows: { 13: '...#px#..###....', 14: '..#ddd#.........' } },
      stepB: { rows: { 13: '...###..#px#....', 14: '.........#ddd#..' } },
    },
    idle: ['base', 'base', 'bob', 'bob'],
    move: ['base', 'stepA', 'base', 'stepB'],
  },
};

function hexToRgba(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}
const CLEAR = [0, 0, 0, 0];

function parse(grid, name) {
  if (grid.length !== 16) throw new Error(`${name}: ${grid.length} rows`);
  return grid.map((row, y) => {
    if (row.length !== 16) throw new Error(`${name} row ${y}: ${row.length} wide`);
    return [...row].map((ch) => {
      if (ch === '.') return CLEAR;
      if (!PALETTE[ch]) throw new Error(`${name} row ${y}: unknown color '${ch}'`);
      return hexToRgba(PALETTE[ch]);
    });
  });
}

function derive(base, spec) {
  let g = base.slice();
  for (const [i, row] of Object.entries(spec.rows ?? {})) g[+i] = row;
  if (spec.squash) {
    const top = g.findIndex((row) => /[^.]/.test(row));
    const out = g.slice();
    for (let y = 12; y > top; y--) out[y] = g[y - 1];
    out[top] = '.'.repeat(16);
    g = out;
  }
  if (spec.dy) {
    const out = Array.from({ length: 16 }, (_, y) => g[y - spec.dy] ?? '.'.repeat(16));
    g = out;
  }
  return g;
}

const mirror = (facing) => ({
  ...facing,
  base: facing.base.map((r) => [...r].reverse().join('')),
  frames: Object.fromEntries(
    Object.entries(facing.frames ?? {}).map(([k, f]) => [
      k,
      {
        ...f,
        rows: f.rows && Object.fromEntries(Object.entries(f.rows).map(([i, r]) => [i, [...r].reverse().join('')])),
      },
    ]),
  ),
});

// A monster's frames as 16px grids: [facing][animation][frame].
export function monsterFrames(monster, name = '') {
  const facings = ['south', 'west', 'east', 'north'].map((d) => {
    if (monster[d]) return monster[d];
    if (d === 'east' && monster.west) return mirror(monster.west);
    return monster.south; // placeholder while drawing
  });
  return facings.map((f, i) => {
    const grid = (key) => (key === 'base' ? f.base : derive(f.base, f.frames[key]));
    return {
      idle: f.idle.map((k) => parse(grid(k), `${name} ${i} ${k}`)),
      move: f.move.map((k) => parse(grid(k), `${name} ${i} ${k}`)),
    };
  });
}

const double = (rows) => rows.flatMap((row) => [row, row].map(() => row.flatMap((px) => [px, px])));

function sheet(frames) {
  const rows = Array.from({ length: 64 }, () => Array.from({ length: 64 }, () => CLEAR));
  frames.forEach((dirFrames, r) =>
    dirFrames.forEach((frame, c) => {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) rows[r * 16 + y][c * 16 + x] = frame[y][x];
    }),
  );
  return double(rows);
}

const [outDir = 'src/assets/units', ...only] = process.argv.slice(2);
for (const [name, monster] of Object.entries(MONSTERS)) {
  if (only.length && !only.includes(name)) continue;
  const frames = monsterFrames(monster, name);
  encode(path.join(outDir, `${name}_01_Idle.png`), sheet(frames.map((f) => f.idle)));
  encode(path.join(outDir, `${name}_01_Move.png`), sheet(frames.map((f) => f.move)));
}
