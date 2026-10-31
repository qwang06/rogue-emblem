// The side view's backdrop: a sky and layers of far scenery behind the
// arena, standing above its back edge, in the colors of the region's biome.
// Drawn in code until there's painted backdrop art: each layer is a
// silhouette, its height at each column picked from a seeded Rng, so a
// battle's backdrop is the same every time it's drawn. Pure.

import type { BattlefieldKind } from './battlefields.ts';
import type { Grid } from './grid.ts';
import { createSeededRng } from './rng.ts';
import { CELL } from './tileset.ts';
import type { RegionBiome } from './warband/realm/realmRegions.ts';

// How tall the backdrop stands above the arena's back edge, in world
// pixels: three floor rows, room for the top row's heads and some sky.
export const BACKDROP_HEIGHT = 3 * CELL.height;

// A silhouette's outline: rolling `hills`, jagged `peaks`, a spiky
// `treeline`, or a crenellated `wall`.
export type BackdropShape = 'hills' | 'peaks' | 'treeline' | 'wall';

export interface BackdropLayer {
  shape: BackdropShape;
  color: number;
  // The silhouette's lowest and highest points, as fractions of the
  // backdrop's height above its foot.
  low: number;
  high: number;
}

export interface BackdropStyle {
  // The sky's color bands, top to bottom.
  sky: readonly number[];
  // Silhouettes from farthest to nearest, each drawn over the last.
  layers: readonly BackdropLayer[];
}

export type BackdropBiome = RegionBiome | 'default';

export const BACKDROP_STYLES: Readonly<Record<BackdropBiome, BackdropStyle>> = Object.freeze({
  default: {
    sky: [0x5b8fc7, 0x76a6d4, 0x93bcdf, 0xb4d3e8],
    layers: [
      { shape: 'hills', color: 0x8aa6b8, low: 0.35, high: 0.6 },
      { shape: 'hills', color: 0x5f8a5c, low: 0.15, high: 0.35 },
    ],
  },
  meadow: {
    sky: [0x5b8fc7, 0x76a6d4, 0x93bcdf, 0xb4d3e8],
    layers: [
      { shape: 'hills', color: 0x8aa6b8, low: 0.35, high: 0.6 },
      { shape: 'hills', color: 0x6f9a52, low: 0.15, high: 0.35 },
      { shape: 'treeline', color: 0x3f6b3c, low: 0.05, high: 0.18 },
    ],
  },
  lake: {
    sky: [0x6a9fd0, 0x86b4dc, 0xa3c8e4, 0xc3dcec],
    layers: [
      { shape: 'peaks', color: 0x9db0c4, low: 0.4, high: 0.75 },
      { shape: 'hills', color: 0x6b8fa8, low: 0.12, high: 0.25 },
      { shape: 'treeline', color: 0x3d6650, low: 0.04, high: 0.14 },
    ],
  },
  forest: {
    sky: [0x4f7aa8, 0x6690b8, 0x7fa6c4, 0x9cbccf],
    layers: [
      { shape: 'treeline', color: 0x56786a, low: 0.45, high: 0.7 },
      { shape: 'treeline', color: 0x36583f, low: 0.25, high: 0.5 },
      { shape: 'treeline', color: 0x23402c, low: 0.08, high: 0.3 },
    ],
  },
  hills: {
    sky: [0x7d8fb0, 0x98a8c2, 0xb6c1d2, 0xd2d6dc],
    layers: [
      { shape: 'peaks', color: 0x8e95a8, low: 0.5, high: 0.9 },
      { shape: 'peaks', color: 0x6c6f80, low: 0.25, high: 0.55 },
      { shape: 'hills', color: 0x6f7f4c, low: 0.06, high: 0.2 },
    ],
  },
  fort: {
    sky: [0x6b5a7e, 0x8a6f86, 0xb08a86, 0xd1aa8a],
    layers: [
      { shape: 'hills', color: 0x7a6f80, low: 0.3, high: 0.5 },
      { shape: 'wall', color: 0x5a5560, low: 0.3, high: 0.42 },
      { shape: 'hills', color: 0x4f5a3c, low: 0.04, high: 0.12 },
    ],
  },
});

// The style for a level's biome (the default when it has none).
export function getBackdropStyle(biome: RegionBiome | undefined): BackdropStyle {
  return BACKDROP_STYLES[biome ?? 'default'];
}

// How wide each column of a silhouette is, in world pixels: the backdrop's
// pixel size, so it reads as chunky pixel art beside 64px tiles.
export const BACKDROP_COLUMN = 4;

