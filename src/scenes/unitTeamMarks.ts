import Phaser from 'phaser';
import { listenUntilStopped } from './sceneListeners.ts';
import { recolorAccents } from '../game/teamAccents.ts';
import { TILE_SIZE, UNIT_TEAM_MARKS } from '../game/tileset.ts';
import type { Team } from '../game/turns.ts';

// How a unit on the map shows its side (UNIT_TEAM_MARKS): a ring on the
// floor at its feet, and its blue accents in its team's hue. The art itself
// gets no outline.

const RING_KEY = 'team-ring';
const RING_SIZE = 256; // the ring texture's side, stretched to each ring's ellipse
const RING_DEPTH = 0.71; // on the floor just over the unit shadows, below everything standing

// Copies a texture's frames (by name and cut) onto `texture`, built from the
// same sheet.
function copyFrames(source: Phaser.Textures.Texture, texture: Phaser.Textures.CanvasTexture) {
  for (const name of source.getFrameNames()) {
    const frame = source.get(name);
    texture.add(name, 0, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight);
  }
}

// The ring's texture, built once: a faint pool inside a bright soft-edged
// band, white so a tint gives it any team's color.
function ensureRingTexture(scene: Phaser.Scene): string {
  if (scene.textures.exists(RING_KEY)) return RING_KEY;
  const texture = scene.textures.createCanvas(RING_KEY, RING_SIZE, RING_SIZE)!;
  const context = texture.context;
  const r = RING_SIZE / 2;
  const gradient = context.createRadialGradient(r, r, 0, r, r, r);
  gradient.addColorStop(0, 'rgba(255,255,255,0.10)');
  gradient.addColorStop(0.7, 'rgba(255,255,255,0.28)');
  gradient.addColorStop(0.8, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.88, 'rgba(255,255,255,1)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, RING_SIZE, RING_SIZE);
  texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  texture.refresh();
  return RING_KEY;
}

// Draws a ring in `team`'s ring color on the floor around the feet of a unit
// sprite placed at its tile's top-left corner. It follows the sprite, and
// it's destroyed with it.
export function addTeamRing(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite,
  team: Team,
): Phaser.GameObjects.Image {
  const { width, height, centerX, centerY, alpha, colors } = UNIT_TEAM_MARKS.ring;
  const dx = centerX * TILE_SIZE;
  const dy = centerY * TILE_SIZE;
  const ring = scene.add
    .image(sprite.x + dx, sprite.y + dy, ensureRingTexture(scene))
    .setDisplaySize(width * TILE_SIZE, height * TILE_SIZE)
    .setTint(colors[team])
    .setAlpha(alpha)
    .setDepth(RING_DEPTH);
  const follow = () => ring.setPosition(sprite.x + dx, sprite.y + dy).setVisible(sprite.visible);
  const stop = listenUntilStopped(scene.events, { [Phaser.Scenes.Events.POST_UPDATE]: follow });
  sprite.once(Phaser.GameObjects.Events.DESTROY, () => {
    stop();
    ring.destroy();
  });
  return ring;
}

// The texture to draw a unit image with for `team`: the image itself for a
// team whose accents stay as painted, else a copy (built once per image and
// team) with its blue accents turned to the team's hue (recolorAccents).
export function getTeamTextureKey(scene: Phaser.Scene, key: string, team: Team): string {
  const hue = UNIT_TEAM_MARKS.accentHue[team];
  if (hue === null) return key;
  const teamKey = `${key}-${team}`;
  if (scene.textures.exists(teamKey)) return teamKey;
  const source = scene.textures.get(key);
  const image = source.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const texture = scene.textures.createCanvas(teamKey, image.width, image.height)!;
  const context = texture.context;
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, image.width, image.height);
  pixels.data.set(recolorAccents(pixels.data, hue));
  context.putImageData(pixels, 0, 0);
  copyFrames(source, texture);
  if (source.source[0].scaleMode === Phaser.ScaleModes.LINEAR) texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  texture.refresh();
  return teamKey;
}
