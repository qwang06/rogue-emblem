import Phaser from 'phaser';
import { getEllipseSpans } from '../game/pixelShapes.js';
import { UNIT_SHADOW } from '../game/tileset.js';

const SHADOW_KEY = 'unit-shadow';
const SHADOW_DEPTH = 0.7; // above range highlights and the arrow, below units

// The shadow texture, built once from crisp pixel rows (no anti-aliasing).
function ensureShadowTexture(scene) {
  if (scene.textures.exists(SHADOW_KEY)) return;
  const { width, height } = UNIT_SHADOW;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0x000000, 1);
  for (const span of getEllipseSpans(width, height)) g.fillRect(span.x, span.y, span.width, 1);
  g.generateTexture(SHADOW_KEY, width, height);
  g.destroy();
}

// Draws a blob shadow (UNIT_SHADOW) under a unit sprite placed at its tile's
// top-left corner. The shadow follows the sprite every frame, so walking,
// undoing a move, or redeploying needs no extra calls, and it's destroyed
// with the sprite.
export function addUnitShadow(scene, sprite) {
  ensureShadowTexture(scene);
  const { width, height, centerX, centerY, alpha } = UNIT_SHADOW;
  const shadow = scene.add.image(0, 0, SHADOW_KEY).setOrigin(0, 0).setAlpha(alpha).setDepth(SHADOW_DEPTH);
  const follow = () => shadow.setPosition(sprite.x + centerX - width / 2, sprite.y + centerY - height / 2);
  follow();

  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, follow);
  sprite.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, follow);
    shadow.destroy();
  });
  return shadow;
}
