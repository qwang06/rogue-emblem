// A battlefield built from a kit of painted pieces instead of one painting
// (see src/assets/battlefieldKits.ts): a seamless ground texture tiled
// under everything, ragged patches of other ground textures (dry grass,
// bare dirt) over it, soft blotches of light and shade to break up its
// repeats, small decals (tufts, pebbles) scattered over it, a far-scenery
// strip along the top, tree clusters and bushes standing around the
// field's edges, and big out-of-focus foreground leaves in the near
// corners. Each battle lays the pieces out afresh from its seed, at any
// field size. Pure: the same kit, floor and seed always give the same
// layout.

import type { WorldRect } from './backdrop.ts';
import type { Rng } from './combatStats.ts';
import { createSeededRng } from './rng.ts';

// One piece of art: its texture key and its size in its own pixels.
export interface KitPiece {
  key: string;
  size: readonly [number, number];
}

// Another seamless ground texture, laid over the ground in soft-edged
// patches: about one per `every` square world pixels of ground, each
// `width` (world pixels, low to high) across and about half as deep.
export interface KitPatch {
  texture: KitPiece;
  every: number;
  width: readonly [number, number];
}

export interface BattlefieldKit {
  // World pixels per art pixel: how big the kit's art is drawn.
  scale: number;
  // Seamless; tiled over the whole scene.
  ground: KitPiece;
  // The far scenery, its bottom edge fading out over the ground.
  horizon: KitPiece;
  patches: readonly KitPatch[];
  decals: readonly KitPiece[];
  // Tall clusters standing down the field's sides, drawn as they are on
  // the left and mirrored on the right.
  trees: readonly KitPiece[];
  bushes: readonly KitPiece[];
  // Rising from the near corners, close to the camera.
  foreground: { left: KitPiece; right: KitPiece };
  // The blotches' colors: sunlit patches and shade.
  light: number;
  shade: number;
  // The haze over the far ground, under the horizon.
  haze: number;
}

// Which layer a piece is drawn in: the tiled ground, patches of other
// ground textures over it, washes over it
// (blotches, haze), decals lying on it, the horizon, things standing on it
// (sorted with the units by `foot`), and the foreground over everything.
export type KitLayer = 'ground' | 'patch' | 'wash' | 'decal' | 'horizon' | 'standing' | 'foreground';

export interface KitPlacement {
  layer: KitLayer;
  // A KitPiece's key, or BLOB / HAZE for the generated washes.
  key: string;
  // Top-left corner and size, in world pixels.
  x: number;
  y: number;
  width: number;
  height: number;
  flip: boolean;
  alpha: number;
  tint?: number;
  // Where a standing piece meets the ground (world y), to sort it by.
  foot?: number;
  // A patch's outline, as the seed getPatchMask draws it from.
  shape?: number;
}

// The generated washes' keys: a soft round blob, and a gradient fading
// downward.
export const BLOB = 'kit-blob';
export const HAZE = 'kit-haze';

// How far the scenery runs past the floor's sides and front (world
// pixels): room for the border trees and the foreground.
export const KIT_MARGIN = Object.freeze({ side: 280, bottom: 200 });
// How far above the floor's back edge the horizon's foot sits: a strip of
// far ground between it and the top row.
const HORIZON_GAP = 60;
// How far into the floor a border piece may reach, in world pixels.
const BORDER_OVERLAP = 8;
// How much of a foreground piece's width may hang over the floor (its
// art leaves that corner mostly empty).
export const FOREGROUND_REACH = 0.1;

const between = (rng: Rng, low: number, high: number) => low + rng() * (high - low);
const pick = <T>(rng: Rng, items: readonly T[]) => items[Math.floor(rng() * items.length)];

// The rectangle the scenery covers around a floor `floor` (its top-left
// at the world's origin): KIT_MARGIN past its sides and front, and up to
// the top of a horizon `horizonHeight` tall standing HORIZON_GAP above it.
export function getKitScene(floor: { width: number; height: number }, horizonHeight: number): WorldRect {
  const top = HORIZON_GAP + horizonHeight;
  return {
    x: -KIT_MARGIN.side,
    y: -top,
    width: floor.width + 2 * KIT_MARGIN.side,
    height: top + floor.height + KIT_MARGIN.bottom,
  };
}

