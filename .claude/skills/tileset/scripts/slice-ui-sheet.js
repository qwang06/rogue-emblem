// Cuts the UI's pixel art out of the UI asset sheet (src/assets/ui/ui-sheet-3x.png,
// drawn at 3x) into the 1x files the React UI shows: the window frames, the
// title name plate, the hand pointer, buttons, checkboxes, a slider knob, an
// item slot, and the 8x8 icons that replace painted
// glyphs (doubled to 16x16, so they keep the glyphs' size). Usage (from the
// repo root):
//   node .claude/skills/tileset/scripts/slice-ui-sheet.js
// Coordinates below are in the sheet's 1x pixels (the 3x sheet is 1024x1024
// art pixels). The sheet is cataloged in the tileset skill's ui-sheet-catalog.md.

import { decode, encode } from './dump-png.js';

const SHEET = 'src/assets/ui/ui-sheet-3x.png';
const SCALE = 3;
const UI = 'src/assets/ui';
const GLYPHS = 'src/assets/glyphs';

const rows3x = decode(SHEET);

// The sheet's art pixel at (x, y), checking its 3x3 block is one color.
function pixel(x, y) {
  const px = rows3x[y * SCALE][x * SCALE];
  for (let dy = 0; dy < SCALE; dy++) {
    for (let dx = 0; dx < SCALE; dx++) {
      if (rows3x[y * SCALE + dy][x * SCALE + dx].join() !== px.join()) {
        throw new Error(`sheet pixel ${x},${y} is not a solid ${SCALE}x${SCALE} block`);
      }
    }
  }
  return px;
}

function cut(x, y, w, h) {
  return Array.from({ length: h }, (_, j) => Array.from({ length: w }, (_, i) => pixel(x + i, y + j)));
}

