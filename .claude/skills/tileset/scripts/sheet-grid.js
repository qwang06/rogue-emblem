// Renders a block of a tilesheet as a zoomed contact sheet you can look at:
// each tile over a gray checkerboard (so transparency shows), magenta grid
// lines between tiles, and red column/row numbers along the top and left.
// Also prints each non-empty tile's opaque bounding box and pixel count.
// Usage (from the repo root):
//   node .claude/skills/tileset/scripts/sheet-grid.js [--scale 2] [--tile 32] in.png out.png c0 r0 c1 r1
// c0 r0 c1 r1 are the first and last tile columns/rows to include. Uses only
// Node built-ins.

import { decode, encode } from './dump-png.js';

// 3x5 digit glyphs, drawn at 3x.
const DIGITS = [
  '111101101101111',
  '010110010010111',
  '111001111100111',
  '111001111001111',
  '101101111001001',
  '111100111001111',
  '111100111101111',
  '111001001001001',
  '111101111101111',
  '111101111001111',
];
const MARGIN = 24;
const GRID = [255, 0, 255, 255];
const LABEL = [200, 0, 0, 255];

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : fallback;
};
const scale = Number(option('--scale', 2));
const size = Number(option('--tile', 32));
const [input, output, ...range] = args;
const [c0, r0, c1, r1] = range.map(Number);

const src = decode(input);
const columns = c1 - c0 + 1;
const rows = r1 - r0 + 1;
const cell = size * scale + 1;
const width = MARGIN + columns * cell + 1;
const height = MARGIN + rows * cell + 1;
const out = Array.from({ length: height }, () => Array.from({ length: width }, () => [255, 255, 255, 255]));
const put = (x, y, px) => {
  if (x >= 0 && y >= 0 && x < width && y < height) out[y][x] = px;
};
const label = (n, x, y) => {
  for (const digit of String(n)) {
    [...DIGITS[digit]].forEach((on, i) => {
      if (on !== '1') return;
      for (let dy = 0; dy < 3; dy++)
        for (let dx = 0; dx < 3; dx++) put(x + (i % 3) * 3 + dx, y + Math.floor(i / 3) * 3 + dy, LABEL);
    });
    x += 12;
  }
};

for (let r = 0; r < rows; r++) {
  for (let c = 0; c < columns; c++) {
    const ox = MARGIN + c * cell + 1;
    const oy = MARGIN + r * cell + 1;
    let [x0, y0, x1, y1, count] = [size, size, -1, -1, 0];
    for (let y = 0; y < size * scale; y++) {
      for (let x = 0; x < size * scale; x++) {
        const sx = Math.floor(x / scale);
        const sy = Math.floor(y / scale);
        const px = src[(r0 + r) * size + sy]?.[(c0 + c) * size + sx] ?? [0, 0, 0, 0];
        const check = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 ? 200 : 230;
        const a = px[3] / 255;
        put(ox + x, oy + y, [...[0, 1, 2].map((i) => Math.round(px[i] * a + check * (1 - a))), 255]);
        if (px[3] > 0 && x % scale === 0 && y % scale === 0) {
          count++;
          [x0, y0, x1, y1] = [Math.min(x0, sx), Math.min(y0, sy), Math.max(x1, sx), Math.max(y1, sy)];
        }
      }
    }
    if (count) console.log(`[${c0 + c}, ${r0 + r}] x ${x0}-${x1}, y ${y0}-${y1}, ${count} px`);
  }
}
for (let c = 0; c <= columns; c++) for (let y = MARGIN; y < height; y++) put(MARGIN + c * cell, y, GRID);
for (let r = 0; r <= rows; r++) for (let x = MARGIN; x < width; x++) put(x, MARGIN + r * cell, GRID);
for (let c = 0; c < columns; c++) label(c0 + c, MARGIN + c * cell + 4, 4);
for (let r = 0; r < rows; r++) label(r0 + r, 0, MARGIN + r * cell + 4);

encode(output, out);
console.log(`${output}: ${width}x${height}`);
