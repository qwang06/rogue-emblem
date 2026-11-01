// Makes a season's overworld site icons (src/assets/realm/sites/<season>/)
// from the summer ones in src/assets/realm/sites/, so a site playing a
// seasonal region stands on seasonal ground. The icons are full-color
// PixelLab art with dozens of shades, so this recolors by hue rather than
// by exact color: each pixel's grass (green) or earth (brown) shade is
// remapped, keeping its lightness so the shading survives. Run from the
// repo root:
//
//   node .claude/skills/tileset/scripts/recolor-sites.js autumn
//   node .claude/skills/tileset/scripts/recolor-sites.js winter
//   node .claude/skills/tileset/scripts/recolor-sites.js underworld

import fs from 'node:fs';
import path from 'node:path';
import { decode, encode } from './dump-png.js';

const SOURCE = 'src/assets/realm/sites';
const season = process.argv[2];

// RGB (0-255) to HSL (h in degrees, s and l 0-1), and back.
function toHsl([r, g, b]) {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s, l];
}
function toRgb([h, s, l]) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return [r, g, b].map((v) => Math.round(Math.min(1, Math.max(0, v + m)) * 255));
}
const clamp = (v) => Math.min(1, Math.max(0, v));

// Grass: a green with some color to it (olive only when dark, so pale
// canvas and straw stay). Earth: a warm brown or tan.
const isGrass = ([h, s, l]) => h >= 45 && h <= 165 && s >= 0.15 && l >= 0.12 && (h >= 62 || l <= 0.6);
const isEarth = ([h, s, l]) => h >= 15 && h < 45 && s >= 0.15 && l >= 0.1 && l <= 0.75;

// Each season maps a grass pixel's and an earth pixel's HSL to new HSL.
const SEASONS = {
  // Golden and rust grass, the earth as it is.
  autumn: {
    grass: ([h, s, l]) => [h < 100 ? 30 : 16, clamp(s * 1.15 + 0.12), clamp(l * 0.92)],
  },
  // Snow over the grass (pale, a touch blue in the shade), the earth a
  // little colder and paler.
  winter: {
    grass: ([, , l]) => [212, 0.28, clamp(0.62 + l * 0.42)],
    earth: ([h, s, l]) => [h, s * 0.55, clamp(l * 1.05 + 0.03)],
  },
  // Ash for grass, scorched dark earth, with the brightest ash glowing
  // like embers.
  underworld: {
    grass: ([, s, l]) => (l > 0.55 && s > 0.3 ? [18, 0.85, 0.52] : [15, 0.12, clamp(l * 0.62)]),
    earth: ([h, s, l]) => [Math.max(0, h - 14), clamp(s * 0.7), clamp(l * 0.6)],
    damage: () => UNDERWORLD_DAMAGE,
  },
};

