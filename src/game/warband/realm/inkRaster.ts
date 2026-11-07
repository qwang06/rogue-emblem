// Paints a realm's parchment map (realmInk.ts) into an RGBA pixel buffer:
// mottled parchment in the paper of each season's band (blended where
// they meet along a ragged edge), a faint graticule, lakes as a darker
// wash with a thick ink coast and a faint red line offset outside it (as
// on the Tactics Ogre map), rivers as thin water lines edged in ink
// widening to their mouths, roads as pale lines edged in ink, the map
// symbols back to front, over a double ink border inside the edge. The
// overworld screen puts the buffer on a canvas; the realm preview script
// writes it to a PNG. Pure: no DOM, the same inputs give the same pixels.

import { TILE_SIZE, type Season } from '../../tileset.ts';
import { createSeededRng } from '../../rng.ts';
import { createValueNoise } from './realmTerrain.ts';
import { hashCell, type InkBand, type InkStamp, type RealmInk } from './realmInk.ts';

export interface RgbaImage {
  width: number;
  height: number;
  // Row by row, 4 bytes a pixel.
  data: Uint8ClampedArray;
}

type Rgb = readonly [number, number, number];

// The map's colors.
export const INK_COLORS = Object.freeze({
  paperLight: [236, 220, 178] as Rgb,
  paperDark: [214, 186, 136] as Rgb,
  water: [178, 170, 138] as Rgb,
  waterDeep: [152, 146, 120] as Rgb,
  ink: [74, 48, 26] as Rgb,
  coastRed: [176, 84, 56] as Rgb,
  road: [244, 232, 200] as Rgb,
  roadEdge: [92, 62, 34] as Rgb,
});

// The paper and water of each season's stretch of the map.
export interface SeasonPaper {
  light: Rgb;
  dark: Rgb;
  water: Rgb;
  waterDeep: Rgb;
}

const SUMMER_PAPER: SeasonPaper = {
  light: INK_COLORS.paperLight,
  dark: INK_COLORS.paperDark,
  water: INK_COLORS.water,
  waterDeep: INK_COLORS.waterDeep,
};

export const SEASON_PAPER: Readonly<Record<Season, SeasonPaper>> = Object.freeze({
  summer: SUMMER_PAPER,
  // Warmer, a little redder paper.
  autumn: { light: [238, 212, 162], dark: [212, 168, 112], water: [182, 166, 130], waterDeep: [154, 140, 110] },
  // Pale, cool paper, like frost on the page.
  winter: { light: [241, 237, 226], dark: [212, 208, 194], water: [184, 188, 182], waterDeep: [158, 164, 160] },
  // Scorched paper, dark water.
  underworld: { light: [206, 170, 130], dark: [160, 118, 82], water: [138, 120, 100], waterDeep: [108, 94, 80] },
  starship: SUMMER_PAPER,
});

// How the seasons' bands meet: the edge wanders this many tiles either
// way, and the papers blend over this many tiles across it.
const BAND_RAGGED = 2;
const BAND_BLEND = 1.5;
// The graticule: a hairline every this many tiles, mixed this faintly.
const GRATICULE = { columns: 8, rows: 6, ink: 0.13 };
// The border: a thick line this far in from the edge, a thin one further in.
const BORDER = { outer: 6, outerWidth: 2, inner: 12, innerWidth: 1 };
// A river's half-widths at its source and its mouth: the ink edge, and
// the water inside.
const RIVER_EDGE = [2.1, 2.9] as const;
const RIVER_FILL = [0.9, 1.6] as const;

// Pixel distances from the coast: the ink line's width, where the red line
// outside it runs, and how far in the water darkens.
const COAST_INK = 2;
const COAST_RED = [5, 6] as const;
const DEEP_FROM = 10;
// A road's half-widths: its ink edge, and the pale fill inside.
const ROAD_EDGE = 3;
const ROAD_FILL = 1.6;

let lastPainted: {
  ink: RealmInk;
  seed: number;
  stamps: Readonly<Record<InkStamp, RgbaImage>>;
  image: RgbaImage;
} | null = null;

export function paintRealmInk(ink: RealmInk, seed: number, stamps: Readonly<Record<InkStamp, RgbaImage>>): RgbaImage {
  if (lastPainted && lastPainted.ink === ink && lastPainted.seed === seed && lastPainted.stamps === stamps) {
    return lastPainted.image;
  }
  const { width, height } = ink;
  const data = new Uint8ClampedArray(width * height * 4);
  const image = { width, height, data };
  const paper = createPaper(ink.bands, width, height, seed);
  paintParchment(image, seed, paper);
  paintGraticule(image);
  paintWater(image, ink, seed, paper);
  for (const river of ink.rivers) paintRiver(image, river.line, paper);
  paintBorder(image);
  for (const road of ink.roads) paintLine(image, road.line, ROAD_EDGE, INK_COLORS.roadEdge);
  for (const road of ink.roads) paintLine(image, road.line, ROAD_FILL, INK_COLORS.road);
  for (const { stamp, x, y } of ink.placements) blit(image, stamps[stamp], x, y);
  lastPainted = { ink, seed, stamps, image };
  return image;
}

