// Renders Warband realms (src/game/warband/realm/) to one PNG, one realm
// under the other, painted the way the overworld screen paints them: the
// parchment map from getRealmInk and paintRealmInk, with each site's icon
// (src/assets/realm/sites/) stood on its tile. Prints each realm's sites
// and the names lettered on it.
//
//   node .claude/skills/tileset/scripts/realm-preview.ts out.png 1 2 3

import { readFileSync } from 'node:fs';
import { TILE_SIZE } from '../../../../src/game/tileset.ts';
import { paintRealmInk, type RgbaImage } from '../../../../src/game/warband/realm/inkRaster.ts';
import { generateRealm } from '../../../../src/game/warband/realm/realm.ts';
import { getRealmInk, INK_STAMPS, type InkStamp } from '../../../../src/game/warband/realm/realmInk.ts';
import { decode, encode } from './dump-png.js';

const [output, ...seeds] = process.argv.slice(2);
const settings = JSON.parse(readFileSync('src/data/regions.json', 'utf8'));

const load = (file: string): RgbaImage => {
  const rows: number[][][] = decode(file);
  return { width: rows[0].length, height: rows.length, data: new Uint8ClampedArray(rows.flat(2)) };
};
const stamps = Object.fromEntries(INK_STAMPS.map((id) => [id, load(`src/assets/realm/ink/${id}.png`)])) as Record<
  InkStamp,
  RgbaImage
>;
const icons: Record<string, RgbaImage> = {};
const icon = (kind: string) => (icons[kind] ??= load(`src/assets/realm/sites/${kind}.png`));

const realms = seeds.map((seed) => generateRealm(Number(seed), settings));
const maps = realms.map((realm) => {
  const ink = getRealmInk(realm);
  const map = paintRealmInk(ink, realm.seed, stamps);
  for (const site of realm.sites) {
    // As on screen: the icon's 64px disc centered on the tile, its foot a
    // little below the tile's middle.
    const art = icon(site.kind);
    const left = site.x * TILE_SIZE + TILE_SIZE / 2 - art.width / 2;
    const top = site.y * TILE_SIZE + TILE_SIZE * 0.75 - art.height;
    for (let y = 0; y < art.height; y++) {
      for (let x = 0; x < art.width; x++) {
        const s = (y * art.width + x) * 4;
        const tx = left + x;
        const ty = top + y;
        const alpha = art.data[s + 3] / 255;
        if (!alpha || tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) continue;
        const t = (ty * map.width + tx) * 4;
        for (let c = 0; c < 3; c++) map.data[t + c] += (art.data[s + c] - map.data[t + c]) * alpha;
      }
    }
  }
  console.log(`seed ${realm.seed}: ${realm.name}`);
  for (const site of realm.sites) {
    const offset = site.levelOffset ? ` (${site.levelOffset > 0 ? '+' : ''}${site.levelOffset})` : '';
    console.log(
      `  ${site.id.padEnd(5)} ${site.kind.padEnd(8)} ${site.biome.padEnd(7)} ${settings.regions[site.region].name}${offset}  ${site.name}`,
    );
  }
  console.log(`  lettered: ${ink.labels.map((label) => label.text).join(', ')}`);
  return map;
});

const gap = TILE_SIZE;
const rows: number[][][] = [];
for (const map of maps) {
  for (let y = 0; y < map.height; y++) {
    const row: number[][] = [];
    for (let x = 0; x < map.width; x++)
      row.push([...map.data.subarray((y * map.width + x) * 4, (y * map.width + x) * 4 + 3), 255]);
    rows.push(row);
  }
  for (let y = 0; y < gap; y++) rows.push(Array.from({ length: maps[0].width }, () => [40, 40, 48, 255]));
}
encode(output, rows);
