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

  it('never overlaps two decals', () => {
    for (const seed of SEEDS) {
      const decals = layOutKit(KIT, FLOOR, seed).pieces.filter((d) => d.layer === 'decal');
      decals.forEach((a, i) =>
        decals.slice(i + 1).forEach((b) => {
          const apart = a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
          expect(apart).toBe(true);
        }),
      );
    }
  });

  it('gathers decals beside each standing thing’s foot, clear of its body and of everything else', () => {
    const standing = [
      { art: { x: 100, y: 100, width: 64, height: 64 }, foot: { x: 132, y: 158 } },
      { art: { x: 400, y: 250, width: 64, height: 64 }, foot: { x: 432, y: 308 } },
    ];
    const near = (p: { x: number; y: number; width: number; height: number }, foot: { x: number; y: number }) =>
      Math.abs(p.y + p.height - foot.y) <= 16 &&
      Math.min(Math.abs(p.x - foot.x), Math.abs(p.x + p.width - foot.x)) <= 40;
    for (const seed of SEEDS) {
      const decals = layOutKit(KIT, FLOOR, seed, standing).pieces.filter((d) => d.layer === 'decal');
      for (const { art, foot } of standing) {
        const gathered = decals.filter((p) => near(p, foot));
        expect(gathered.length).toBeGreaterThanOrEqual(1);
        for (const p of decals) {
          const apart =
            p.x + p.width <= art.x || art.x + art.width <= p.x || p.y + p.height <= art.y || art.y + art.height <= p.y;
          if (apart) continue;
          // Only its own cluster may share its rectangle, beside the body.
          expect(near(p, foot)).toBe(true);
          expect(p.x + p.width <= foot.x - 18 + 1e-9 || p.x >= foot.x + 18 - 1e-9).toBe(true);
        }
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

  it('draws no foreground for a kit without one', () => {
    const { foreground: _, ...bare } = KIT;
    for (const seed of SEEDS) {
      const { pieces } = layOutKit(bare, FLOOR, seed);
      expect(pieces.some((p) => p.layer === 'foreground')).toBe(false);
    }
  });

  it('mirrors the left trees on the right, unless the kit has its own right-side trees', () => {
    const own = { ...KIT, treesRight: [piece('trees-right', 700, 1000)] };
    for (const seed of SEEDS) {
      const trees = (kit: BattlefieldKit) =>
        layOutKit(kit, FLOOR, seed).pieces.filter((p) => p.key.startsWith('trees'));
      const mirrored = trees(KIT);
      expect(mirrored.filter((p) => p.x >= FLOOR.width / 2).every((p) => p.flip && p.key === 'trees')).toBe(true);
      expect(mirrored.filter((p) => p.x < FLOOR.width / 2).every((p) => !p.flip)).toBe(true);
      const right = trees(own).filter((p) => p.x >= FLOOR.width / 2);
      expect(right.length).toBeGreaterThan(0);
      expect(right.every((p) => !p.flip && p.key === 'trees-right')).toBe(true);
      expect(
        trees(own)
          .filter((p) => p.x < FLOOR.width / 2)
          .every((p) => p.key === 'trees'),
      ).toBe(true);
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
