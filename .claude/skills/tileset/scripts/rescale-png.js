// Re-scales upscaled pixel art to a different whole-number scale, optionally
// cropping to the top-left W x H native pixels first. Usage (from the repo root):
//   node .claude/skills/tileset/scripts/rescale-png.js --from 3 --to 2 --crop 672x1008 in.png out.png
// --from is the scale the input is drawn at (each art pixel is an NxN block;
// the script checks every block is one color and fails if not), --to the
// scale to write. Uses only Node built-ins; writes RGBA PNGs.

import { decode, encode } from './dump-png.js';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : fallback;
};
const from = Number(option('--from', 1));
const to = Number(option('--to', 1));
const cropArg = option('--crop', null);
const [input, output] = args;

const rows = decode(input);
const [width, height] = cropArg ? cropArg.split('x').map(Number) : [rows[0].length / from, rows.length / from];

const native = [];
for (let y = 0; y < height; y++) {
  const row = [];
  for (let x = 0; x < width; x++) {
    const px = rows[y * from][x * from];
    for (let dy = 0; dy < from; dy++) {
      for (let dx = 0; dx < from; dx++) {
        if (rows[y * from + dy][x * from + dx].join() !== px.join()) {
          throw new Error(`Pixel (${x}, ${y}) isn't a solid ${from}x${from} block; wrong --from?`);
        }
      }
    }
    row.push(px);
  }
  native.push(row);
}

const scaled = [];
for (let y = 0; y < height * to; y++) {
  scaled.push(Array.from({ length: width * to }, (_, x) => native[Math.floor(y / to)][Math.floor(x / to)]));
}
encode(output, scaled);
console.log(`${input} (${from}x) -> ${output}: ${width * to}x${height * to} (${to}x)`);
