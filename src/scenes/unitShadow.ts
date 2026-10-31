import Phaser from 'phaser';
import { getEllipseSpans } from '../game/pixelShapes.ts';
import type { Point } from '../game/grid.ts';
import { ART_FEET_Y, CAST_SHADOW, getCastShadowLayout } from '../game/sideView.ts';
import { TILE_SIZE, TREE_SHADOW, UNIT_SHADOW, type Shadow } from '../game/tileset.ts';

const SOFT_SHADOW_KEY = 'shadow-soft';
const SOFT_SHADOW_SIZE = 128; // the soft shadow texture's side, stretched to each shadow's ellipse

const UNIT_SHADOW_DEPTH = 0.7; // on the floor, over range highlights and the arrow, below everything standing
const TREE_SHADOW_DEPTH = 0.35; // over the terrain, under the floor's forests and trees

// A shadow's size and top-left offset within its tile, in world pixels.
function getShadowBox({ width, height, centerX, centerY }: Shadow) {
  const w = Math.round(width * TILE_SIZE);
  const h = Math.round(height * TILE_SIZE);
  return {
    width: w,
    height: h,
    x: Math.round(centerX * TILE_SIZE - w / 2),
    y: Math.round(centerY * TILE_SIZE - h / 2),
  };
}

// A shadow's texture, built once per size from crisp pixel rows (no
// anti-aliasing), one texture pixel per world pixel.
function ensureShadowTexture(scene: Phaser.Scene, shape: Shadow): string {
  const { width, height } = getShadowBox(shape);
  const key = `shadow-${width}x${height}`;
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0x000000, 1);
  for (const span of getEllipseSpans(width, height)) g.fillRect(span.x, span.y, span.width, 1);
  g.generateTexture(key, width, height);
  g.destroy();
  return key;
}

// A blob shadow (shape like UNIT_SHADOW) at its spot within the tile whose
// top-left corner is (x, y).
function addShadow(scene: Phaser.Scene, x: number, y: number, shape: Shadow, depth: number): Phaser.GameObjects.Image {
  const box = getShadowBox(shape);
  return scene.add
    .image(x + box.x, y + box.y, ensureShadowTexture(scene, shape))
    .setOrigin(0, 0)
    .setAlpha(shape.alpha)
    .setDepth(depth);
}

// Draws a blob shadow (UNIT_SHADOW, or `shape`; a soft one on a painted
// floor) under a unit sprite placed at its tile's top-left corner. The shadow follows the sprite every frame, so walking,
// undoing a move, or redeploying needs no extra calls, and it's destroyed
// with the sprite.
export function addUnitShadow(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite,
  shape: Shadow = UNIT_SHADOW,
  soft = false,
): Phaser.GameObjects.Image {
  const box = getShadowBox(shape);
  const shadow = soft
    ? addSoftShadow(scene, sprite.x, sprite.y, shape, UNIT_SHADOW_DEPTH)
    : addShadow(scene, sprite.x, sprite.y, shape, UNIT_SHADOW_DEPTH);
  const follow = () => shadow.setPosition(sprite.x + box.x, sprite.y + box.y);

  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, follow);
  sprite.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, follow);
    shadow.destroy();
  });
  return shadow;
}

