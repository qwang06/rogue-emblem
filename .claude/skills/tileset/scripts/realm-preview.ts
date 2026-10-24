// Renders Warband realms (src/game/warband/realm/) to one PNG, one realm
// under the other, painted from getRealmDrawList the way the overworld
// screen paints them, with a colored square on each site by kind, and
// prints each realm's sites.
//
//   node .claude/skills/tileset/scripts/realm-preview.ts out.png 1 2 3

import { readFileSync } from 'node:fs';
import { MAP_PROPS_SHEET, TILE_SIZE } from '../../../../src/game/tileset.ts';
import { generateRealm } from '../../../../src/game/warband/realm/realm.ts';
import { getRealmDrawList } from '../../../../src/game/warband/realm/realmArt.ts';
import { decode, encode } from './dump-png.js';

const [output, ...seeds] = process.argv.slice(2);
const settings = JSON.parse(readFileSync('src/data/regions.json', 'utf8'));
const sheets: Record<string, number[][][]> = {
  overworld: decode('src/assets/overworld.png'),
  [MAP_PROPS_SHEET.key]: decode('src/assets/map-props.png'),
};
const realms = seeds.map((seed) => generateRealm(Number(seed), settings));
const { width: columns, height: rows } = realms[0].grid;
const width = columns * TILE_SIZE;
const height = realms.length * (rows + 1) * TILE_SIZE;
const scene: number[][][] = Array.from({ length: height }, () => Array.from({ length: width }, () => [40, 40, 48]));

const blend = (image: number[][][], frame: number, size: number, x: number, y: number) => {
  const perRow = image[0].length / size;
  const sx = (frame % perRow) * size;
  const sy = Math.floor(frame / perRow) * size;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const pixel = image[sy + j][sx + i];
      const under = scene[y + j]?.[x + i];
      if (!under) continue;
      const alpha = pixel[3] / 255;
      scene[y + j][x + i] = [0, 1, 2].map((k) => Math.round(pixel[k] * alpha + under[k] * (1 - alpha)));
    }
  }
};
const box = (rgb: number[], x: number, y: number, size: number) => {
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) if (scene[y + j]?.[x + i]) scene[y + j][x + i] = rgb;
};

const COLORS: Record<string, number[]> = {
  battle: [220, 40, 40],
  village: [240, 160, 40],
  fort: [140, 0, 0],
  town: [40, 120, 240],
  shrine: [240, 240, 240],
  home: [40, 200, 80],
  hold: [0, 0, 0],
};

realms.forEach((realm, n) => {
  const top = n * (rows + 1) * TILE_SIZE;
  for (const draw of getRealmDrawList(realm)) blend(sheets[draw.sheet], draw.frame, draw.size, draw.x, top + draw.y);
  for (const site of realm.sites) box(COLORS[site.kind], site.x * TILE_SIZE + 11, top + site.y * TILE_SIZE + 22, 10);
  console.log(`seed ${realm.seed}: ${realm.name}`);
  for (const site of realm.sites) {
    const offset = site.levelOffset ? ` (${site.levelOffset > 0 ? '+' : ''}${site.levelOffset})` : '';
    console.log(
      `  ${site.id.padEnd(5)} ${site.kind.padEnd(8)} ${site.biome.padEnd(7)} ${settings.regions[site.region].name}${offset}  ${site.name}`,
    );
  }
});
encode(
  output,
  scene.map((row) => row.map((pixel) => [...pixel, 255])),
);
