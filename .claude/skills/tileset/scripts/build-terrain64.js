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
// 8 to a row.

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

const props = blank(8 * TILE, PROPS.length * TILE);
PROPS.forEach((names, row) =>
  names.forEach((name, column) => copy(decode(`${dir}/props/${name}.png`), 0, 0, props, column * TILE, row * TILE)),
);
encode('src/assets/terrain64-props.png', props);