// Hand-placed damage, by site kind, painted over a season's recolored
// icon in order. Each step is one of:
//   ['erase', points]          make the pixels transparent
//   ['paint', color, points]   set the pixels to a color
//   ['line', color, path]      a 1px line through [x, y] corners (cracks)
//   ['fill', color, triangle]  the opaque pixels inside a triangle
//   ['cut', triangle]          erase a triangle and outline the cut edge
// Points are [x, y] in the 64x64 icon.
const OUTLINE = '2a1319';
const HOLE = '1e1616';
const STONE = '8a7f78';
const STONE_LIGHT = 'b3a89e';
// A fallen stone: two light pixels over an outline, at [x, y].
const rubble = (x, y) => [
  ['paint', STONE_LIGHT, [[x, y]]],
  ['paint', STONE, [[x + 1, y]]],
  [
    'paint',
    OUTLINE,
    [
      [x, y + 1],
      [x + 1, y + 1],
      [x + 2, y],
    ],
  ],
];
// The underworld's fort and Hold stand half ruined: broken battlements, a
// breach, cracks, fallen stones, and the Hold's flags and banners torn.
const UNDERWORLD_DAMAGE = {
  fort: [
    // The back tower's battlements knocked down, and the left tower's.
    [
      'erase',
      [
        [29, 5],
        [30, 5],
        [31, 5],
        [32, 6],
        [33, 6],
      ],
    ],
    [
      'paint',
      OUTLINE,
      [
        [30, 6],
        [31, 6],
        [32, 7],
        [33, 7],
      ],
    ],
    [
      'erase',
      [
        [12, 16],
        [13, 16],
        [14, 16],
      ],
    ],
    [
      'paint',
      OUTLINE,
      [
        [12, 17],
        [13, 17],
        [14, 17],
      ],
    ],
    // The right tower's top and the left wall's corner crumbled away.
    [
      'cut',
      [
        [49, 14],
        [56, 14],
        [55, 22],
      ],
    ],
    [
      'cut',
      [
        [5, 25],
        [11, 25],
        [5, 33],
      ],
    ],
    // A breach in the front right wall, its rim of broken stone.
    [
      'fill',
      HOLE,
      [
        [38, 22],
        [47, 21],
        [42, 32],
      ],
    ],
    [
      'line',
      OUTLINE,
      [
        [38, 22],
        [42, 32],
        [47, 21],
      ],
    ],
    [
      'paint',
      STONE_LIGHT,
      [
        [39, 25],
        [41, 30],
        [44, 27],
        [45, 24],
      ],
    ],
    // Cracks down both front walls.
    [
      'line',
      OUTLINE,
      [
        [13, 22],
        [15, 25],
        [14, 28],
        [16, 31],
      ],
    ],
    [
      'line',
      OUTLINE,
      [
        [49, 25],
        [48, 28],
        [50, 31],
      ],
    ],
    // Stones fallen from the breach.
    ...rubble(40, 40),
    ...rubble(44, 41),
    ...rubble(37, 43),
  ],
  hold: [
    // Torn flags.
    [
      'erase',
      [
        [36, 2],
        [34, 2],
        [35, 3],
      ],
    ],
    [
      'erase',
      [
        [20, 12],
        [22, 13],
        [21, 13],
      ],
    ],
    [
      'erase',
      [
        [46, 10],
        [48, 11],
        [47, 11],
      ],
    ],
    [
      'erase',
      [
        [54, 25],
        [52, 24],
        [53, 26],
      ],
    ],
    // Tattered banners: ragged hems over the stone behind, and holes.
    [
      'paint',
      '4c3f3b',
      [
        [29, 25],
        [30, 24],
        [32, 25],
        [33, 24],
        [33, 23],
      ],
    ],
    [
      'paint',
      HOLE,
      [
        [31, 18],
        [30, 21],
      ],
    ],
    [
      'paint',
      '614f49',
      [
        [17, 35],
        [19, 34],
        [19, 35],
        [24, 39],
      ],
    ],
    [
      'paint',
      HOLE,
      [
        [18, 30],
        [39, 36],
      ],
    ],
    [
      'paint',
      '4c3f3b',
      [
        [38, 38],
        [40, 37],
        [40, 38],
        [45, 26],
        [43, 25],
      ],
    ],
    // Ragged banner hems, a bite out of the right tower's roof and the
    // outer walls' corners crumbled.
    [
      'paint',
      '4c3f3b',
      [
        [29, 23],
        [29, 24],
        [31, 25],
        [31, 24],
        [33, 22],
        [32, 24],
      ],
    ],
    [
      'paint',
      '614f49',
      [
        [17, 34],
        [17, 33],
        [18, 35],
        [19, 33],
        [24, 38],
        [23, 39],
        [25, 39],
      ],
    ],
    [
      'cut',
      [
        [46, 15],
        [50, 15],
        [50, 21],
      ],
    ],
    [
      'cut',
      [
        [4, 36],
        [11, 36],
        [4, 43],
      ],
    ],
    [
      'cut',
      [
        [55, 35],
        [61, 35],
        [61, 42],
      ],
    ],
    // Holes in the tower roofs, and cracks in the keep.
    [
      'paint',
      HOLE,
      [
        [45, 18],
        [46, 18],
        [45, 19],
        [46, 19],
        [47, 19],
      ],
    ],
    [
      'paint',
      HOLE,
      [
        [17, 20],
        [18, 20],
        [18, 21],
        [19, 21],
      ],
    ],
    [
      'line',
      OUTLINE,
      [
        [30, 27],
        [31, 29],
        [30, 31],
      ],
    ],
    [
      'line',
      OUTLINE,
      [
        [9, 37],
        [10, 39],
        [9, 41],
      ],
    ],
    // Stones fallen at its foot.
    ...rubble(14, 45),
    ...rubble(44, 46),
    ...rubble(51, 44),
  ],
};