// Lays `kit` out around a floor `floor` from `seed`: the scene it covers
// and every piece in it.
export function layOutKit(
  kit: BattlefieldKit,
  floor: { width: number; height: number },
  seed: number,
): { scene: WorldRect; pieces: KitPlacement[] } {
  const rng = createSeededRng(seed);
  // The horizon spans the scene, its foot HORIZON_GAP above the floor.
  const width = floor.width + 2 * KIT_MARGIN.side;
  const horizonHeight = (width * kit.horizon.size[1]) / kit.horizon.size[0];
  const scene = getKitScene(floor, horizonHeight);
  const bottom = scene.y + scene.height;
  const size = (piece: KitPiece, k = 1) => ({
    width: piece.size[0] * kit.scale * k,
    height: piece.size[1] * kit.scale * k,
  });
  const pieces: KitPlacement[] = [];
  const add = (p: Omit<KitPlacement, 'flip' | 'alpha'> & Partial<Pick<KitPlacement, 'flip' | 'alpha'>>) =>
    pieces.push({ flip: false, alpha: 1, ...p });

  add({ layer: 'horizon', key: kit.horizon.key, x: scene.x, y: scene.y, width: scene.width, height: horizonHeight });

  // The ground from a little above the horizon's foot down, under it.
  const groundTop = -HORIZON_GAP - horizonHeight * 0.2;
  add({
    layer: 'ground',
    key: kit.ground.key,
    x: scene.x,
    y: groundTop,
    width: scene.width,
    height: bottom - groundTop,
  });
  add({
    layer: 'wash',
    key: HAZE,
    x: scene.x,
    y: groundTop,
    width: scene.width,
    height: HORIZON_GAP + floor.height * 0.35,
    tint: kit.haze,
    alpha: 0.45,
  });

  // Patches of each other ground texture, tiled at the ground's scale.
  for (const patch of kit.patches) {
    const count = Math.round((scene.width * (bottom - groundTop)) / patch.every);
    for (let i = 0; i < count; i++) {
      const w = between(rng, patch.width[0], patch.width[1]);
      const h = w * between(rng, 0.4, 0.6);
      add({
        layer: 'patch',
        key: patch.texture.key,
        x: between(rng, scene.x - w * 0.2, scene.x + scene.width - w * 0.8),
        y: between(rng, groundTop, bottom - h * 0.5),
        width: w,
        height: h,
        shape: Math.floor(rng() * 2 ** 31),
      });
    }
  }

  // Blotches of light and shade, a few per floor-sized area.
  const blotches = Math.round((scene.width * (bottom - groundTop)) / 60000);
  for (let i = 0; i < blotches; i++) {
    const w = between(rng, 180, 420);
    add({
      layer: 'wash',
      key: BLOB,
      x: between(rng, scene.x - w / 2, scene.x + scene.width - w / 2),
      y: between(rng, groundTop, bottom - w * 0.2),
      width: w,
      height: w * between(rng, 0.35, 0.55),
      tint: i % 2 === 0 ? kit.light : kit.shade,
      alpha: between(rng, 0.12, 0.22),
    });
  }

  // Decals scattered over the ground, about one per nine cells of floor.
  const decals = Math.round((scene.width * (bottom - groundTop)) / 22000);
  for (let i = 0; i < decals; i++) {
    const piece = pick(rng, kit.decals);
    const { width, height } = size(piece, between(rng, 0.45, 0.75));
    add({
      layer: 'decal',
      key: piece.key,
      x: between(rng, scene.x, scene.x + scene.width - width),
      y: between(rng, groundTop + 10, bottom - height),
      width,
      height,
      flip: rng() < 0.5,
    });
  }

  // Down each side, tree clusters from the back (smaller, as they're
  // farther off) to the front, with bushes between them, all standing
  // just off the floor. Mirrored on the right.
  for (const side of [-1, 1] as const) {
    const edge = side < 0 ? BORDER_OVERLAP : floor.width - BORDER_OVERLAP;
    const standOff = (width: number, push: number) => (side < 0 ? edge - width - push : edge + push);
    const rows = [-HORIZON_GAP * 0.4, floor.height * 0.35, floor.height * 0.8, floor.height + KIT_MARGIN.bottom * 0.45];
    rows.forEach((foot, i) => {
      const piece = pick(rng, kit.trees);
      const k = 0.55 + (0.5 * i) / (rows.length - 1);
      const { width, height } = size(piece, k * between(rng, 0.92, 1.08));
      const x = standOff(width, between(rng, 0, 40));
      // Shade pooled at its foot, blending its base into the ground.
      add({
        layer: 'wash',
        key: BLOB,
        x: x - width * 0.1,
        y: foot - width * 0.25,
        width: width * 1.2,
        height: width * 0.4,
        tint: kit.shade,
        alpha: 0.35,
      });
      add({
        layer: 'standing',
        key: piece.key,
        x,
        y: foot - height,
        width,
        height,
        flip: side > 0,
        foot,
      });
    });
    for (let i = 0; i < 3; i++) {
      const piece = pick(rng, kit.bushes);
      const foot = between(rng, floor.height * (i / 3), floor.height * ((i + 1) / 3));
      const { width, height } = size(piece, between(rng, 0.6, 0.85));
      add({
        layer: 'standing',
        key: piece.key,
        x: standOff(width, between(rng, 0, 20)),
        y: foot - height,
        width,
        height,
        flip: rng() < 0.5,
        foot,
      });
    }
  }

  // A few small bushes along the front, low enough to clear the front row.
  for (let i = 0; i < 3; i++) {
    const piece = pick(rng, kit.bushes);
    const { width, height } = size(piece, between(rng, 0.4, 0.55));
    const foot = floor.height + height + between(rng, 10, 40);
    add({
      layer: 'standing',
      key: piece.key,
      x: between(rng, floor.width * 0.2, floor.width * 0.8) - width / 2,
      y: foot - height,
      width,
      height,
      flip: rng() < 0.5,
      foot,
    });
  }

  // The foreground, rising from the scene's bottom corners and tucked out
  // past the floor's sides.
  const { left, right } = kit.foreground;
  const tall = KIT_MARGIN.bottom + floor.height * 0.3;
  for (const [piece, side] of [
    [left, -1],
    [right, 1],
  ] as const) {
    const k = tall / (piece.size[1] * kit.scale);
    const { width, height } = size(piece, k);
    const x =
      side < 0
        ? Math.min(scene.x - 20, -width * (1 - FOREGROUND_REACH))
        : Math.max(scene.x + scene.width + 20 - width, floor.width - width * FOREGROUND_REACH);
    add({ layer: 'foreground', key: piece.key, x, y: bottom + 20 - height, width, height });
  }

  return { scene, pieces };
}

