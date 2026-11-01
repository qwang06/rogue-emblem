import Phaser from 'phaser';
import { getPixelArtSpans } from '../game/pixelShapes.ts';
import { RANK_BADGES } from '../game/tileset.ts';
import type { UnitRank } from '../game/Unit.ts';

const RANK_BADGE_DEPTH = 0.76; // just over units (0.75), under roofs (0.8)

// A rank's badge texture, built once from its pixel rows (no anti-aliasing).
function ensureBadgeTexture(scene: Phaser.Scene, rank: UnitRank): string {
  const key = `rank-badge-${rank}`;
  if (scene.textures.exists(key)) return key;
  const art = RANK_BADGES[rank];
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  for (const span of getPixelArtSpans(art)) {
    g.fillStyle(span.color, 1);
    g.fillRect(span.x, span.y, span.width, 1);
  }
  g.generateTexture(key, Math.max(...art.rows.map((row) => row.length)), art.rows.length);
  g.destroy();
  return key;
}

// Pins `rank`'s badge (RANK_BADGES) to a unit sprite placed at its tile's
// top-left corner. Like the outline and shadow it follows the sprite every
// frame (position, alpha and visibility), so walking, shoves and undoing a
// move need no extra calls, and it's destroyed with the sprite.
export function addRankBadge(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite,
  rank: UnitRank,
): Phaser.GameObjects.Image {
  const { x, y } = RANK_BADGES[rank];
  const badge = scene.add.image(sprite.x + x, sprite.y + y, ensureBadgeTexture(scene, rank)).setOrigin(0, 0);
  badge.setDepth(RANK_BADGE_DEPTH);
  const follow = () =>
    badge
      .setPosition(sprite.x + x, sprite.y + y)
      .setAlpha(sprite.alpha)
      .setVisible(sprite.visible);
  follow();
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, follow);
  sprite.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, follow);
    badge.destroy();
  });
  return badge;
}
