// Small visual effects for sprites. Presentation only — these never change
// game state, they just play something and report when they're done.
// Distances and speeds are tuned in pixels of a 32px tile and scaled by
// GRID_PX, so they keep their size relative to the map's tiles.

import type Phaser from 'phaser';
import type { Point } from '../game/grid.ts';
import type { RestoreStat } from '../game/items.ts';
import { GRID_PX } from '../game/tileset.ts';

type Sprite = Phaser.GameObjects.Sprite;
type Done = () => void;

const HIT_FLASH_COLOR = 0xffffff;
const HIT_FLASH_TOGGLES = 6; // on/off pairs → 3 white flashes
const HIT_FLASH_INTERVAL_MS = 70;

// Flashes a sprite solid white a few times (the classic "took a hit"
// blink), then restores its normal colors and calls onDone.
export function playHitFlash(scene: Phaser.Scene, sprite: Sprite, onDone?: Done): void {
  let toggles = 0;
  scene.time.addEvent({
    delay: HIT_FLASH_INTERVAL_MS,
    repeat: HIT_FLASH_TOGGLES - 1,
    callback: () => {
      toggles += 1;
      if (toggles % 2 === 1) sprite.setTintFill(HIT_FLASH_COLOR);
      else sprite.clearTint();
      if (toggles === HIT_FLASH_TOGGLES) onDone?.();
    },
  });
}

const EFFECT_DEPTH = 2; // above units and the cursor

const STONE_COLOR = 0x8a8a8a;
const STONE_RADIUS = 2 * GRID_PX;
const STONE_SPEED = 0.25 * GRID_PX; // px per ms, so farther throws take longer
const STONE_MIN_FLIGHT_MS = 240;
const STONE_ARC_PER_PX = 0.18; // the lob rises this much per px of distance

// Lobs a small drawn stone in an arc from one world point to another (a
// longer throw flies longer and higher), then calls onDone once it lands.
// No sprite needed — it's a circle. A single counter tween, so onDone
// fires exactly once.
export function playStoneThrow(scene: Phaser.Scene, from: Point, to: Point, onDone?: Done): void {
  const stone = scene.add.circle(from.x, from.y, STONE_RADIUS, STONE_COLOR).setDepth(EFFECT_DEPTH);
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const arcHeight = distance * STONE_ARC_PER_PX;
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: Math.max(STONE_MIN_FLIGHT_MS, distance / STONE_SPEED),
    onUpdate: (tween) => {
      const t = tween.getValue() ?? 0;
      stone.setPosition(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t - Math.sin(Math.PI * t) * arcHeight);
    },
    onComplete: () => {
      stone.destroy();
      onDone?.();
    },
  });
}

const PARTICLE_KEY = 'fx-particle';

// A soft white dot drawn at runtime, so particle effects need no sprite
// art. Particles are tinted per-frame, so white is the neutral base.
function ensureParticleTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(PARTICLE_KEY)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xffffff, 0.5);
  g.fillCircle(3, 3, 3);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(3, 3, 2);
  g.generateTexture(PARTICLE_KEY, 6, 6);
  g.destroy();
}

// Colors for playPotionGlow, by the stat the potion restores.
export const POTION_COLORS: Readonly<Record<RestoreStat, number>> = Object.freeze({
  health: 0x4ade80,
  mana: 0x60a5fa,
});

const POTION_PARTICLE_COUNT = 14;
const POTION_LIFESPAN_MS = 650;
const POTION_PULSE_TOGGLES = 6;
const POTION_PULSE_INTERVAL_MS = 90;

// A drinking-a-potion glow: sparkles rise from the unit's feet in the given
// color while the sprite pulses that color a few times. The same effect
// serves every potion, just in a different color (see POTION_COLORS).
// `center` is the sprite's center in world space. Calls onDone when the
// pulse ends.
export function playPotionGlow(scene: Phaser.Scene, sprite: Sprite, center: Point, color: number, onDone?: Done): void {
  ensureParticleTexture(scene);
  const halfWidth = sprite.displayWidth / 2 - 2 * GRID_PX;
  const emitter = scene.add
    .particles(center.x, center.y + sprite.displayHeight / 2 - 2 * GRID_PX, PARTICLE_KEY, {
      x: { min: -halfWidth, max: halfWidth },
      speedY: { min: -38 * GRID_PX, max: -22 * GRID_PX },
      speedX: { min: -4 * GRID_PX, max: 4 * GRID_PX },
      lifespan: { min: POTION_LIFESPAN_MS * 0.6, max: POTION_LIFESPAN_MS },
      scale: { start: 0.9 * GRID_PX, end: 0.2 * GRID_PX },
      alpha: { start: 1, end: 0 },
      color: [0xffffff, color],
      blendMode: 'ADD',
      emitting: false,
    })
    .setDepth(EFFECT_DEPTH);
  emitter.timeScale = scene.time.timeScale;
  // Two waves so the sparkles trail up rather than pop all at once.
  emitter.explode(POTION_PARTICLE_COUNT / 2);
  scene.time.delayedCall(POTION_PULSE_INTERVAL_MS * 2, () => emitter.explode(POTION_PARTICLE_COUNT / 2));
  scene.time.delayedCall(POTION_LIFESPAN_MS + POTION_PULSE_INTERVAL_MS * 2, () => emitter.destroy());

  let toggles = 0;
  scene.time.addEvent({
    delay: POTION_PULSE_INTERVAL_MS,
    repeat: POTION_PULSE_TOGGLES - 1,
    callback: () => {
      toggles += 1;
      if (toggles % 2 === 1) sprite.setTint(color);
      else sprite.clearTint();
      if (toggles === POTION_PULSE_TOGGLES) onDone?.();
    },
  });
}