const smoothstep = (low: number, high: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
};

// A patch's outline from `shape`, as an alpha mask `cols` by `rows`
// (row-major, each 0 to 1): a few overlapping ovals roughened by noise, so
// no two patches share an outline, solid in the middle and fading to
// nothing well inside its edges.
export function getPatchMask(shape: number, cols: number, rows: number): number[] {
  const rng = createSeededRng(shape);
  const blobs = Array.from({ length: 3 + Math.floor(rng() * 3) }, () => ({
    x: between(rng, 0.3, 0.7),
    y: between(rng, 0.35, 0.65),
    rx: between(rng, 0.18, 0.3),
    ry: between(rng, 0.18, 0.3),
  }));
  // Value noise: random values on a coarse lattice, smoothly interpolated.
  const lattice = { cols: 9, rows: 6 };
  const values = Array.from({ length: lattice.cols * lattice.rows }, () => rng());
  const noise = (u: number, v: number) => {
    const gx = u * (lattice.cols - 1);
    const gy = v * (lattice.rows - 1);
    const x0 = Math.min(lattice.cols - 2, Math.floor(gx));
    const y0 = Math.min(lattice.rows - 2, Math.floor(gy));
    const fx = smoothstep(0, 1, gx - x0);
    const fy = smoothstep(0, 1, gy - y0);
    const at = (x: number, y: number) => values[y * lattice.cols + x];
    const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * fx;
    const low = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * fx;
    return top + (low - top) * fy;
  };
  const mask: number[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const u = col / Math.max(1, cols - 1);
      const v = row / Math.max(1, rows - 1);
      let field = 0;
      for (const b of blobs) {
        const d = ((u - b.x) / b.rx) ** 2 + ((v - b.y) / b.ry) ** 2;
        field = Math.max(field, 1 - d);
      }
      const edge = Math.min(u, 1 - u, v, 1 - v);
      const value = field + (noise(u, v) - 0.5) * 0.7;
      mask.push(smoothstep(0, 0.45, value) * smoothstep(0, 0.12, edge));
    }
  }
  return mask;
}