const rgbOf = (hex) => [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));

// The pixels of a 1px line through `path`'s corners.
function linePoints(path) {
  const points = [];
  for (let i = 1; i < path.length; i++) {
    const [[x0, y0], [x1, y1]] = [path[i - 1], path[i]];
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let t = 0; t <= steps; t++) {
      points.push([Math.round(x0 + ((x1 - x0) * t) / steps), Math.round(y0 + ((y1 - y0) * t) / steps)]);
    }
  }
  return points;
}

// The pixels inside triangle `[a, b, c]`.
function trianglePoints([a, b, c]) {
  const side = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const points = [];
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const signs = [side(a, b, [x, y]), side(b, c, [x, y]), side(c, a, [x, y])];
      if (signs.every((v) => v >= 0) || signs.every((v) => v <= 0)) points.push([x, y]);
    }
  }
  return points;
}

// Paints `steps` (see UNDERWORLD_DAMAGE) over `rows`, in place.
function applyDamage(rows, steps) {
  const set = (points, px, opaqueOnly = false) => {
    for (const [x, y] of points) if (!opaqueOnly || rows[y][x][3] > 0) rows[y][x] = px;
  };
  for (const step of steps) {
    if (step[0] === 'erase') set(step[1], [0, 0, 0, 0]);
    else if (step[0] === 'paint') set(step[2], [...rgbOf(step[1]), 255]);
    else if (step[0] === 'line') set(linePoints(step[2]), [...rgbOf(step[1]), 255], true);
    else if (step[0] === 'fill') set(trianglePoints(step[2]), [...rgbOf(step[1]), 255], true);
    else if (step[0] === 'cut') {
      const cut = trianglePoints(step[1]).filter(([x, y]) => rows[y][x][3] > 0);
      set(cut, [0, 0, 0, 0]);
      const edge = cut.flatMap(([x, y]) =>
        [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1],
        ].filter(([nx, ny]) => rows[ny]?.[nx]?.[3] > 0),
      );
      set(edge, [...rgbOf(OUTLINE), 255]);
    }
  }
}

const config = SEASONS[season];
if (!config) throw new Error(`Usage: recolor-sites.js <${Object.keys(SEASONS).join('|')}>`);

const outDir = path.join(SOURCE, season);
fs.mkdirSync(outDir, { recursive: true });
for (const file of fs.readdirSync(SOURCE).filter((name) => name.endsWith('.png'))) {
  const rows = decode(path.join(SOURCE, file)).map((row) =>
    row.map((px) => {
      if (px[3] === 0) return px;
      const hsl = toHsl(px);
      const remap = isGrass(hsl) ? config.grass : isEarth(hsl) ? config.earth : undefined;
      return remap ? [...toRgb(remap(hsl)), px[3]] : px;
    }),
  );
  const damage = config.damage?.()[file.slice(0, -'.png'.length)];
  if (damage) applyDamage(rows, damage);
  encode(path.join(outDir, file), rows);
}
console.log(`${SOURCE}/*.png -> ${outDir}/`);