// The soft shadow's texture, built once: a round pool, black in the middle
// fading out to nothing at its edge, stretched to each shadow's ellipse and
// filtered smoothly (unlike the game's crisp pixel art).
function ensureSoftShadowTexture(scene: Phaser.Scene): string {
  if (scene.textures.exists(SOFT_SHADOW_KEY)) return SOFT_SHADOW_KEY;
  const texture = scene.textures.createCanvas(SOFT_SHADOW_KEY, SOFT_SHADOW_SIZE, SOFT_SHADOW_SIZE)!;
  const context = texture.getContext();
  const r = SOFT_SHADOW_SIZE / 2;
  const gradient = context.createRadialGradient(r, r, 0, r, r, r);
  gradient.addColorStop(0, 'rgba(0,0,0,1)');
  gradient.addColorStop(0.45, 'rgba(0,0,0,0.75)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, SOFT_SHADOW_SIZE, SOFT_SHADOW_SIZE);
  texture.refresh();
  texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  return SOFT_SHADOW_KEY;
}

// A soft, blurred shadow (shape like SOFT_UNIT_SHADOW) at its spot within
// the tile whose top-left corner is (x, y), for a painted floor.
export function addSoftShadow(
  scene: Phaser.Scene,
  x: number,
  y: number,
  shape: Shadow,
  depth: number,
): Phaser.GameObjects.Image {
  const box = getShadowBox(shape);
  return scene.add
    .image(x + box.x, y + box.y, ensureSoftShadowTexture(scene))
    .setOrigin(0, 0)
    .setDisplaySize(box.width, box.height)
    .setAlpha(shape.alpha)
    .setDepth(depth);
}

// Draws a blob shadow (TREE_SHADOW) at the foot of a tree in the tile whose
// top-left corner is (x, y). Trees never move, so it stays put.
export function addTreeShadow(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Image {
  return addShadow(scene, x, y, TREE_SHADOW, TREE_SHADOW_DEPTH);
}

// The cast-shadow texture for a unit sprite's square frame (mirrored when
// `flip`), built once per frame: its silhouette laid down by
// getCastShadowLayout, black and blurred. Returns its key and where its feet
// are, to anchor it by.
function ensureCastShadowTexture(
  scene: Phaser.Scene,
  frame: Phaser.Textures.Frame,
  flip: boolean,
): { key: string; anchor: Point } {
  const source = frame.source.image as HTMLImageElement | HTMLCanvasElement;
  const size = frame.cutWidth;
  const layout = getCastShadowLayout(size, (ART_FEET_Y / TILE_SIZE) * size);
  const shadowKey = `cast-shadow-${frame.texture.key}-${String(frame.name)}${flip ? '-flip' : ''}`;
  if (!scene.textures.exists(shadowKey)) {
    const texture = scene.textures.createCanvas(shadowKey, layout.width, layout.height)!;
    const context = texture.getContext();
    context.setTransform(...layout.transform);
    if (flip) {
      context.translate(size, 0);
      context.scale(-1, 1);
    }
    context.filter = `blur(${Math.max(1, Math.round(size / 96))}px)`;
    context.drawImage(source, frame.cutX, frame.cutY, size, size, 0, 0, size, size);
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.filter = 'none';
    context.globalCompositeOperation = 'source-in';
    context.fillStyle = '#000';
    context.fillRect(0, 0, layout.width, layout.height);
    texture.refresh();
    texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
  return { key: shadowKey, anchor: layout.anchor };
}

// A painted unit's shadow cast by light from the upper left (CAST_SHADOW):
// its own silhouette laid down from its feet toward the lower right, soft
// edged. Follows the sprite (placed by its tile's top-left corner) every
// frame, mirrors with it, and is destroyed with it.
export function addCastShadow(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite): Phaser.GameObjects.Image {
  const shadow = scene.add.image(sprite.x, sprite.y, '__DEFAULT').setDepth(UNIT_SHADOW_DEPTH);
  const follow = () => {
    const { key, anchor } = ensureCastShadowTexture(scene, sprite.frame, sprite.flipX);
    if (shadow.texture.key !== key) shadow.setTexture(key).setOrigin(anchor.x, anchor.y);
    const scale = sprite.displayWidth / sprite.frame.cutWidth;
    shadow
      .setPosition(sprite.x + TILE_SIZE / 2, sprite.y + ART_FEET_Y)
      .setScale(scale)
      .setAlpha(sprite.alpha * CAST_SHADOW.alpha)
      .setVisible(sprite.visible);
  };
  follow();
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, follow);
  sprite.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, follow);
    shadow.destroy();
  });
  return shadow;
}
