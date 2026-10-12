// Draws the UI's pixel art (window frames and the hand pointer) at 1x into
// src/assets/ui/, so their colors and sizes stay tunable here instead of in
// an image editor. Usage (from the repo root):
//   node .claude/skills/tileset/scripts/draw-ui-art.js
// Each frame is a 9-slice for CSS border-image: 8px corners and edges round
// an 8px center, so `border-image-slice: 8 fill` cuts it. The edge's last
// two bands are the fill, a little built-in padding.

import { encode } from './dump-png.js';

const OUT = 'src/assets/ui';

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];
const CLEAR = [0, 0, 0, 0];

// Shared gold trim for the corner plates.
const GOLD = { o: '#2a170a', h: '#ffe08a', g: '#e8b030', d: '#9a6418' };

// The top-left corner plate (6x6) and the gold spur it runs along each
// edge's light band; the other corners mirror them.
const PLATE = ['oooooo', 'ohhhgo', 'ohggdo', 'ohgddo', 'ogdddo', 'oooooo'];
const SPUR = { band: 2, length: 2, color: 'g' };

const SLICE = 8;

// Each variant's edge, outside in (one color per row of the top edge),
// and its center fill.
const FRAMES = {
  parchment: {
    edge: ['#2a170a', '#7a4a22', '#b07a3c', '#7a4a22', '#2a170a', '#d9b77e', '#f0d9a8', '#f0d9a8'],
    fill: '#f0d9a8',
  },
  banner: {
    edge: ['#14204a', '#9a6418', '#e8b030', '#9a6418', '#14204a', '#4f7ad8', '#2a4fa8', '#2a4fa8'],
    fill: '#2a4fa8',
  },
  'banner-red': {
    edge: ['#3a0e0e', '#9a6418', '#e8b030', '#9a6418', '#3a0e0e', '#d8584f', '#a82a2a', '#a82a2a'],
    fill: '#a82a2a',
  },
};

function drawFrame({ edge, fill }) {
  const size = SLICE * 3;
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = [];
    for (let x = 0; x < size; x++) {
      // Distance in from the nearest outer edge picks the edge band.
      const depth = Math.min(x, y, size - 1 - x, size - 1 - y);
      row.push(hex(depth < SLICE ? edge[depth] : fill));
    }
    rows.push(row);
  }
  // Every corner pixel is set through here, mirrored to all four corners.
  const put = (x, y, color) => {
    rows[y][x] = color;
    rows[y][size - 1 - x] = color;
    rows[size - 1 - y][x] = color;
    rows[size - 1 - y][size - 1 - x] = color;
  };
  for (let i = 0; i < SPUR.length; i++) {
    put(PLATE.length + i, SPUR.band, hex(GOLD[SPUR.color]));
    put(SPUR.band, PLATE.length + i, hex(GOLD[SPUR.color]));
  }
  for (let py = 0; py < PLATE.length; py++) {
    for (let px = 0; px < PLATE.length; px++) {
      put(px, py, hex(GOLD[PLATE[py][px]]));
    }
  }
  return rows;
}

// A white gauntlet pointing right: a blue-grey cuff on the left, the index
// finger out along the top, three folded knuckles under it.
const HAND = [
  '....ooo.......',
  '..oowwwoooooo.',
  'ooawwwwwwwwwwo',
  'oawwwwwoooooo.',
  'oawwwwwwso....',
  'oawwwwwoo.....',
  'oawwwwwwso....',
  'ooawwwwoo.....',
  '..oasssso.....',
  '...ooooo......',
];
const HAND_COLORS = { o: '#2a170a', w: '#f8f8f0', s: '#b8c0d0', a: '#8a96b8' };

function drawHand() {
  return HAND.map((line) => [...line].map((c) => (c === '.' ? CLEAR : hex(HAND_COLORS[c]))));
}

for (const [name, frame] of Object.entries(FRAMES)) encode(`${OUT}/frame-${name}.png`, drawFrame(frame));
encode(`${OUT}/hand-pointer.png`, drawHand());
