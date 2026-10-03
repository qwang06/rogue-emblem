import Phaser from 'phaser';
import { getEllipseSpans } from '../game/pixelShapes.ts';
import { TREE_SHADOW, UNIT_SHADOW, type Shadow } from '../game/tileset.ts';

const UNIT_SHADOW_DEPTH = 0.7; // above range highlights and the arrow, below units
const TREE_SHADOW_DEPTH = 0.35; // over the terrain, below trees (0.4)

// A shadow's texture, built once per size from crisp pixel rows (no
// anti-aliasing).
function ensureShadowTexture(scene: Phaser.Scene, { width, height }: Shadow): string {
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
  const { width, height, centerX, centerY, alpha } = shape;
  return scene.add
    .image(x + centerX - width / 2, y + centerY - height / 2, ensureShadowTexture(scene, shape))
    .setOrigin(0, 0)
    .setAlpha(alpha)
    .setDepth(depth);
}

// Draws a blob shadow (UNIT_SHADOW) under a unit sprite placed at its tile's
// top-left corner. The shadow follows the sprite every frame, so walking,
// undoing a move, or redeploying needs no extra calls, and it's destroyed
// with the sprite.
export function addUnitShadow(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite): Phaser.GameObjects.Image {
  const { width, height, centerX, centerY } = UNIT_SHADOW;
  const shadow = addShadow(scene, sprite.x, sprite.y, UNIT_SHADOW, UNIT_SHADOW_DEPTH);
  const follow = () => shadow.setPosition(sprite.x + centerX - width / 2, sprite.y + centerY - height / 2);

  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, follow);
  sprite.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, follow);
    shadow.destroy();
  });
  return shadow;
}

// Draws a blob shadow (TREE_SHADOW) at the foot of a tree in the tile whose
// top-left corner is (x, y). Trees never move, so it stays put.
export function addTreeShadow(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Image {
  return addShadow(scene, x, y, TREE_SHADOW, TREE_SHADOW_DEPTH);
}
