// Renders a procedurally generated map (src/game/mapGen.ts) the way
// GridScene draws it — grass, every autotiled terrain (first animation
// frame), the wall autotile and the forest/mountain/building overlays in a
// building palette — so the generator's output can be judged without a
// browser. Units and ginkgo trees are left out.
// Needs Node 22.6+ (runs TypeScript by stripping types). Usage (from the repo root):
//   node .claude/skills/tileset/scripts/map-preview.ts [--scale 2] [--palette a-stone] [--size 16x14] out.png seed [seed...]
// Several seeds render side by side, a tile apart.

import { getQuarterFrames, getTileFrame } from '../../../../src/game/autotile.ts';
import { getBuildingSprites, getFeatureSprites, getWallAutotile } from '../../../../src/game/mapArt.ts';
import { generateTerrain } from '../../../../src/game/mapGen.ts';
import { createSeededRng } from '../../../../src/game/rng.ts';
import {
  BUILDING_ART,
  BUILDING_PALETTES,
  FOREST_ART,
  MOUNTAIN_ART,
  TERRAIN_AUTOTILES,
  TERRAIN_BASE_TILE,
  TERRAIN_SHEET,
  type BuildingPaletteName,
} from '../../../../src/game/tileset.ts';
import { decode, encode } from './dump-png.js';

const TILE = 32;
const HALF = TILE / 2;

const args = process.argv.slice(2);
const option = (name: string, fallback: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : fallback;
};
const scale = Number(option('--scale', '2'));
const paletteName = option('--palette', 'a-stone') as BuildingPaletteName;
const [mapWidth, mapHeight] = option('--size', '16x14').split('x').map(Number);
const [output, ...seeds] = args;
const palette = BUILDING_PALETTES[paletteName];
if (!palette) throw new Error(`Unknown palette ${paletteName}`);

const sheet = decode('src/assets/overworld.png');
const columns = TERRAIN_SHEET.columns;
const width = seeds.length * (mapWidth + 1) * TILE - TILE;
const height = mapHeight * TILE;
const scene: number[][][] = Array.from({ length: height }, () => Array.from({ length: width }, () => [40, 40, 48]));

// Blends a size x size block of the sheet (frame `frame` of the sheet cut
// into `size` tiles) onto the scene at (x, y).
const blend = (frame: number, size: number, x: number, y: number) => {
  const perRow = (columns * TILE) / size;
  const sx = (frame % perRow) * size;
  const sy = Math.floor(frame / perRow) * size;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const px = sheet[sy + j][sx + i];
      const a = px[3] / 255;
      const under = scene[y + j][x + i];
      scene[y + j][x + i] = [0, 1, 2].map((k) => Math.round(px[k] * a + under[k] * (1 - a)));
    }
  }
};

seeds.forEach((seed, n) => {
  const left = n * (mapWidth + 1) * TILE;
  const { grid, buildings } = generateTerrain({ width: mapWidth, height: mapHeight }, createSeededRng(Number(seed)));
  for (const cell of grid.cells)
    blend(getTileFrame(TERRAIN_BASE_TILE, columns), TILE, left + cell.x * TILE, cell.y * TILE);
  const autotiles = { ...TERRAIN_AUTOTILES, wall: getWallAutotile(palette) };
  for (const [terrain, autotile] of Object.entries(autotiles)) {
    for (const cell of grid.cells) {
      getQuarterFrames(grid, cell.x, cell.y, terrain, autotile, columns, 0)?.forEach((frame, q) =>
        blend(frame, HALF, left + cell.x * TILE + (q & 1) * HALF, cell.y * TILE + (q >> 1) * HALF),
      );
    }
  }
  const order = { ground: 0, cap: 1, roof: 2 };
  const sprites = [
    ...getFeatureSprites(grid, FOREST_ART, MOUNTAIN_ART),
    ...getBuildingSprites(buildings, palette, BUILDING_ART),
  ].sort((a, b) => order[a.layer] - order[b.layer]);
  for (const { x, y, tile } of sprites) blend(getTileFrame(tile, columns), TILE, left + x * TILE, y * TILE);
});

encode(
  output,
  Array.from({ length: height * scale }, (_, y) =>
    Array.from({ length: width * scale }, (_, x) => [...scene[Math.floor(y / scale)][Math.floor(x / scale)], 255]),
  ),
);
console.log(`${output}: ${width * scale}x${height * scale}`);
