// Builds a unit's Idle and Move sheets from four 16px-scale stills, one per
// facing (e.g. PixelLab's rotation images, any canvas size, 1 art pixel per
// pixel). Usage (from the repo root):
//   node .claude/skills/tileset/scripts/build-unit-sheet.js <stillsDir> <Name>...
// reads <stillsDir>/<name>_{south,west,east,north}.png (name in lower case)
// and writes src/assets/units/<Name>_01_{Idle,Move}.png at the game's 2x.
// Each still is snapped to the unit pack's palette (near-black becomes the
// pack's outline color), cropped to its figure and stood with its feet on
// y 14 of a 16px frame, where UNIT_SHADOW sits. The frames are made here
// rather than generated: idle sinks the body 1px onto the feet for two
// frames, move hops 1px up on the off beats. Uses only Node built-ins.

import { readdirSync } from 'node:fs';
import path from 'node:path';
import { decode, encode } from './dump-png.js';

const [stillsDir, ...names] = process.argv.slice(2);
const unitsDir = 'src/assets/units';

// The pack's palette: every opaque color used by the other unit sheets.
const palette = new Map();
for (const f of readdirSync(unitsDir)) {
  if (!f.endsWith('.png') || names.some((name) => f.startsWith(`${name}_`))) continue;
  for (const row of decode(path.join(unitsDir, f))) {
    for (const [r, g, b, a] of row) if (a === 255) palette.set(`${r},${g},${b}`, [r, g, b]);
  }
}
const colors = [...palette.values()];
const OUTLINE = [0x29, 0x1d, 0x2b];

function remap([r, g, b, a]) {
  if (a < 128) return [0, 0, 0, 0];
  if (Math.max(r, g, b) < 0x40) return [...OUTLINE, 255];
  let best = null;
  let bestD = Infinity;
  for (const c of colors) {
    // Weighted RGB distance, close enough to perceptual for snapping tones.
    const d = 2 * (c[0] - r) ** 2 + 4 * (c[1] - g) ** 2 + 3 * (c[2] - b) ** 2;
    if (d < bestD) [best, bestD] = [c, d];
  }
  return [...best, 255];
}

const CLEAR = [0, 0, 0, 0];
const blank = () => Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => CLEAR));
const double = (rows) => rows.flatMap((row) => [row, row].map(() => row.flatMap((px) => [px, px])));

// Crop a still to 16x16: centered horizontally, bottom opaque row on y 14.
function toFrame(file) {
  const rows = decode(file).map((row) => row.map(remap));
  let x0 = Infinity;
  let x1 = -1;
  let y0 = Infinity;
  let y1 = -1;
  rows.forEach((row, y) =>
    row.forEach((px, x) => {
      if (px[3]) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
    }),
  );
  const w = x1 - x0 + 1;
  if (y1 - y0 + 1 > 15) y1 = y0 + 14; // drop stray rows under the feet
  const h = y1 - y0 + 1;
  if (w > 16) throw new Error(`${file}: ${w}px wide doesn't fit a 16px frame`);
  const frame = blank();
  const dx = Math.floor((16 - w) / 2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) frame[14 - (h - 1) + y][dx + x] = rows[y0 + y][x0 + x];
  return frame;
}

const shift = (frame, dy) => {
  const f = blank();
  for (let y = 0; y < 16; y++) if (frame[y - dy]) f[y] = frame[y - dy];
  return f;
};

// Squash by one row: everything above the feet sinks 1px, the feet stay put.
function squash(frame) {
  const top = frame.findIndex((row) => row.some((px) => px[3]));
  const f = frame.map((row) => row.slice());
  const cut = 12; // the row dropped, just above the feet
  for (let y = cut; y > top; y--) f[y] = frame[y - 1].slice();
  f[top] = Array.from({ length: 16 }, () => CLEAR);
  return f;
}

function sheet(frames) {
  const rows = Array.from({ length: 64 }, () => Array.from({ length: 64 }, () => CLEAR));
  frames.forEach((dirFrames, r) =>
    dirFrames.forEach((frame, c) => {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) rows[r * 16 + y][c * 16 + x] = frame[y][x];
    }),
  );
  return rows;
}

for (const name of names) {
  const stills = ['south', 'west', 'east', 'north'].map((d) =>
    toFrame(path.join(stillsDir, `${name.toLowerCase()}_${d}.png`)),
  );
  const idle = stills.map((s) => [s, s, squash(s), squash(s)]);
  const move = stills.map((s) => [s, shift(s, -1), squash(s), shift(s, -1)]);
  encode(path.join(unitsDir, `${name}_01_Idle.png`), double(sheet(idle)));
  encode(path.join(unitsDir, `${name}_01_Move.png`), double(sheet(move)));
}
