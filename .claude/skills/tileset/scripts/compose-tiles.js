// Composes tiles of a tilesheet into a small preview scene, to check how
// overlays stack (a mountain over grass, rocks over water, a cap in the cell
// above) without launching the game. Usage (from the repo root):
//   node .claude/skills/tileset/scripts/compose-tiles.js [--scale 3] [--tile 32] [--sheet src/assets/overworld.png] out.png "0,0+4,0 0,0+5,0 / 0,0+4,1 5,9+12,1"
// The layout lists rows separated by `/`, cells by spaces; each cell is `.`
// (empty, magenta) or tiles `c,r` joined with `+`, drawn bottom to top with
// alpha blending. Uses only Node built-ins.

import { decode, encode } from './dump-png.js';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : fallback;
};
const scale = Number(option('--scale', 3));
const size = Number(option('--tile', 32));
const sheet = decode(option('--sheet', 'src/assets/overworld.png'));
const [output, layout] = args;

const cells = layout.split('/').map((row) =>
  row
    .trim()
    .split(/\s+/)
    .map((cell) => (cell === '.' ? [] : cell.split('+').map((tile) => tile.split(',').map(Number)))),
);
const height = cells.length * size;
const width = Math.max(...cells.map((row) => row.length)) * size;
const scene = Array.from({ length: height }, () => Array.from({ length: width }, () => [255, 0, 255]));

cells.forEach((row, gy) =>
  row.forEach((layers, gx) =>
    layers.forEach(([c, r]) => {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const px = sheet[r * size + y][c * size + x];
          const a = px[3] / 255;
          const under = scene[gy * size + y][gx * size + x];
          scene[gy * size + y][gx * size + x] = [0, 1, 2].map((i) => Math.round(px[i] * a + under[i] * (1 - a)));
        }
      }
    }),
  ),
);

encode(
  output,
  Array.from({ length: height * scale }, (_, y) =>
    Array.from({ length: width * scale }, (_, x) => [...scene[Math.floor(y / scale)][Math.floor(x / scale)], 255]),
  ),
);
console.log(`${output}: ${width * scale}x${height * scale}`);
