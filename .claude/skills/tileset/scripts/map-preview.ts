// Renders a procedurally generated map (src/game/mapGen.ts, or an
// archetype's plan, src/game/mapArchetypes.ts) the way GridScene draws it —
// grass, every autotiled terrain (first animation frame), the wall
// autotile and the forest/mountain/building/crossing overlays in a building
// palette — so the generator's output can be judged without a browser.
// Ginkgo trees are left out. With --units, the player's warrior stands on
// the middle deployment tile (the zone tinted blue) and skeletons on the
// enemies' tiles (from the archetype's enemy zones).
// Needs Node 22.6+ (runs TypeScript by stripping types). Usage (from the repo root):
//   node .claude/skills/tileset/scripts/map-preview.ts [--scale 2] [--palette a-stone] [--size 16x14] \
//     [--archetype islands] [--terrain '{"lakes":1}'] [--units 4] out.png seed [seed...]
// Several seeds render side by side, a tile apart. --terrain adds generator
// options (as a region's "terrain" would); --archetype sets the layout and
// uses the planned generator.

import { getQuarterFrames, getTileFrame } from '../../../../src/game/autotile.ts';
import { pickZonedEnemyTiles } from '../../../../src/game/enemySpawns.ts';
import {
  getBuildingSprites,
  getCrossingSprites,
  getFeatureSprites,
  getWallAutotile,
} from '../../../../src/game/mapArt.ts';
import type { MapArchetype } from '../../../../src/game/mapArchetypes.ts';
import { generateMap } from '../../../../src/game/mapPlan.ts';
import { createSeededRng } from '../../../../src/game/rng.ts';
import {
  BRIDGE_ART,
  BUILDING_ART,
  BUILDING_PALETTES,
  FORD_ART,
  FOREST_ART,
  GATE_ART,
  MAP_PROPS_SHEET,
  MOUNTAIN_ART,
  TERRAIN_AUTOTILES,
  TERRAIN_BASE_TILE,
  TERRAIN_SHEET,
  type BuildingPaletteName,
} from '../../../../src/game/tileset.ts';
import { decode, encode } from './dump-png.js';

// Drawn at the terrain sheet's own pixel size; the props sheet and the
// warrior and skeleton sheets it stands on the map are 32px too.
const TILE = TERRAIN_SHEET.tileSize;
const HALF = TILE / 2;

const args = process.argv.slice(2);
const option = (name: string, fallback: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : fallback;
};
const scale = Number(option('--scale', '2'));
const paletteName = option('--palette', 'a-stone') as BuildingPaletteName;
const [mapWidth, mapHeight] = option('--size', '16x14').split('x').map(Number);
const archetype = option('--archetype', '') as MapArchetype | '';
const extra = JSON.parse(option('--terrain', '{}'));
const unitCount = Number(option('--units', '0'));
const [output, ...seeds] = args;
const palette = BUILDING_PALETTES[paletteName];
if (!palette) throw new Error(`Unknown palette ${paletteName}`);

const sheet = decode('src/assets/overworld.png');
const props = decode('src/assets/map-props.png');
const units = {
  player: decode('src/assets/units/Warrior_02_Idle.png'),
  enemy: decode('src/assets/units/Skeleton_01_Idle.png'),
};
const columns = TERRAIN_SHEET.columns;
const width = seeds.length * (mapWidth + 1) * TILE - TILE;
const height = mapHeight * TILE;
const scene: number[][][] = Array.from({ length: height }, () => Array.from({ length: width }, () => [40, 40, 48]));

// Blends a size x size block of `image` (frame `frame` of it cut into
// `size` tiles, `imageColumns` tiles of 32px wide) onto the scene at (x, y).
const blend = (frame: number, size: number, x: number, y: number, image = sheet, imageColumns = columns, alpha = 1) => {
  const perRow = (imageColumns * TILE) / size;
  const sx = (frame % perRow) * size;
  const sy = Math.floor(frame / perRow) * size;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const px = image[sy + j][sx + i];
      const a = (px[3] / 255) * alpha;
      const under = scene[y + j][x + i];
      scene[y + j][x + i] = [0, 1, 2].map((k) => Math.round(px[k] * a + under[k] * (1 - a)));
    }
  }
};

