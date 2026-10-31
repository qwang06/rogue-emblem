import { describe, expect, it } from 'vitest';
import {
  BLOB,
  FOREGROUND_REACH,
  getKitScene,
  getPatchMask,
  HAZE,
  KIT_MARGIN,
  layOutKit,
  type BattlefieldKit,
  type KitPiece,
} from './battlefieldKit.ts';

const piece = (key: string, width: number, height: number): KitPiece => ({ key, size: [width, height] });
const KIT: BattlefieldKit = {
  scale: 0.373,
  ground: piece('ground', 800, 800),
  horizon: piece('horizon', 3840, 647),
  patches: [
    { texture: piece('dry', 800, 800), every: 150000, width: [300, 600] },
    { texture: piece('dirt', 800, 800), every: 250000, width: [200, 400] },
  ],
  decals: [piece('tuft', 164, 150), piece('pebbles', 198, 122)],
  trees: [piece('trees', 950, 1535)],
  bushes: [piece('bush', 416, 305)],
  foreground: { left: piece('leaves', 822, 891), right: piece('fern', 905, 921) },
  light: 0xffffff,
  shade: 0x000000,
  haze: 0xffffff,
};
const FLOOR = { width: 896, height: 400 };
const SEEDS = Array.from({ length: 20 }, (_, i) => i * 7919 + 1);

describe('getKitScene', () => {
  it('runs KIT_MARGIN past the floor’s sides and front, and up over the horizon', () => {
    expect(getKitScene(FLOOR, 240)).toEqual({
      x: -KIT_MARGIN.side,
      y: -300,
      width: 896 + 2 * KIT_MARGIN.side,
      height: 300 + 400 + KIT_MARGIN.bottom,
    });
  });
});

describe('layOutKit', () => {
  it('is the same from the same seed, and differs between seeds', () => {
    expect(layOutKit(KIT, FLOOR, 5)).toEqual(layOutKit(KIT, FLOOR, 5));
    expect(layOutKit(KIT, FLOOR, 5).pieces).not.toEqual(layOutKit(KIT, FLOOR, 6).pieces);
  });

  it('lays the ground under the whole floor and the horizon across the scene above it', () => {
    for (const seed of SEEDS) {
      const { scene, pieces } = layOutKit(KIT, FLOOR, seed);
      const [ground] = pieces.filter((p) => p.layer === 'ground');
      expect(ground.key).toBe('ground');
      expect(ground.x).toBe(scene.x);
      expect(ground.width).toBe(scene.width);
      expect(ground.y).toBeLessThan(0);
      expect(ground.y + ground.height).toBe(scene.y + scene.height);
      const [horizon] = pieces.filter((p) => p.layer === 'horizon');
      expect(horizon.width).toBe(scene.width);
      expect(horizon.y + horizon.height).toBeLessThan(0);
      expect(horizon.y).toBe(scene.y);
    }
  });

  it('uses only the kit’s pieces and the generated washes, and keeps decals in the scene', () => {
    const keys = new Set([
      'ground',
      'horizon',
      'tuft',
      'pebbles',
      'trees',
      'bush',
      'leaves',
      'fern',
      'dry',
      'dirt',
      BLOB,
      HAZE,
    ]);
    for (const seed of SEEDS) {
      const { scene, pieces } = layOutKit(KIT, FLOOR, seed);
      for (const p of pieces) expect(keys.has(p.key)).toBe(true);
      for (const p of pieces.filter((d) => d.layer === 'decal')) {
        expect(p.x).toBeGreaterThanOrEqual(scene.x);
        expect(p.x + p.width).toBeLessThanOrEqual(scene.x + scene.width + 1e-9);
        expect(p.y + p.height).toBeLessThanOrEqual(scene.y + scene.height + 1e-9);
      }
    }
  });

  it('lays patches of each other ground texture, each with its own outline, over the ground', () => {
    for (const seed of SEEDS) {
      const { scene, pieces } = layOutKit(KIT, FLOOR, seed);
      const [ground] = pieces.filter((p) => p.layer === 'ground');
      const patches = pieces.filter((p) => p.layer === 'patch');
      expect(patches.some((p) => p.key === 'dry')).toBe(true);
      expect(patches.some((p) => p.key === 'dirt')).toBe(true);
      expect(new Set(patches.map((p) => p.shape)).size).toBe(patches.length);
      for (const p of patches) {
        expect(p.x + p.width).toBeGreaterThan(scene.x);
        expect(p.x).toBeLessThan(scene.x + scene.width);
        expect(p.y).toBeGreaterThanOrEqual(ground.y);
        expect(p.y).toBeLessThan(ground.y + ground.height);
      }
    }
  });

  it('stands border pieces off the floor’s sides, and front ones below its front row', () => {
    for (const seed of SEEDS) {
      for (const p of layOutKit(KIT, FLOOR, seed).pieces.filter((s) => s.layer === 'standing')) {
        expect(p.foot).toBeCloseTo(p.y + p.height);
        const beside = p.x + p.width <= 8 + 1e-9 || p.x >= FLOOR.width - 8 - 1e-9;
        const infront = p.y >= FLOOR.height;
        expect(beside || infront).toBe(true);
      }
    }
  });

  it('tucks the foreground into the bottom corners, reaching only a little over the floor', () => {
    for (const seed of SEEDS) {
      const { scene, pieces } = layOutKit(KIT, FLOOR, seed);
      const [left, right] = pieces.filter((p) => p.layer === 'foreground');
      expect(left.key).toBe('leaves');
      expect(right.key).toBe('fern');
      expect(left.x + left.width).toBeLessThanOrEqual(left.width * FOREGROUND_REACH + 1e-9);
      expect(right.x).toBeGreaterThanOrEqual(FLOOR.width - right.width * FOREGROUND_REACH - 1e-9);
      for (const p of [left, right]) expect(p.y + p.height).toBeGreaterThan(scene.y + scene.height);
    }
  });
});

describe('getPatchMask', () => {
  it('is the same from the same shape, and differs between shapes', () => {
    expect(getPatchMask(3, 32, 16)).toEqual(getPatchMask(3, 32, 16));
    expect(getPatchMask(3, 32, 16)).not.toEqual(getPatchMask(4, 32, 16));
  });

  it('is solid somewhere in the middle and clear all around its edge', () => {
    for (const shape of SEEDS) {
      const [cols, rows] = [32, 16];
      const mask = getPatchMask(shape, cols, rows);
      expect(mask).toHaveLength(cols * rows);
      for (const a of mask) {
        expect(a).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThanOrEqual(1);
      }
      expect(Math.max(...mask)).toBeGreaterThan(0.9);
      for (let col = 0; col < cols; col++) {
        expect(mask[col]).toBeLessThan(0.05);
        expect(mask[(rows - 1) * cols + col]).toBeLessThan(0.05);
      }
      for (let row = 0; row < rows; row++) {
        expect(mask[row * cols]).toBeLessThan(0.05);
        expect(mask[row * cols + cols - 1]).toBeLessThan(0.05);
      }
    }
  });
});
