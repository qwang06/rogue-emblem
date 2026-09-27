// Prints Kenney Tiny Battle tiles as ASCII so their contents can be read
// without an image viewer. Usage (from the repo root):
//   node .claude/skills/tileset/scripts/dump-tile.js 18 37 90
//   node .claude/skills/tileset/scripts/dump-tile.js --colors 18 37 90
// The default mode draws each tile with one character per pixel; --colors
// lists each tile's distinct colors (hex:pixelCount) instead. Uses only Node
// built-ins; handles the 4-bit palette PNGs (with transparency) in Tiles/.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const TILES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../../src/assets/kenney_tiny-battle/Tiles');
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

// Returns the tile as rows of [r, g, b, a] pixels.
function decode(file) {
  const buf = fs.readFileSync(file);
  let pos = 8;
  let header;
  let palette;
  let alphas;
  const data = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const chunk = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      header = { width: chunk.readUInt32BE(0), height: chunk.readUInt32BE(4), depth: chunk[8], colorType: chunk[9] };
    }
    if (type === 'PLTE') palette = chunk;
    if (type === 'tRNS') alphas = chunk;
    if (type === 'IDAT') data.push(chunk);
    pos += 12 + len;
  }

  const { width, height, depth, colorType } = header;
  const channels = CHANNELS[colorType];
  const stride = Math.ceil((width * channels * depth) / 8);
  const step = Math.max(1, (channels * depth) >> 3);
  const raw = zlib.inflateSync(Buffer.concat(data));
  const pixels = Buffer.alloc(height * stride);
  let prev = Buffer.alloc(stride);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= step ? cur[i - step] : 0;
      const b = prev[i];
      const c = i >= step ? prev[i - step] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[i] = v & 255;
    }
    cur.copy(pixels, y * stride);
    prev = cur;
  }

  const rows = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      if (colorType === 3) {
        const bit = x * depth;
        const byte = pixels[y * stride + (bit >> 3)];
        const index = (byte >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
        const alpha = alphas && index < alphas.length ? alphas[index] : 255;
        row.push([palette[index * 3], palette[index * 3 + 1], palette[index * 3 + 2], alpha]);
      } else {
        const i = y * stride + x * channels;
        row.push([pixels[i], pixels[i + 1], pixels[i + 2], channels === 4 ? pixels[i + 3] : 255]);
      }
    }
    rows.push(row);
  }
  return rows;
}

const hex = ([r, g, b]) => [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');

// One character per palette color, grouped by family. Faction colors use
// their initial: uppercase = dark shade, lowercase = main, then a highlight.
// A color missing from this map prints as '?' — add it here when it shows up.
const LEGEND = {
  '3f2631': '#', // outline
  // grass
  '84c669': '.',
  '65a556': ',', // shade
  '8bd87d': ':', // highlight
  // water
  '75e3ff': '~',
  '9febff': '-', // light
  '46c4e4': '=', // deep / shadow
  'd9f7ff': 'o', // foam
  // sand / shoreline
  'eaa56c': 's',
  'cf8254': 'S',
  // neutral grey (roads, stone, neutral buildings)
  'c0cbdc': 'l', // light
  '8b9bb4': 'm', // mid
  '677794': 'k', // slate
  '52607c': 'd', // dark
  // blue faction
  '0077c5': 'B',
  '009adc': 'b',
  '00c6f4': 'c',
  // red faction
  'aa2c23': 'R',
  'e84537': 'r',
  'ff7571': 'p',
  // orange / yellow faction
  'c56e33': 'Y',
  'ff9336': 'y',
  'ffcd65': 'h',
  // green faction / trees
  '439545': 'G',
  'aae393': 'g',
  // skin and hair
  'f7c282': 'f',
  'e19a65': 'F',
  'bd6c4a': 'T',
  // white
  'ffffff': 'w',
  'f8f8f8': 'w',
  'eef8fe': 'w',
  'ebf3f6': 'w',
  'ecf5fe': 'w',
  // flower petals
  'fdbe53': '*',
  'e38628': '*',
};

function toChar(px) {
  if (px[3] === 0) return ' ';
  return LEGEND[hex(px)] ?? '?';
}

const args = process.argv.slice(2);
const colorsMode = args[0] === '--colors';
const frames = colorsMode ? args.slice(1) : args;

for (const frame of frames) {
  const rows = decode(path.join(TILES_DIR, `tile_${String(frame).padStart(4, '0')}.png`));
  if (colorsMode) {
    const counts = {};
    for (const px of rows.flat()) {
      const key = px[3] === 0 ? 'transparent' : hex(px);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    const list = Object.entries(counts)
      .sort((p, q) => q[1] - p[1])
      .map(([color, n]) => `${color}:${n}`);
    console.log(`tile ${frame}  ${list.join(' ')}`);
  } else {
    console.log(`tile ${frame}\n${rows.map((row) => row.map(toChar).join('')).join('\n')}\n`);
  }
}
