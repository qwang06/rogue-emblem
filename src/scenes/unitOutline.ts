import Phaser from 'phaser';
import { getOutlineMask } from '../game/pixelShapes.ts';
import { getOutlineWidth } from '../game/tileset.ts';

const UNIT_OUTLINE_DEPTH = 0.74; // just under units (0.75), over their shadows (0.7)

// The white outline texture of a unit sheet (getOutlineMask over its
// pixels), cut into the same frames, built once per sheet. White, so a tint
// gives it any team's color.
function ensureOutlineTexture(scene: Phaser.Scene, key: string): string {
  const outlineKey = `${key}-outline`;
  if (scene.textures.exists(outlineKey)) return outlineKey;
  const source = scene.textures.get(key);
  const image = source.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const { width, height } = image;
  const reader = document.createElement('canvas');
  reader.width = width;
  reader.height = height;
  const context = reader.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, width, height);
  const alpha = new Uint8Array(width * height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = pixels.data[i * 4 + 3];

  const firstFrame = source.get(0);
  const mask = getOutlineMask(alpha, width, height, firstFrame.width, getOutlineWidth(firstFrame.width));
  const texture = scene.textures.createCanvas(outlineKey, width, height)!;
  const out = texture.context.createImageData(width, height);
  mask.forEach((on, i) => {
    if (!on) return;
    out.data.set([255, 255, 255, 255], i * 4);
  });
  texture.context.putImageData(out, 0, 0);
  for (const name of source.getFrameNames()) {
    const frame = source.get(name);
    texture.add(name, 0, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight);
  }
  texture.refresh();
  return outlineKey;
}

// Draws an outline in `color` around a unit sprite's art. It follows the
// sprite every frame (position, size, animation frame and sheet, flip and
// visibility), so walking and attacking need no extra calls, and it's
// destroyed with the sprite.
export function addUnitOutline(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite,
  color: number,
): Phaser.GameObjects.Image {
  const outline = scene.add.image(sprite.x, sprite.y, '__DEFAULT').setDepth(UNIT_OUTLINE_DEPTH).setTint(color);
  const follow = () => {
    outline
      .setTexture(ensureOutlineTexture(scene, sprite.texture.key), sprite.frame.name)
      .setOrigin(sprite.originX, sprite.originY)
      .setPosition(sprite.x, sprite.y)
      .setDisplaySize(sprite.displayWidth, sprite.displayHeight)
      .setFlip(sprite.flipX, sprite.flipY)
      .setAlpha(sprite.alpha)
      .setVisible(sprite.visible);
  };
  follow();
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, follow);
  sprite.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, follow);
    outline.destroy();
  });
  return outline;
}
