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
  },
};

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
  encode(path.join(outDir, file), rows);
}
console.log(`${SOURCE}/*.png -> ${outDir}/`);