// A flat color over one tile, at `alpha`.
const tint = (rgb: number[], alpha: number, x: number, y: number) => {
  for (let j = 0; j < TILE; j++) {
    for (let i = 0; i < TILE; i++) {
      const under = scene[y + j][x + i];
      scene[y + j][x + i] = [0, 1, 2].map((k) => Math.round(rgb[k] * alpha + under[k] * (1 - alpha)));
    }
  }
};

seeds.forEach((seed, n) => {
  const left = n * (mapWidth + 1) * TILE;
  const rng = createSeededRng(Number(seed));
  const terrain = generateMap(
    { width: mapWidth, height: mapHeight, ...extra, ...(archetype ? { generator: 'planned', archetype } : {}) },
    rng,
  );
  const { grid, buildings } = terrain;
  for (const cell of grid.cells)
    blend(getTileFrame(TERRAIN_BASE_TILE, columns), TILE, left + cell.x * TILE, cell.y * TILE);
  const autotiles = { ...TERRAIN_AUTOTILES, wall: getWallAutotile(palette) };
  for (const [terrainName, autotile] of Object.entries(autotiles)) {
    for (const cell of grid.cells) {
      getQuarterFrames(grid, cell.x, cell.y, terrainName, autotile, columns, 0)?.forEach((frame, q) =>
        blend(frame, HALF, left + cell.x * TILE + (q & 1) * HALF, cell.y * TILE + (q >> 1) * HALF),
      );
    }
  }
  const start = terrain.path[0];
  const deploymentZone = terrain.deploymentZone ?? [-1, 0, 1].map((dx) => ({ x: start.x + dx, y: start.y }));
  if (unitCount > 0) for (const { x, y } of deploymentZone) tint([80, 140, 255], 0.35, left + x * TILE, y * TILE);
  const order = { ground: 0, cap: 1, roof: 3 };
  const sprites: { x: number; y: number; layer: string; draw: () => void }[] = [
    ...getCrossingSprites(grid, BRIDGE_ART, GATE_ART[paletteName], FORD_ART, MAP_PROPS_SHEET),
    ...getFeatureSprites(grid, FOREST_ART, MOUNTAIN_ART),
    ...getBuildingSprites(buildings, palette, BUILDING_ART),
  ].map(({ x, y, tile, layer, sheet: on }) => ({
    x,
    y,
    layer,
    draw: () =>
      on
        ? blend(getTileFrame(tile, on.columns), TILE, left + x * TILE, y * TILE, props, on.columns)
        : blend(getTileFrame(tile, columns), TILE, left + x * TILE, y * TILE),
  }));
  if (unitCount > 0) {
    const enemies = pickZonedEnemyTiles(
      grid,
      [{ count: unitCount }],
      deploymentZone,
      terrain.enemyZones ?? [],
      rng,
    ).flat();
    const standing = [
      { ...deploymentZone[1], image: units.player },
      ...enemies.map((p) => ({ ...p, image: units.enemy })),
    ];
    for (const { x, y, image } of standing) {
      sprites.push({ x, y, layer: 'unit', draw: () => blend(0, TILE, left + x * TILE, y * TILE, image, 4) });
    }
  }
  const depth = { ...order, unit: 2 } as Record<string, number>;
  sprites.sort((a, b) => depth[a.layer] - depth[b.layer]).forEach((s) => s.draw());
});

encode(
  output,
  Array.from({ length: height * scale }, (_, y) =>
    Array.from({ length: width * scale }, (_, x) => [...scene[Math.floor(y / scale)][Math.floor(x / scale)], 255]),
  ),
);
console.log(`${output}: ${width * scale}x${height * scale}`);
