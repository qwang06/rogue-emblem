// Small visual effects for sprites. Presentation only — these never change
// game state, they just play something and report when they're done.

const HIT_FLASH_COLOR = 0xffffff;
const HIT_FLASH_TOGGLES = 6; // on/off pairs → 3 white flashes
const HIT_FLASH_INTERVAL_MS = 70;

// Flashes a sprite solid white a few times (the classic "took a hit"
// blink), then restores its normal colors and calls onDone.
export function playHitFlash(scene, sprite, onDone) {
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
const STONE_RADIUS = 2;
const STONE_SPEED = 0.25; // px per ms, so farther throws take longer
const STONE_MIN_FLIGHT_MS = 240;
const STONE_ARC_PER_PX = 0.18; // the lob rises this much per px of distance

// Lobs a small drawn stone in an arc from one world point to another (a
// longer throw flies longer and higher), then calls onDone once it lands.
// No sprite needed — it's a circle. A single counter tween, so onDone
// fires exactly once.
export function playStoneThrow(scene, from, to, onDone) {
  const stone = scene.add.circle(from.x, from.y, STONE_RADIUS, STONE_COLOR).setDepth(EFFECT_DEPTH);
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const arcHeight = distance * STONE_ARC_PER_PX;
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: Math.max(STONE_MIN_FLIGHT_MS, distance / STONE_SPEED),
    onUpdate: (tween) => {
      const t = tween.getValue();
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
function ensureParticleTexture(scene) {
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
export const POTION_COLORS = Object.freeze({
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
export function playPotionGlow(scene, sprite, center, color, onDone) {
  ensureParticleTexture(scene);
  const halfWidth = sprite.displayWidth / 2 - 2;
  const emitter = scene.add
    .particles(center.x, center.y + sprite.displayHeight / 2 - 2, PARTICLE_KEY, {
      x: { min: -halfWidth, max: halfWidth },
      speedY: { min: -38, max: -22 },
      speedX: { min: -4, max: 4 },
      lifespan: { min: POTION_LIFESPAN_MS * 0.6, max: POTION_LIFESPAN_MS },
      scale: { start: 0.9, end: 0.2 },
      alpha: { start: 1, end: 0 },
      color: [0xffffff, color],
      blendMode: 'ADD',
      emitting: false,
    })
    .setDepth(EFFECT_DEPTH);
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

const LUNGE_DISTANCE = 12; // px the attacker steps toward its target
const LUNGE_MS = 110; // each way

// A melee lunge: the sprite darts toward a world point and back. onImpact
// fires once at the far end (where the blow lands), onDone once it's back.
// It's a single counter tween moving the sprite along the lunge, because a
// property tween on both x and y fires onYoyo once per property.
export function playLunge(scene, sprite, toward, onImpact, onDone) {
  const center = { x: sprite.x + sprite.displayWidth / 2, y: sprite.y + sprite.displayHeight / 2 };
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;
  const length = Math.hypot(dx, dy) || 1;
  const home = { x: sprite.x, y: sprite.y };
  const step = { x: (dx / length) * LUNGE_DISTANCE, y: (dy / length) * LUNGE_DISTANCE };
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: LUNGE_MS,
    ease: 'Quad.easeIn',
    yoyo: true,
    onUpdate: (tween) => {
      const t = tween.getValue();
      sprite.setPosition(home.x + step.x * t, home.y + step.y * t);
    },
    onYoyo: () => onImpact?.(),
    onComplete: () => {
      sprite.setPosition(home.x, home.y);
      onDone?.();
    },
  });
}
