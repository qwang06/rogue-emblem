// Paints a realm's parchment map (realmInk.ts) into an RGBA pixel buffer:
// mottled parchment, lakes as a darker wash with a thick ink coast and a
// faint red line offset outside it (as on the Tactics Ogre map), roads as
// pale lines edged in ink, then the map symbols back to front. The
// overworld screen puts the buffer on a canvas; the realm preview script
// writes it to a PNG. Pure: no DOM, the same inputs give the same pixels.

import { TILE_SIZE } from '../../tileset.ts';
import { createSeededRng } from '../../rng.ts';
import { createValueNoise } from './realmTerrain.ts';
import { hashCell, type InkStamp, type RealmInk } from './realmInk.ts';

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

// Pixel distances from the coast: the ink line's width, where the red line
// outside it runs, and how far in the water darkens.
const COAST_INK = 2;
const COAST_RED = [5, 6] as const;
const DEEP_FROM = 10;
// A road's half-widths: its ink edge, and the pale fill inside.
const ROAD_EDGE = 3;
const ROAD_FILL = 1.6;

export function paintRealmInk(ink: RealmInk, seed: number, stamps: Readonly<Record<InkStamp, RgbaImage>>): RgbaImage {
  const { width, height } = ink;
  const data = new Uint8ClampedArray(width * height * 4);
  const image = { width, height, data };
  paintParchment(image, seed);
  paintWater(image, ink, seed);
  for (const road of ink.roads) paintLine(image, road.line, ROAD_EDGE, INK_COLORS.roadEdge);
  for (const road of ink.roads) paintLine(image, road.line, ROAD_FILL, INK_COLORS.road);
  for (const { stamp, x, y } of ink.placements) blit(image, stamps[stamp], x, y);
  return image;
}

// Parchment: two shades blended by soft noise, with a little grain.
function paintParchment(image: RgbaImage, seed: number): void {
  const { width, height, data } = image;
  const rng = createSeededRng((seed ^ 0x70617065) >>> 0);
  const broad = createValueNoise(width, height, 160, rng);
  const fine = createValueNoise(width, height, 36, rng);
  const { paperLight: light, paperDark: dark } = INK_COLORS;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = clamp01((broad(x, y) * 0.7 + fine(x, y) * 0.3 - 0.25) * 1.6);
      const grain = (hashCell(seed, x, y, 7) - 0.5) * 8;
      const i = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) data[i + c] = light[c] + (dark[c] - light[c]) * t + grain;
      data[i + 3] = 255;
    }
  }
}

// Lakes: the water cells' mask, blended between cell centers and roughened
// with noise so coasts curve, then colored by distance from the coast.
function paintWater(image: RgbaImage, ink: RealmInk, seed: number): void {
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
        mix(data, i, INK_COLORS.water, 0.85);
        mix(data, i, INK_COLORS.waterDeep, deep * 0.8);
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

// A line along `points`, `radius` pixels either side of it, in `color`.
function paintLine(image: RgbaImage, points: readonly { x: number; y: number }[], radius: number, color: Rgb): void {
  const r = Math.ceil(radius);
  const dot = (cx: number, cy: number) => {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const x = Math.round(cx) + dx;
        const y = Math.round(cy) + dy;
        if (x < 0 || y < 0 || x >= image.width || y >= image.height) continue;
        setRgb(image.data, (y * image.width + x) * 4, color);
      }
    }
  };
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 2));
    for (let s = 0; s <= steps; s++) dot(a.x + ((b.x - a.x) * s) / steps, a.y + ((b.y - a.y) * s) / steps);
  }
  if (points.length === 1) dot(points[0].x, points[0].y);
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