const LUNGE_DISTANCE = 12 * GRID_PX; // px the attacker steps toward its target, by default
const LUNGE_MS = 110; // each way

export interface LungeOptions {
  // px to dart toward the target (see getLungeDistance in hitJuice.ts).
  distance?: number;
  // How long to hold at the far end before coming back: the hit-stop.
  holdMs?: number;
  // Fires once at the far end, where the blow lands.
  onImpact?: Done;
  // Fires once the sprite is back where it started.
  onDone?: Done;
}

// A lunge: the sprite darts toward a world point, holds there for `holdMs`
// and darts back. Counter tweens move it along the lunge, because a
// property tween on both x and y would fire its callbacks once per property.
export function playLunge(
  scene: Phaser.Scene,
  sprite: Sprite,
  toward: Point,
  { distance = LUNGE_DISTANCE, holdMs = 0, onImpact, onDone }: LungeOptions = {},
): void {
  const center = { x: sprite.x + sprite.displayWidth / 2, y: sprite.y + sprite.displayHeight / 2 };
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;
  const length = Math.hypot(dx, dy) || 1;
  const home = { x: sprite.x, y: sprite.y };
  const step = { x: (dx / length) * distance, y: (dy / length) * distance };
  const moveTo = (t: number) => sprite.setPosition(home.x + step.x * t, home.y + step.y * t);
  const back = () =>
    scene.tweens.addCounter({
      from: 1,
      to: 0,
      duration: LUNGE_MS,
      ease: 'Quad.easeOut',
      onUpdate: (tween) => moveTo(tween.getValue() ?? 0),
      onComplete: () => {
        sprite.setPosition(home.x, home.y);
        onDone?.();
      },
    });
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: LUNGE_MS,
    ease: 'Quad.easeIn',
    onUpdate: (tween) => moveTo(tween.getValue() ?? 0),
    onComplete: () => {
      onImpact?.();
      if (holdMs > 0) scene.time.delayedCall(holdMs, back);
      else back();
    },
  });
}

// Hit-stop: freezes the sprites' animations for `durationMs` on the scene
// clock (so it shortens with the game speed) with the struck sprite solid
// white, then lets them go and calls onDone.
export function playHitStop(
  scene: Phaser.Scene,
  struck: Sprite,
  others: readonly Sprite[],
  durationMs: number,
  onDone?: Done,
): void {
  if (durationMs <= 0) {
    onDone?.();
    return;
  }
  const sprites = [struck, ...others];
  for (const sprite of sprites) sprite.anims.pause();
  struck.setTintFill(HIT_FLASH_COLOR);
  scene.time.delayedCall(durationMs, () => {
    struck.clearTint();
    for (const sprite of sprites) if (sprite.active) sprite.anims.resume();
    onDone?.();
  });
}

const DEATH_COLORS = [0xffffff, 0xfca5a5, 0xdc2626];
const DEATH_PARTICLE_COUNT = 18;
const DEATH_LIFESPAN_MS = 520;
const DEATH_FADE_MS = 360;

// A defeated unit bursts apart: it flashes white and fades out while
// sparks fly from its center (`center`, in world space). With reduced
// motion it only fades. Calls onDone once it's gone (the caller removes
// the sprite).
export function playDeathBurst(
  scene: Phaser.Scene,
  sprite: Sprite,
  center: Point,
  reducedMotion: boolean,
  onDone?: Done,
): void {
  sprite.anims.pause();
  sprite.setTintFill(HIT_FLASH_COLOR);
  if (!reducedMotion) {
    ensureParticleTexture(scene);
    const emitter = scene.add
      .particles(center.x, center.y, PARTICLE_KEY, {
        speed: { min: 40 * GRID_PX, max: 110 * GRID_PX },
        angle: { min: 0, max: 360 },
        gravityY: 120 * GRID_PX,
        lifespan: { min: DEATH_LIFESPAN_MS * 0.6, max: DEATH_LIFESPAN_MS },
        scale: { start: 1.1 * GRID_PX, end: 0.2 * GRID_PX },
        alpha: { start: 1, end: 0 },
        color: DEATH_COLORS,
        blendMode: 'ADD',
        emitting: false,
      })
      .setDepth(EFFECT_DEPTH);
    emitter.timeScale = scene.time.timeScale;
    emitter.explode(DEATH_PARTICLE_COUNT);
    scene.time.delayedCall(DEATH_LIFESPAN_MS, () => emitter.destroy());
  }
  scene.tweens.add({
    targets: sprite,
    alpha: 0,
    duration: DEATH_FADE_MS,
    ease: 'Quad.easeIn',
    onComplete: () => onDone?.(),
  });
}
