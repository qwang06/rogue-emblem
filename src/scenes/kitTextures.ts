import Phaser from 'phaser';
import { BLOB, getPatchMask, HAZE, type KitPlacement } from '../game/battlefieldKit.ts';

const SIZE = 128; // each texture's side, stretched to whatever it covers

// The washes a battlefield kit lays over its ground (see layOutKit),
// built once and filtered smoothly: BLOB, a white pool fading out to
// nothing at its edge, and HAZE, white at its top fading out downward.
// Both are tinted to the kit's colors where they're drawn.
export function ensureKitTextures(scene: Phaser.Scene) {
  const make = (key: string, paint: (context: CanvasRenderingContext2D) => CanvasGradient) => {
    if (scene.textures.exists(key)) return;
    const texture = scene.textures.createCanvas(key, SIZE, SIZE)!;
    const context = texture.getContext();
    context.fillStyle = paint(context);
    context.fillRect(0, 0, SIZE, SIZE);
    texture.refresh();
    texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  };
  make(BLOB, (context) => {
    const r = SIZE / 2;
    const gradient = context.createRadialGradient(r, r, 0, r, r, r);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.6)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    return gradient;
  });
  make(HAZE, (context) => {
    const gradient = context.createLinearGradient(0, 0, 0, SIZE);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    return gradient;
  });
}

// The mask's resolution per patch: coarse, and smoothed as it's stretched,
// so the outline comes out soft.
const MASK = { cols: 48, rows: 24 };

// A texture for one patch laid out by layOutKit: its ground texture tiled
// at the kit's `scale` (from a seeded offset, so patches don't repeat each
// other) and cut to the patch's soft outline (getPatchMask). Drawn at the
// texture's own resolution and shown at the patch's world size. Returns
// its key.
export function makePatchTexture(scene: Phaser.Scene, patch: KitPlacement, scale: number): string {
  const key = `${patch.key}-patch-${patch.shape}`;
  if (scene.textures.exists(key)) return key;
  const width = Math.max(1, Math.round(patch.width / scale));
  const height = Math.max(1, Math.round(patch.height / scale));
  const texture = scene.textures.createCanvas(key, width, height)!;
  const context = texture.getContext();
  const source = scene.textures.get(patch.key).getSourceImage() as CanvasImageSource & {
    width: number;
    height: number;
  };
  const pattern = context.createPattern(source, 'repeat')!;
  const shape = patch.shape ?? 0;
  pattern.setTransform(new DOMMatrix().translate(-(shape % source.width), -((shape >> 10) % source.height)));
  context.fillStyle = pattern;
  context.fillRect(0, 0, width, height);
  // The outline: the mask drawn small, then stretched over the patch with
  // smoothing to keep only what's inside it.
  const mask = document.createElement('canvas');
  mask.width = MASK.cols;
  mask.height = MASK.rows;
  const maskContext = mask.getContext('2d')!;
  const pixels = maskContext.createImageData(MASK.cols, MASK.rows);
  getPatchMask(shape, MASK.cols, MASK.rows).forEach((alpha, i) => {
    pixels.data.set([255, 255, 255, Math.round(alpha * 255)], i * 4);
  });
  maskContext.putImageData(pixels, 0, 0);
  context.globalCompositeOperation = 'destination-in';
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(mask, 0, 0, width, height);
  context.globalCompositeOperation = 'source-over';
  texture.refresh();
  texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  return key;
}
