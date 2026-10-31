// Builds the 64px terrain art from a PixelLab export (the terrain-64b
// folder in the project files: tilesets/<set>/{sheet.png,wang_map.json} and
// props/<name>.png) into src/assets/terrain64.png and
// src/assets/terrain64-props.png. Usage (from the repo root):
//   node .claude/skills/tileset/scripts/build-terrain64.js <export>/out
//
// terrain64.png (WANG_SHEET in tileset.ts): one row per Wang set in SETS
// order, its 16 tiles in index order (index = NW*8 + NE*4 + SW*2 + SE*1, a
// corner 1 when it's the set's upper terrain), so tile i of row r is
// [i, r]. PixelLab's sheet puts the tiles in another order; wang_map.json
// says where each index is and which terrain each corner shows, which is
// checked against the index.
//
// terrain64-props.png (TERRAIN64_PROPS_SHEET): the props in PROPS order,
// 8 to a row, then a row of bridge ends. The bridges are redrawn from
// PixelLab's north–south bridge so they join up (see drawBridges): [6, 0]
// is a deck that repeats north–south, [5, 0] the same turned west–east,
// and [0..3, 2] the ends that run a deck onto the bank cell north, south,
// west and east of a bridge. The rest of row 2 is two low ridges and a
// crag, rows 3–4 two 128px mountains (a massif and a tall peak) and rows
// 5–6 three 128px forest clumps (pines, mixed, broadleaf), each cut into
// its four tiles.

import { readFileSync } from 'node:fs';
import { decode, encode } from './dump-png.js';

const TILE = 64;
const SETS = [
  { name: 'grass_dirt', upper: 'dirt' },
  { name: 'grass_water', upper: 'grass' },
];
export const PROPS = [
  [
    'tree_pine',
    'tree_pine_cluster',
    'tree_broadleaf',
    'mountain_peak',
    'mountain_peaks',
    'bridge_h',
    'bridge_v',
    'boulders',
  ],
  [
    'house_red',
    'house_blue',
    'house_orange',
    'watchtower',
    'castle_wall',
    'castle_tower',
    'castle_gatehouse',
    'village_wall',
  ],
];

const [dir] = process.argv.slice(2);
if (!dir) throw new Error('Usage: build-terrain64.js <export>/out');

const blank = (width, height) =>
  Array.from({ length: height }, () => Array.from({ length: width }, () => [0, 0, 0, 0]));
const copy = (from, sx, sy, to, dx, dy) => {
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) to[dy + y][dx + x] = from[sy + y][sx + x];
};

const terrain = blank(16 * TILE, SETS.length * TILE);
SETS.forEach(({ name, upper }, row) => {
  const sheet = decode(`${dir}/tilesets/${name}/sheet.png`);
  const { tiles } = JSON.parse(readFileSync(`${dir}/tilesets/${name}/wang_map.json`, 'utf8'));
  for (let index = 0; index < 16; index++) {
    const { rect, corners } = tiles[index];
    const bits = ['NW', 'NE', 'SW', 'SE'].map((c) => (corners[c] === upper ? 1 : 0));
    if (bits[0] * 8 + bits[1] * 4 + bits[2] * 2 + bits[3] !== index) {
      throw new Error(`${name} tile ${index} has corners ${JSON.stringify(corners)}`);
    }
    copy(sheet, rect[0], rect[1], terrain, index * TILE, row * TILE);
  }
});
encode('src/assets/terrain64.png', terrain);

const props = blank(8 * TILE, (PROPS.length + 5) * TILE);
PROPS.forEach((names, row) =>
  names.forEach((name, column) => copy(decode(`${dir}/props/${name}.png`), 0, 0, props, column * TILE, row * TILE)),
);
drawBridges(decode(`${dir}/props/bridge_v.png`), props);
['mountain_ridge_1', 'mountain_ridge_2', 'mountain_crag'].forEach((name, i) =>
  copy(decode(`${dir}/props/${name}.png`), 0, 0, props, (4 + i) * TILE, 2 * TILE),
);
// The 128px mountains and forest clumps, a tile at a time.
const BIG = [
  ['mountain_big_massif', 'mountain_big_peak'],
  ['forest_big_pines', 'forest_big_mixed', 'forest_big_broadleaf'],
];
BIG.forEach((names, band) =>
  names.forEach((name, i) => {
    const image = decode(`${dir}/props/${name}.png`);
    for (const [dx, dy] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ]) {
      copy(image, dx * TILE, dy * TILE, props, (i * 2 + dx) * TILE, (3 + band * 2 + dy) * TILE);
    }
  }),
);
encode('src/assets/terrain64-props.png', props);

// The bridge pieces, from PixelLab's north–south bridge (its deck spans
// columns 20–48 and every row, but doesn't repeat): widened to nearly the
// whole tile (see widenDeck) so a unit fits on it, then 32 rows of it and
// the same rows flipped make a deck whose top and bottom rows match, so
// bridge cells stack seamlessly. An end piece is that deck's half nearest
// the bridge with a dark lip across its far edge, laid over the bank cell
// so the deck covers the cut bank and lands on the grass. West–east pieces
// are the north–south ones turned a quarter.
function drawBridges(source, sheet) {
  const band = widenDeck(source).slice(16, 48);
  const deck = [...band, ...band.toReversed()].map((row) => row.map((px) => [...px]));
  const lip = deck[0].map((px) => (px[3] ? darkest(deck) : px));
  const blankRow = () => deck[0].map(() => [0, 0, 0, 0]);
  const half = TILE / 2;
  // The bank cell north of a bridge: deck in its bottom half.
  const north = [...Array.from({ length: half }, blankRow), lip, lip, ...deck.slice(half + 2)];
  const south = north.toReversed();
  const turn = (tile) => tile[0].map((_, x) => tile.map((row) => row[x]).toReversed());
  const pieces = [
    [deck, 6, 0],
    [turn(deck), 5, 0],
    [north, 0, 2],
    [south, 1, 2],
    [turn(south), 2, 2],
    [turn(north), 3, 2],
  ];
  for (const [tile, column, row] of pieces) copy(tile, 0, 0, sheet, column * TILE, row * TILE);
}

// The bridge's deck widened to columns 2–61: its west rail (columns 20–25)
// and east rail (44–48) moved out to the edges, and the planking between
// (27–42, leaving out its dark edge columns) laid across the middle, every
// other copy flipped so the seams match.
function widenDeck(source) {
  const [left, right] = [2, 61];
  const planks = (x) => {
    const i = x - (left + 6);
    const copy = Math.floor(i / 16);
    const offset = i % 16;
    return 27 + (copy % 2 ? 15 - offset : offset);
  };
  return source.map((row) =>
    row.map((_, x) => {
      if (x < left || x > right) return [0, 0, 0, 0];
      if (x < left + 6) return [...row[20 + x - left]];
      if (x > right - 5) return [...row[48 - (right - x)]];
      return [...row[planks(x)]];
    }),
  );
}

// The darkest opaque color in a tile, for an outline.
function darkest(tile) {
  const opaque = tile.flat().filter((px) => px[3]);
  return opaque.reduce((a, b) => (a[0] + a[1] + a[2] <= b[0] + b[1] + b[2] ? a : b));
}