// The paper at any pixel: the season band's paper there, blended with the
// next band's over BAND_BLEND tiles across their edge, which noise makes
// wander so the seasons don't meet along a ruled line.
type Paper = (x: number, y: number, part: keyof SeasonPaper) => Rgb;

function createPaper(bands: readonly InkBand[], width: number, height: number, seed: number): Paper {
  const papers = bands.map((band) => SEASON_PAPER[band.season]);
  if (papers.length <= 1) {
    const only = papers[0] ?? SUMMER_PAPER;
    return (_x, _y, part) => only[part];
  }
  const ragged = createValueNoise(width, height, 96, createSeededRng((seed ^ 0x62616e64) >>> 0));
  const blended: [number, number, number][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  let slot = 0;
  return (x, y, part) => {
    const u = x / TILE_SIZE + (ragged(x, y) - 0.5) * 2 * BAND_RAGGED;
    let i = 0;
    while (i < bands.length - 1 && u >= bands[i].to) i++;
    // How far past the band's start and before its end, as blend weights
    // toward the bands either side.
    const toPrev = i > 0 ? clamp01(0.5 - (u - bands[i].from) / BAND_BLEND) : 0;
    const toNext = i < bands.length - 1 ? clamp01(0.5 - (bands[i].to - u) / BAND_BLEND) : 0;
    const own = papers[i][part];
    if (toPrev === 0 && toNext === 0) return own;
    const other = toPrev > 0 ? papers[i - 1][part] : papers[i + 1][part];
    const weight = toPrev > 0 ? toPrev : toNext;
    const out = blended[slot];
    slot = (slot + 1) % blended.length;
    for (let c = 0; c < 3; c++) out[c] = own[c] + (other[c] - own[c]) * weight;
    return out;
  };
}

// Parchment: two shades blended by soft noise, with a little grain.
function paintParchment(image: RgbaImage, seed: number, paper: Paper): void {
  const { width, height, data } = image;
  const rng = createSeededRng((seed ^ 0x70617065) >>> 0);
  const broad = createValueNoise(width, height, 160, rng);
  const fine = createValueNoise(width, height, 36, rng);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = clamp01((broad(x, y) * 0.7 + fine(x, y) * 0.3 - 0.25) * 1.6);
      const grain = (hashCell(seed, x, y, 7) - 0.5) * 8;
      const light = paper(x, y, 'light');
      const dark = paper(x, y, 'dark');
      const i = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) data[i + c] = light[c] + (dark[c] - light[c]) * t + grain;
      data[i + 3] = 255;
    }
  }
}

// Faint ruled lines across the paper, as a chart's graticule, under
// everything else.
function paintGraticule(image: RgbaImage): void {
  const { width, height, data } = image;
  for (let x = GRATICULE.columns * TILE_SIZE; x < width; x += GRATICULE.columns * TILE_SIZE)
    for (let y = 0; y < height; y++) mix(data, (y * width + x) * 4, INK_COLORS.ink, GRATICULE.ink);
  for (let y = GRATICULE.rows * TILE_SIZE; y < height; y += GRATICULE.rows * TILE_SIZE)
    for (let x = 0; x < width; x++) mix(data, (y * width + x) * 4, INK_COLORS.ink, GRATICULE.ink);
}

// A double ink line just inside the map's edge.
function paintBorder(image: RgbaImage): void {
  const { width, height, data } = image;
  const ring = (inset: number, lineWidth: number, amount: number) => {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const edge = Math.min(x, y, width - 1 - x, height - 1 - y);
        if (edge >= inset && edge < inset + lineWidth) mix(data, (y * width + x) * 4, INK_COLORS.ink, amount);
      }
    }
  };
  ring(BORDER.outer, BORDER.outerWidth, 0.9);
  ring(BORDER.inner, BORDER.innerWidth, 0.7);
}

// A river: an ink line with water inside, both widening from its source
// to its mouth.
function paintRiver(image: RgbaImage, line: readonly { x: number; y: number }[], paper: Paper): void {
  const widen = (from: number, to: number) => (t: number) => from + (to - from) * t;
  paintLine(image, line, widen(RIVER_EDGE[0], RIVER_EDGE[1]), INK_COLORS.ink);
  paintLine(image, line, widen(RIVER_FILL[0], RIVER_FILL[1]), (x, y) => paper(x, y, 'water'));
}