// How tall a silhouette `layer` is at each BACKDROP_COLUMN-wide column of a
// backdrop `width` x `height` world pixels: whole world pixels above its
// foot, between layer.low and layer.high of `height` (rounded). Seeded by `seed`, so
// the same backdrop always comes out the same.
export function getSilhouette(layer: BackdropLayer, width: number, height: number, seed: number): number[] {
  const rng = createSeededRng(seed);
  const columns = Math.ceil(width / BACKDROP_COLUMN);
  const low = layer.low * height;
  const span = (layer.high - layer.low) * height;
  const heights: number[] = [];
  switch (layer.shape) {
    case 'hills': {
      // A sum of two slow waves with random phases and lengths.
      const waves = [0, 1].map((i) => ({
        length: (12 + rng() * 16) * (i + 1),
        phase: rng() * Math.PI * 2,
      }));
      for (let c = 0; c < columns; c++) {
        const t = waves.reduce((sum, w) => sum + Math.sin((c / w.length) * Math.PI * 2 + w.phase), 0) / 2;
        heights.push(low + span * (t + 1) * 0.5);
      }
      break;
    }
    case 'peaks': {
      // Straight slopes between peaks and saddles every few columns.
      let c = 0;
      let at = low + span * rng();
      while (c < columns) {
        const run = 4 + Math.floor(rng() * 8);
        const to = low + span * (heights.length % 2 === 0 ? 0.5 + rng() * 0.5 : rng() * 0.4);
        for (let i = 0; i < run && c < columns; i++, c++) heights.push(at + ((to - at) * (i + 1)) / run);
        at = to;
      }
      break;
    }
    case 'treeline': {
      // A canopy that wanders, with a pointed crown every few columns.
      let canopy = low + span * 0.5;
      for (let c = 0; c < columns; c++) {
        canopy = Math.min(low + span * 0.8, Math.max(low, canopy + (rng() - 0.5) * span * 0.25));
        const crown = c % 3 === 1 ? span * (0.15 + rng() * 0.15) : 0;
        heights.push(canopy + crown);
      }
      break;
    }
    case 'wall': {
      // A level wall with merlons two columns wide, two columns apart.
      for (let c = 0; c < columns; c++) heights.push(low + (c % 4 < 2 ? span : span * 0.6));
      break;
    }
  }
  return heights.map((h) => Math.round(Math.min(Math.max(h, low), low + span)));
}

// A seed for a map's backdrop from its terrain, so the same map always
// gets the same skyline and different maps usually differ.
export function getBackdropSeed(grid: Grid): number {
  let hash = 2166136261;
  for (const { terrain } of grid.cells) {
    for (const char of terrain ?? '-') hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  }
  return hash >>> 0;
}

// A battlefield's floor, drawn in code until there's painted art: a base
// color flecked with a few others, each covering about `share` of the
// floor's BACKDROP_COLUMN-sized pixels.
export interface FloorStyle {
  base: number;
  flecks: readonly { color: number; share: number }[];
}

export interface BattlefieldLook {
  floor: FloorStyle;
  backdrop: BackdropStyle;
}

export const BATTLEFIELD_LOOKS: Readonly<Record<BattlefieldKind, BattlefieldLook>> = Object.freeze({
  plains: {
    floor: {
      base: 0x7aa04a,
      flecks: [
        { color: 0x8db556, share: 0.18 },
        { color: 0x6a8f40, share: 0.14 },
        { color: 0xa3c266, share: 0.04 },
      ],
    },
    backdrop: BACKDROP_STYLES.meadow,
  },
  forest: {
    floor: {
      base: 0x4f7a3a,
      flecks: [
        { color: 0x5f8a44, share: 0.16 },
        { color: 0x426630, share: 0.16 },
        { color: 0x6b5a3a, share: 0.05 },
      ],
    },
    backdrop: BACKDROP_STYLES.forest,
  },
  desert: {
    floor: {
      base: 0xd8b878,
      flecks: [
        { color: 0xe4c88a, share: 0.18 },
        { color: 0xc4a264, share: 0.14 },
        { color: 0xa88a58, share: 0.04 },
      ],
    },
    backdrop: {
      sky: [0x6aa0d0, 0x8cb8dc, 0xb4d0e0, 0xe0dcc8],
      layers: [
        { shape: 'peaks', color: 0xc9a98a, low: 0.3, high: 0.6 },
        { shape: 'hills', color: 0xd4b07a, low: 0.08, high: 0.25 },
      ],
    },
  },
});

// The flecks of a `width` x `height` floor in `style`: one entry per
// BACKDROP_COLUMN-sized pixel that isn't the base color, its top-left
// corner in world pixels and its color. Seeded, so a battle's floor is the
// same every time it's drawn.
export function getFloorFlecks(
  style: FloorStyle,
  width: number,
  height: number,
  seed: number,
): { x: number; y: number; color: number }[] {
  const rng = createSeededRng(seed);
  const flecks: { x: number; y: number; color: number }[] = [];
  for (let y = 0; y < height; y += BACKDROP_COLUMN) {
    for (let x = 0; x < width; x += BACKDROP_COLUMN) {
      let roll = rng();
      for (const { color, share } of style.flecks) {
        if (roll < share) {
          flecks.push({ x, y, color });
          break;
        }
        roll -= share;
      }
    }
  }
  return flecks;
}

// A painted battlefield: its size in its own pixels, and the row its floor
// starts at (the foot of its far scenery).
export interface Painting {
  size: readonly [number, number];
  horizon: number;
}

// A rectangle of the world, in world pixels.
export interface WorldRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Where to draw `painting` behind a floor `floorWidth` wide, in world
// pixels, so its horizon sits on the floor's back edge (y 0) without
// stretching it: scaled up just enough to span the floor and to stand at
// least BACKDROP_HEIGHT above it, and centered across it (an overhang
// either side, and any floor below the arena's front edge, is cropped by
// the camera or left showing past it). Given the camera's `view`, it's
// scaled up further to cover all of it, so the painting runs to the
// screen's edges instead of floating in the page.
export function getPaintingPlacement(painting: Painting, floorWidth: number, view?: WorldRect): WorldRect {
  const [w, h] = painting.size;
  let scale = Math.max(floorWidth / w, BACKDROP_HEIGHT / painting.horizon);
  if (view) {
    // Centered on the floor, so it must reach the view's farther side.
    const halfWidth = Math.max(floorWidth / 2 - view.x, view.x + view.width - floorWidth / 2);
    scale = Math.max(
      scale,
      (2 * halfWidth) / w,
      -view.y / painting.horizon,
      (view.y + view.height) / (h - painting.horizon),
    );
  }
  return { x: (floorWidth - w * scale) / 2, y: -painting.horizon * scale, width: w * scale, height: h * scale };
}
