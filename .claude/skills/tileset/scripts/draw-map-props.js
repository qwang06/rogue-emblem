// Draws the map props the overworld sheet doesn't have into
// src/assets/map-props.png: a gateway for each building palette's walls,
// and ford stepping stones. 16px art doubled to 32x32 tiles, like the
// sheet, in colors picked off the sheet itself so they match it. Usage
// (from the repo root):
//   node .claude/skills/tileset/scripts/draw-map-props.js
//
// Layout (32px tiles, MAP_PROPS_SHEET in tileset.ts):
//   [i, 0] gateway posts for palette i (GATE_PALETTES order), drawn under units
//   [i, 1] gateway lintel for palette i, drawn over units
//   [10, 0] ford stepping stones, drawn over the river's water

import { decode, encode } from './dump-png.js';

const OUT = 'src/assets/map-props.png';
const SHEET = decode('src/assets/overworld.png');
const CLEAR = [0, 0, 0, 0];

// Each palette's rampart group on the sheet (BUILDING_PALETTES' `wall`),
// in the sheet's column order.
export const GATE_PALETTES = [
  ['a-stone', [0, 33]],
  ['a-orange', [6, 33]],
  ['a-teal', [12, 33]],
  ['a-pink', [18, 33]],
  ['a-brown', [24, 33]],
  ['b-white', [0, 41]],
  ['b-red', [18, 41]],
  ['b-blue', [12, 41]],
  ['b-green', [24, 41]],
  ['b-orange', [6, 41]],
];

// A pixel (x, y) of sheet tile [column, row].
const sample = ([column, row], x, y) => SHEET[row * 32 + y][column * 32 + x];

// The dirt path's sand ([2, 4]'s clean middle row 14) and its orange
// speckle (the brightest-red pixel that isn't sand).
const SAND = sample([2, 4], 0, 14);
const SPECK = (() => {
  for (let y = 12; y < 22; y++) {
    for (let x = 0; x < 32; x++) {
      const px = sample([2, 4], x, y);
      if (px[3] === 255 && px.slice(0, 3).join() !== SAND.slice(0, 3).join() && px[0] > 0xe0) return px;
    }
  }
  throw new Error('no speckle on [2, 4]');
})();

// A rampart group's colors, read off its tiles: the top edge of its
// notched 3x3 ([c+2, r]) has the outline, the rim highlight, the dark face
// and the light top at fixed spots, and the gatehouse ([c+5, r]) its door.
function wallColors([c, r]) {
  return {
    O: sample([c + 2, r], 0, 4),
    H: sample([c + 2, r], 0, 6),
    M: sample([c + 2, r], 6, 6),
    L: sample([c + 2, r], 0, 12),
    D: sample([c + 5, r], 14, 22),
    // The wall's drop shadow on the grass.
    S: sample([c + 2, r], 0, 28),
    // The dirt path's sand and its speckle ([2, 4]).
    P: SAND,
    p: SPECK,
  };
}

// The gateway, as 16x16 art in color roles over the wall's own straight
// piece ('w' keeps the wall's pixel, '.' is clear). The wall runs on
// through a gate cell (its autotile joins gates), so the posts layer is
// opaque wherever the wall would show: two raised piers in the wall's
// colors carry its line, and between them the dark underside of the arch
// and a dirt floor in the path's sand colors, so the road runs through. The lintel, drawn over units, joins the piers
// across the top with the wall's crenellated rim, so a unit in the gate
// walks under it.
const GATE_POSTS = [
  'OOOOO......OOOOO',
  'OHHHO......OHHHO',
  'OHLLOwwwwwwOHLLO',
  'OLLLODDDDDDOLLLO',
  'OLLLODDDDDDOLLLO',
  'OOOOODDDDDDOOOOO',
  'OMMMODDDDDDOMMMO',
  'OMMMOPPPPPPOMMMO',
  'OMMMOPPPPpPOMMMO',
  'OMMMOPpPPPPOMMMO',
  'OMMMOPPPPPPOMMMO',
  'OMMMOPPPpPPOMMMO',
  'OMMMOPPPPPPOMMMO',
  'OOOOOPpPPPPOOOOO',
  'SSSSSPPPPPPSSSSS',
  'wwwww......wwwww',
];
const GATE_LINTEL = [
  '................',
  '................',
  '....OOOOOOOO....',
  '....OHMHMHMO....',
  '....OOOOOOOO....',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];

// A 1-wide horizontal wall's middle cell in the group at [c, r], as the
// wall autotile draws it: the top half of its notched 3x3's top-middle
// tile over the bottom half of its bottom-middle tile.
function wallStrip([c, r]) {
  return Array.from({ length: 32 }, (_, y) =>
    Array.from({ length: 32 }, (_, x) => (y < 16 ? sample([c + 2, r], x, y) : sample([c + 2, r + 2], x, y))),
  );
}

// The rocks tile's colors ([12, 1]): outline (also its shaded side), light
// facet, mid stone and the water's shadow, plus the open water's pale wave
// color ([5, 9]) for a ripple softer than the rocks' mint foam.
const ROCK = {
  O: sample([12, 1], 6, 4),
  L: sample([12, 1], 8, 6),
  M: sample([12, 1], 2, 10),
  W: sample([12, 1], 2, 26),
  R: (() => {
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const px = sample([5, 9], x, y);
        if (px[0] > 0x90) return px;
      }
    }
    throw new Error('no wave color on [5, 9]');
  })(),
};

// Ford stones: two flat stepping stones per tile, staggered so a two-deep
// ford zigzags, shaded like the rocks tile (light facet top left, outline
// doubling as the shaded side), with a pale wake around the waterline and
// shadow under. They keep to the middle rows, clear of the north bank's
// shadow band and the south bank's lip.
const FORD = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '..OOOOO.........',
  '.OLLLMMO........',
  '.OLLMMMO........',
  'ROMMMMOOR.......',
  '.ROOOOOR.OOOOOO.',
  '..RRWWW.OLLLLMMO',
  '........OLLMMMMO',
  '.......ROMMMMMOO',
  '........ROOOOOOR',
  '.........RRRWWW.',
  '................',
];

// 16x16 role art at 2x into the 32px cell (column, row) of `rows`; a 'w'
// takes the pixel of `under` (32x32) instead.
function stamp(rows, column, row, art, colors, under = null) {
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const role = art[y >> 1][x >> 1];
      const px = role === '.' ? CLEAR : role === 'w' ? under[y][x] : colors[role];
      rows[row * 32 + y][column * 32 + x] = px;
    }
  }
}

const COLUMNS = GATE_PALETTES.length + 1;
const rows = Array.from({ length: 64 }, () => Array.from({ length: COLUMNS * 32 }, () => CLEAR));
GATE_PALETTES.forEach(([, wall], i) => {
  const colors = wallColors(wall);
  stamp(rows, i, 0, GATE_POSTS, colors, wallStrip(wall));
  stamp(rows, i, 1, GATE_LINTEL, colors);
});
stamp(rows, GATE_PALETTES.length, 0, FORD, ROCK);
encode(OUT, rows);
console.log(`${OUT}: ${COLUMNS * 32}x64`);
