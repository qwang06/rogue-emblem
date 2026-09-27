// Re-scales upscaled pixel art to a different whole-number scale, optionally
// cropping to the top-left W x H native pixels first. Usage (from the repo root):
//   node .claude/skills/tileset/scripts/rescale-png.js --from 3 --to 2 --crop 672x1008 in.png out.png
// --from is the scale the input is drawn at (each art pixel is an NxN block;
// the script checks every block is one color and fails if not), --to the
// scale to write. Uses only Node built-ins; writes RGBA PNGs.

import fs from 'node:fs';
import zlib from 'node:zlib';
import { decode } from './dump-png.js';

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

// Writes rows of [r, g, b, a] pixels as an RGBA PNG.
function encode(file, rows) {
  const height = rows.length;
  const width = rows[0].length;
  const raw = Buffer.alloc(height * (width * 4 + 1));
  rows.forEach((row, y) => row.forEach((px, x) => raw.set(px, y * (width * 4 + 1) + 1 + x * 4)));
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  fs.writeFileSync(
    file,
    Buffer.concat([signature, chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]),
  );
}

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
const [width, height] = cropArg
  ? cropArg.split('x').map(Number)
  : [rows[0].length / from, rows.length / from];

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