// Lakes: the water cells' mask, blended between cell centers and roughened
// with noise so coasts curve, then colored by distance from the coast.
function paintWater(image: RgbaImage, ink: RealmInk, seed: number, paper: Paper): void {
  const { width, height, data } = image;
  const columns = Math.round(width / TILE_SIZE);
  const rows = Math.round(height / TILE_SIZE);
  const rng = createSeededRng((seed ^ 0x77617465) >>> 0);
  const wobble = createValueNoise(width, height, 12, rng);
  const wetAt = (cx: number, cy: number) =>
    ink.water[Math.min(rows - 1, Math.max(0, cy)) * columns + Math.min(columns - 1, Math.max(0, cx))] ? 1 : 0;
  const wet = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const gy = y / TILE_SIZE - 0.5;
    const cy = Math.floor(gy);
    const ty = smooth(gy - cy);
    for (let x = 0; x < width; x++) {
      const gx = x / TILE_SIZE - 0.5;
      const cx = Math.floor(gx);
      const tx = smooth(gx - cx);
      const top = wetAt(cx, cy) * (1 - tx) + wetAt(cx + 1, cy) * tx;
      const bottom = wetAt(cx, cy + 1) * (1 - tx) + wetAt(cx + 1, cy + 1) * tx;
      const value = top * (1 - ty) + bottom * ty + (wobble(x, y) - 0.5) * 0.3;
      wet[y * width + x] = value > 0.5 ? 1 : 0;
    }
  }
  const distance = distanceToEdge(wet, width, height);
  for (let p = 0; p < wet.length; p++) {
    const d = distance[p];
    const i = p * 4;
    if (wet[p]) {
      if (d <= COAST_INK) setRgb(data, i, INK_COLORS.ink);
      else {
        const deep = clamp01((d - COAST_INK) / DEEP_FROM);
        const x = p % width;
        const y = (p - x) / width;
        mix(data, i, paper(x, y, 'water'), 0.85);
        mix(data, i, paper(x, y, 'waterDeep'), deep * 0.8);
      }
    } else if (d >= COAST_RED[0] && d <= COAST_RED[1]) mix(data, i, INK_COLORS.coastRed, 0.55);
  }
}

// Each pixel's distance (in 8-way steps) to the nearest pixel on the other
// side of the wet/dry edge, where the pixels touching the edge are 1.
function distanceToEdge(wet: Uint8Array, width: number, height: number): Uint16Array {
  const far = 0xffff;
  const distance = new Uint16Array(wet.length).fill(far);
  const queue = new Int32Array(wet.length);
  let tail = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      for (let dy = -1; dy <= 1 && distance[p] === far; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if (wet[ny * width + nx] !== wet[p]) {
            distance[p] = 1;
            queue[tail++] = p;
            break;
          }
        }
      }
    }
  }
  for (let head = 0; head < tail; head++) {
    const p = queue[head];
    const x = p % width;
    const y = (p - x) / width;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const n = ny * width + nx;
        if (distance[n] !== far || wet[n] !== wet[p]) continue;
        distance[n] = distance[p] + 1;
        queue[tail++] = n;
      }
    }
  }
  return distance;
}

// A line along `points`, `radius` pixels either side of it (a number, or
// a function of how far along the line, 0 to 1), in `color` (a color, or
// one per pixel).
function paintLine(
  image: RgbaImage,
  points: readonly { x: number; y: number }[],
  radius: number | ((t: number) => number),
  color: Rgb | ((x: number, y: number) => Rgb),
): void {
  const radiusAt = typeof radius === 'number' ? () => radius : radius;
  const colorAt = typeof color === 'function' ? color : () => color;
  const dot = (cx: number, cy: number, t: number) => {
    const size = radiusAt(t);
    const r = Math.ceil(size);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > size * size) continue;
        const x = Math.round(cx) + dx;
        const y = Math.round(cy) + dy;
        if (x < 0 || y < 0 || x >= image.width || y >= image.height) continue;
        setRgb(image.data, (y * image.width + x) * 4, colorAt(x, y));
      }
    }
  };
  let length = 0;
  for (let i = 0; i < points.length - 1; i++)
    length += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
  let walked = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const span = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(span * 2));
    for (let s = 0; s <= steps; s++) {
      const f = s / steps;
      dot(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, length > 0 ? (walked + span * f) / length : 0);
    }
    walked += span;
  }
  if (points.length === 1) dot(points[0].x, points[0].y, 0);
}

// `stamp` over the image with its top-left at (x, y), alpha blended.
function blit(image: RgbaImage, stamp: RgbaImage | undefined, x: number, y: number): void {
  if (!stamp) return;
  for (let sy = 0; sy < stamp.height; sy++) {
    const ty = y + sy;
    if (ty < 0 || ty >= image.height) continue;
    for (let sx = 0; sx < stamp.width; sx++) {
      const tx = x + sx;
      if (tx < 0 || tx >= image.width) continue;
      const s = (sy * stamp.width + sx) * 4;
      const alpha = stamp.data[s + 3] / 255;
      if (alpha === 0) continue;
      mix(image.data, (ty * image.width + tx) * 4, [stamp.data[s], stamp.data[s + 1], stamp.data[s + 2]], alpha);
    }
  }
}

function setRgb(data: Uint8ClampedArray, i: number, color: Rgb): void {
  data[i] = color[0];
  data[i + 1] = color[1];
  data[i + 2] = color[2];
}

function mix(data: Uint8ClampedArray, i: number, color: Rgb, amount: number): void {
  for (let c = 0; c < 3; c++) data[i + c] = data[i + c] + (color[c] - data[i + c]) * amount;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t));
}