const toHex = ([r, g, b]) => `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
const fromHex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];

// Swaps colors (from hex -> to hex); every opaque color must be listed, so a
// sheet edit that adds a color fails loudly instead of leaking through.
function recolor(rows, swaps) {
  return rows.map((row) =>
    row.map((px) => {
      if (px[3] === 0) return px;
      const to = swaps[toHex(px)];
      if (!to) throw new Error(`recolor: no swap for ${toHex(px)}`);
      return fromHex(to);
    }),
  );
}

function scale(rows, n) {
  return rows.flatMap((row) => Array.from({ length: n }, () => row.flatMap((px) => Array(n).fill(px))));
}

function write(file, rows) {
  encode(file, rows);
  console.log(`${file} ${rows[0].length}x${rows.length}`);
}

// ---- Window frames: 36x36 9-slices, 10px corners (border-image-slice: 10 fill).
// The sheet's first frame (peach, teal gems) is the parchment window; its
// slate frame (red gems) is the player banner, darkened so light text reads
// on it, and recolored for the enemy (red) and guest (green) banners.
const PARCHMENT = cut(6, 6, 36, 36);
const SLATE = cut(54, 6, 36, 36);
// Slate frame colors: outline, light rim, rim, dark ring, gem light, gem, fill.
const [OUTLINE, RIM_LIGHT, RIM, RING, GEM_LIGHT, GEM, FILL] = [
  '#2b2b45',
  '#686f99',
  '#404973',
  '#3a3f5e',
  '#ffc2a1',
  '#e64539',
  '#a3a7c2',
];
const banner = (c) => ({
  [OUTLINE]: c.outline,
  [RIM_LIGHT]: c.rimLight,
  [RIM]: c.rim,
  [RING]: c.ring,
  [GEM_LIGHT]: c.gemLight,
  [GEM]: c.gem,
  [FILL]: c.fill,
});
write(`${UI}/frame-parchment.png`, PARCHMENT);
write(
  `${UI}/frame-banner.png`,
  recolor(
    SLATE,
    banner({
      outline: OUTLINE,
      rimLight: '#a3a7c2',
      rim: RIM_LIGHT,
      ring: OUTLINE,
      gemLight: GEM_LIGHT,
      gem: GEM,
      fill: '#404973',
    }),
  ),
);
write(
  `${UI}/frame-banner-red.png`,
  recolor(
    SLATE,
    banner({
      outline: '#3d1f2b',
      rimLight: '#e64539',
      rim: '#ad2f45',
      ring: '#3d1f2b',
      gemLight: '#ffee83',
      gem: '#f0b541',
      fill: '#781d4f',
    }),
  ),
);
write(
  `${UI}/frame-banner-green.png`,
  recolor(
    SLATE,
    banner({
      outline: '#1f3324',
      rimLight: '#63ab3f',
      rim: '#3b7d3a',
      ring: '#1f3324',
      gemLight: '#ffee83',
      gem: '#f0b541',
      fill: '#2a5530',
    }),
  ),
);

// ---- A window title's name plate: the rose plate with teal gems, 48x13, a
// 3-slice with 8px pointed ends (border-image-slice: 0 8 fill).
write(`${UI}/name-plate.png`, cut(0, 50, 48, 13));

// ---- A gauge's trough (HP, MP, EXP bars), 48x9: outline and light rim on
// top (2 rows), a 4-row dark trough, rim, outline and drop shadow below (3
// rows), 3px ends (border-image-slice: 2 3 3 fill).
write(`${UI}/bar-frame.png`, cut(0, 212, 48, 9));

// ---- The selection pointer: the cream hand pointing right, 11x8, fingertip
// at x 10, y 3.
write(`${UI}/hand-pointer.png`, cut(83, 132, 11, 8));
// The same hand pointing down (the overworld's site marker), 8x11.
write(`${UI}/hand-pointer-down.png`, cut(100, 131, 8, 11));

// ---- Small teal arrows, 5x5: the dialog's "more" cue and a scrolling
// list's cues for rows hidden above or below.
write(`${UI}/arrow-down.png`, cut(38, 134, 5, 5));
write(`${UI}/arrow-up.png`, cut(54, 133, 5, 5));

// ---- Buttons: the rose button, normal / highlighted (orange, with a gold
// glow ring) / pressed (dark). Each is cut with a 1px margin round the
// button so the three share one 20x15 canvas (the glow fills the margin):
// a 9-slice, border-image-slice 4 4 5 fill, drawn with
// border-image-outset 1 so the button itself fills the element.
write(`${UI}/button.png`, cut(150, 161, 20, 15));
write(`${UI}/button-hover.png`, cut(182, 161, 20, 15));
write(`${UI}/button-pressed.png`, cut(214, 161, 20, 15));

// ---- A checkbox, 10x11: the rose square, empty and with its teal gem.
write(`${UI}/checkbox.png`, cut(3, 147, 10, 11));
write(`${UI}/checkbox-checked.png`, cut(19, 147, 10, 11));

// ---- A slider's knob, 8x8: the orange bead off the bars' middle row.
write(`${UI}/slider-knob.png`, cut(436, 228, 8, 8));

// ---- An empty item slot, 16x16: the rose tile (rounded outline, cream
// highlight on its right and bottom), a 9-slice with 3px corners.
write(`${UI}/item-slot.png`, cut(0, 112, 16, 16));

// ---- Icons: the sheet has each icon three times (plain, gold glow, dark
// outline); the glyphs use the bottom set, the dark-outlined ones: 10x10
// in a 16px grid from (3, 772) (row A) and (3, 788) (row B), doubled into
// 20x20 glyphs. See ui-sheet-catalog.md for every icon.
const icon = (row, col) => cut(3 + 16 * col, row === 'A' ? 772 : 788, 10, 10);
const GLYPH_ICONS = {
  auto: icon('B', 4), // a half disc with motion lines (fast forward)
  exp: icon('A', 0), // orange star
  health: icon('A', 2), // red heart
  gold: icon('A', 4), // coin
  skull: icon('A', 5),
  danger: icon('A', 6), // exclamation mark
  attack: icon('A', 8), // sword
  move: icon('A', 10), // boot
  book: icon('A', 11), // closed book
  skill: icon('A', 12), // wand
  heal: icon('A', 13), // red cross
  item: icon('A', 14), // pouch
  settings: icon('B', 2), // gear
  music: icon('B', 3), // music note
  avoid: icon('B', 6), // feather
  mp: icon('B', 11), // cyan flask
  // hit stays the painted 16px bullseye: the sheet's target (B, 14) is a
  // pink-orange square ring that reads as a social media logo.
};
for (const [kind, rows] of Object.entries(GLYPH_ICONS)) write(`${GLYPHS}/${kind}.png`, scale(rows, 2));
