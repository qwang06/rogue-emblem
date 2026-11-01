// TEMPORARY: trial team markers for painted units, picked with ?outline=…
// in the URL, to compare looks. Not for merging as is.
import Phaser from 'phaser';
import { STANDING_DEPTH_HAIR } from '../game/sideView.ts';
import { TILE_SIZE } from '../game/tileset.ts';
import type { Team } from '../game/turns.ts';

export type TrialStyle = 'current' | 'ring' | 'glow' | 'rim' | 'marker' | 'ringrim' | 'none';

export function getTrialStyle(): TrialStyle {
  const value = new URLSearchParams(window.location.search).get('outline');
  return (value as TrialStyle) ?? 'current';
}

const DARK: Record<Team, number> = { player: 0x1f4fb8, enemy: 0xb01e1e, guest: 0x1e8a3a };

// A copy of a sheet (frame by frame) turned into a soft, blurred silhouette
// halo (`blur` sheet pixels), or a thin crisp rim `rim` sheet pixels wide.
function ensureHaloTexture(scene: Phaser.Scene, key: string, kind: 'glow' | 'rim'): string {
  const outKey = `${key}-${kind}`;
  if (scene.textures.exists(outKey)) return outKey;
  const source = scene.textures.get(key);
  const image = source.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const { width, height } = image;
  const texture = scene.textures.createCanvas(outKey, width, height)!;
  const ctx = texture.context;
  const names = source.getFrameNames().length ? source.getFrameNames() : ['__BASE'];
  for (const name of names) {
    const f = source.get(name);
    const sil = document.createElement('canvas');
    sil.width = f.cutWidth;
    sil.height = f.cutHeight;
    const s = sil.getContext('2d')!;
    s.drawImage(image, f.cutX, f.cutY, f.cutWidth, f.cutHeight, 0, 0, f.cutWidth, f.cutHeight);
    s.globalCompositeOperation = 'source-in';
    s.fillStyle = '#fff';
    s.fillRect(0, 0, f.cutWidth, f.cutHeight);
    ctx.save();
    ctx.beginPath();
    ctx.rect(f.cutX, f.cutY, f.cutWidth, f.cutHeight);
    ctx.clip();
    if (kind === 'glow') {
      const blur = Math.round(f.cutWidth / 22);
      ctx.filter = `blur(${blur}px)`;
      for (let i = 0; i < 3; i++) ctx.drawImage(sil, f.cutX, f.cutY);
    } else {
      const r = Math.max(1, Math.round(f.cutWidth / 110));
      ctx.filter = `blur(${r / 2}px)`;
      for (let a = 0; a < 16; a++) {
        const t = (a / 16) * Math.PI * 2;
        ctx.drawImage(sil, f.cutX + Math.cos(t) * r, f.cutY + Math.sin(t) * r);
      }
    }
    ctx.restore();
  }
  for (const name of source.getFrameNames()) {
    const frame = source.get(name);
    texture.add(name, 0, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight);
  }
  texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  texture.refresh();
  return outKey;
}

export function addHalo(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite,
  team: Team,
  kind: 'glow' | 'rim',
  color: number,
): Phaser.GameObjects.Image {
  const halo = scene.add.image(sprite.x, sprite.y, '__DEFAULT').setTint(kind === 'rim' ? DARK[team] : color);
  const alpha = kind === 'glow' ? 0.8 : 0.95;
  const follow = () => {
    halo
      .setTexture(ensureHaloTexture(scene, sprite.texture.key, kind), sprite.frame.name)
      .setOrigin(sprite.originX, sprite.originY)
      .setPosition(sprite.x, sprite.y)
      .setDepth(sprite.depth - STANDING_DEPTH_HAIR)
      .setDisplaySize(sprite.displayWidth, sprite.displayHeight)
      .setFlip(sprite.flipX, sprite.flipY)
      .setAlpha(sprite.alpha * alpha)
      .setVisible(sprite.visible);
  };
  follow();
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, follow);
  sprite.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, follow);
    halo.destroy();
  });
  return halo;
}

const RING_SIZE = 256;
function ensureRingTexture(scene: Phaser.Scene): string {
  const key = 'team-ring';
  if (scene.textures.exists(key)) return key;
  const texture = scene.textures.createCanvas(key, RING_SIZE, RING_SIZE)!;
  const c = texture.context;
  const r = RING_SIZE / 2;
  // a soft inner pool and a bright rim
  const pool = c.createRadialGradient(r, r, 0, r, r, r);
  pool.addColorStop(0, 'rgba(255,255,255,0.10)');
  pool.addColorStop(0.7, 'rgba(255,255,255,0.28)');
  pool.addColorStop(0.8, 'rgba(255,255,255,1)');
  pool.addColorStop(0.88, 'rgba(255,255,255,1)');
  pool.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = pool;
  c.fillRect(0, 0, RING_SIZE, RING_SIZE);
  texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  texture.refresh();
  return key;
}

// A team-colored ring on the floor around a unit's feet.
export function addTeamRing(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite,
  color: number,
): Phaser.GameObjects.Image {
  const w = TILE_SIZE * 0.9;
  const h = TILE_SIZE * 0.32;
  const cx = TILE_SIZE * 0.5;
  const cy = TILE_SIZE * (27 / 32);
  const ring = scene.add
    .image(sprite.x + cx, sprite.y + cy, ensureRingTexture(scene))
    .setDisplaySize(w, h)
    .setTint(color)
    .setAlpha(0.9)
    .setDepth(0.71);
  const follow = () => ring.setPosition(sprite.x + cx, sprite.y + cy).setVisible(sprite.visible);
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, follow);
  sprite.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, follow);
    ring.destroy();
  });
  return ring;
}

function ensureMarkerTexture(scene: Phaser.Scene): string {
  const key = 'team-marker';
  if (scene.textures.exists(key)) return key;
  const size = 64;
  const texture = scene.textures.createCanvas(key, size, size)!;
  const c = texture.context;
  // a downward chevron/gem: dark edge, white fill (tinted)
  c.beginPath();
  c.moveTo(8, 12);
  c.lineTo(56, 12);
  c.lineTo(32, 54);
  c.closePath();
  c.fillStyle = '#fff';
  c.fill();
  c.lineWidth = 5;
  c.strokeStyle = 'rgba(0,0,0,0.0)';
  c.stroke();
  texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  texture.refresh();
  return key;
}

// A small team-colored gem bobbing over a unit's head.
export function addTeamMarker(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite,
  color: number,
): Phaser.GameObjects.Container {
  const size = TILE_SIZE * 0.28;
  const back = scene.add.image(0, 0, ensureMarkerTexture(scene)).setDisplaySize(size + 3, size + 3).setTint(0x1a1010);
  const gem = scene.add.image(0, 0, ensureMarkerTexture(scene)).setDisplaySize(size, size).setTint(color);
  const marker = scene.add.container(0, 0, [back, gem]).setDepth(5);
  const headY = -TILE_SIZE * 0.4;
  const follow = () => {
    const bob = Math.sin(scene.time.now / 300) * 1.2;
    marker.setPosition(sprite.x + TILE_SIZE / 2, sprite.y + headY + bob).setVisible(sprite.visible);
  };
  follow();
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, follow);
  sprite.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, follow);
    marker.destroy();
  });
  return marker;
}
