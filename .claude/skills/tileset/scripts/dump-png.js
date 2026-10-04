// Prints PNG images (or one tile of a tilesheet) as ASCII, so pixel art can
// be read without an image viewer. Usage (from the repo root):
//   node .claude/skills/tileset/scripts/dump-png.js src/assets/Villager_01_Idle.png
//   node .claude/skills/tileset/scripts/dump-png.js --tile 32 src/assets/tileset-grass-water.png:15
//   node .claude/skills/tileset/scripts/dump-png.js --colors src/assets/Villager_01_Idle.png
// Each distinct color gets its own character, most common first, with a
// legend (char = hex) under the image; transparent pixels print as spaces.
// `file:n` with --tile N prints frame n (row-major, N-pixel tiles) of a
// sheet. --colors lists colors and pixel counts instead of drawing. Uses
// only Node built-ins; handles palette, grey, RGB and RGBA PNGs (no
// interlacing).

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import zlib from 'node:zlib';

const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

// Returns the image as rows of [r, g, b, a] pixels.
export function decode(file) {
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
        const [r, g, b] = [pixels[i], pixels[i + 1], pixels[i + 2]];
        // An RGB image's tRNS chunk names one color (16-bit samples) as transparent.
        const keyed = colorType === 2 && alphas && r === alphas[1] && g === alphas[3] && b === alphas[5];
        row.push([r, g, b, channels === 4 ? pixels[i + 3] : keyed ? 0 : 255]);
      }
    }
    rows.push(row);
  }
  return rows;
}

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
export function encode(file, rows) {
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
    Buffer.concat([
      signature,
      chunk('IHDR', header),
      chunk('IDAT', zlib.deflateSync(raw)),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  );
}

const hex = ([r, g, b]) => [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
const CHARS = '#.,:~-=o*+%@&$sSlmkdbBcrRpyYhGgfFTwWxXzZ0123456789';

function crop(rows, size, frame) {
  const columns = Math.floor(rows[0].length / size);
  const x0 = (frame % columns) * size;
  const y0 = Math.floor(frame / columns) * size;
  return rows.slice(y0, y0 + size).map((row) => row.slice(x0, x0 + size));
}

// Only run the CLI when invoked directly, so other scripts can import decode.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

function main() {
  const args = process.argv.slice(2);
  const colorsMode = args.includes('--colors');
  const sizeIndex = args.indexOf('--tile');
  const size = sizeIndex >= 0 ? Number(args[sizeIndex + 1]) : null;
  const targets = args.filter((arg, i) => !arg.startsWith('--') && (sizeIndex < 0 || i !== sizeIndex + 1));

  for (const target of targets) {
    const [, file, frame] = target.match(/^(.*?)(?::(\d+))?$/);
    let rows = decode(file);
    if (size && frame !== undefined) rows = crop(rows, size, Number(frame));

    const counts = new Map();
    for (const px of rows.flat()) {
      if (px[3] === 0) continue;
      counts.set(hex(px), (counts.get(hex(px)) ?? 0) + 1);
    }
    const colors = [...counts].sort((p, q) => q[1] - p[1]);
    console.log(`${target}  ${rows[0].length}x${rows.length}`);
    if (colorsMode) {
      console.log(colors.map(([color, n]) => `${color}:${n}`).join(' '), '\n');
      continue;
    }
    const chars = new Map(colors.map(([color], i) => [color, CHARS[i] ?? '?']));
    console.log(rows.map((row) => row.map((px) => (px[3] === 0 ? ' ' : chars.get(hex(px)))).join('')).join('\n'));
    console.log([...chars].map(([color, char]) => `${char}=${color}`).join(' '), '\n');
  }
}
