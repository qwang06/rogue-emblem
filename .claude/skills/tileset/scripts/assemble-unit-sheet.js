// Assembles a unit's Idle and Move sheets from four finished stills, one per
// facing, at any frame size (the stills' own size, e.g. 64x64). Usage (from
// the repo root):
//   node .claude/skills/tileset/scripts/assemble-unit-sheet.js <stillsDir> <Unit_NN>
// reads <stillsDir>/{south,west,east,north}.png and writes
// src/assets/units/<Unit_NN>_{Idle,Move}.png: 4x4 frames, rows down, left,
// right, up (UNIT_SHEET in src/game/tileset.ts). Unlike build-unit-sheet.js
// it keeps the stills as they are (no palette snap, crop or rescale), so
// they should already stand where UNIT_SHADOW sits. The frames only shift
// the still: idle sinks it one 32px-grid pixel for the middle two frames,
// move hops it two up on the off beats. A tall still with less room than
// that above or below it gets a smaller sink or hop, so it is never cut off.
// Uses only Node built-ins.

import path from 'node:path';
import { decode, encode } from './dump-png.js';

const [stillsDir, name] = process.argv.slice(2);
if (!stillsDir || !name) {
  console.error('usage: assemble-unit-sheet.js <stillsDir> <Unit_NN>');
  process.exit(1);
}

const FACINGS = ['south', 'west', 'east', 'north']; // sheet rows down, left, right, up
const stills = FACINGS.map((facing) => decode(path.join(stillsDir, `${facing}.png`)));
const size = stills[0].length;
for (const [i, still] of stills.entries()) {
  if (still.length !== size || still.some((row) => row.length !== size)) {
    throw new Error(`${FACINGS[i]}.png is not ${size}x${size}`);
  }
}
// One pixel of the 32px grid the other sheets' motion was drawn on.
const step = size / 32;
// Clear rows above the tallest still and below the lowest one.
const isClear = (y) => stills.every((still) => still[y].every((pixel) => pixel[3] === 0));
let headroom = 0;
while (headroom < size && isClear(headroom)) headroom++;
let footroom = 0;
while (footroom < size && isClear(size - 1 - footroom)) footroom++;
const sink = Math.min(step, footroom);
const hop = Math.min(2 * step, headroom);
if (sink < step || hop < 2 * step) console.log(`tall stills: sink ${sink}px, hop ${hop}px`);
const OFFSETS = {
  Idle: [0, sink, sink, 0],
  Move: [0, -hop, 0, -hop],
};

const CLEAR = [0, 0, 0, 0];
for (const [animation, offsets] of Object.entries(OFFSETS)) {
  const sheet = Array.from({ length: size * 4 }, () => Array.from({ length: size * 4 }, () => CLEAR));
  stills.forEach((still, row) =>
    offsets.forEach((dy, column) => {
      for (let y = 0; y < size; y++) {
        const sy = y - dy;
        if (sy < 0 || sy >= size) continue;
        for (let x = 0; x < size; x++) sheet[row * size + y][column * size + x] = still[sy][x];
      }
    }),
  );
  const out = `src/assets/units/${name}_${animation}.png`;
  encode(out, sheet);
  console.log(`wrote ${out} (${size * 4}x${size * 4})`);
}
