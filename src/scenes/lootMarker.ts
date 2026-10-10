import Phaser from 'phaser';
import { LOOT_MARKER } from '../game/tileset.ts';

const LOOT_MARKER_DEPTH = 0.76; // just over units (0.75), under roofs (0.8)

// Draws the icon `key` (an item sprite) small in a corner of a unit sprite
// placed at its tile's top-left corner (see LOOT_MARKER), marking the unit
// as carrying loot. Like the unit's shadow it follows the sprite every
// frame and is destroyed with it.
export function addLootMarker(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite,
  key: string,
): Phaser.GameObjects.Image {
  const { x, y, size } = LOOT_MARKER;
  const marker = scene.add
    .image(sprite.x + x, sprite.y + y, key, 0)
    .setOrigin(0, 0)
    .setDisplaySize(size, size)
    .setDepth(LOOT_MARKER_DEPTH);
  const follow = () => marker.setPosition(sprite.x + x, sprite.y + y);

  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, follow);
  sprite.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, follow);
    marker.destroy();
  });
  return marker;
}
