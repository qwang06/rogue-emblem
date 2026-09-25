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

const GRENADE_COLOR = 0x2f3b2f;
const GRENADE_RADIUS = 2;
const GRENADE_FLIGHT_MS = 380;
const GRENADE_ARC_HEIGHT = 14; // px the lob rises above a straight line

// Lobs a small drawn grenade in an arc from one world point to another,
// then calls onDone once it lands. No sprite needed — it's a circle.
export function playGrenadeThrow(scene, from, to, onDone) {
  const grenade = scene.add.circle(from.x, from.y, GRENADE_RADIUS, GRENADE_COLOR).setDepth(EFFECT_DEPTH);
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: GRENADE_FLIGHT_MS,
    onUpdate: (tween) => {
      const t = tween.getValue();
      grenade.setPosition(
        from.x + (to.x - from.x) * t,
        from.y + (to.y - from.y) * t - Math.sin(Math.PI * t) * GRENADE_ARC_HEIGHT,
      );
    },
    onComplete: () => {
      grenade.destroy();
      onDone?.();
    },
  });
}

const FIRE_PARTICLE_KEY = 'fx-fire-particle';
const FIRE_PARTICLE_COUNT = 28;
const FIRE_LIFESPAN_MS = 450;
const FIRE_FLICKER_COLORS = [0xff5a00, 0xffc400];
const FIRE_FLICKER_TOGGLES = 8;
const FIRE_FLICKER_INTERVAL_MS = 60;

// A soft white dot drawn at runtime, so fire needs no sprite art. Particles
// are tinted per-frame, so white is the neutral base.
function ensureFireTexture(scene) {
  if (scene.textures.exists(FIRE_PARTICLE_KEY)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xffffff, 0.5);
  g.fillCircle(3, 3, 3);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(3, 3, 2);
  g.generateTexture(FIRE_PARTICLE_KEY, 6, 6);
  g.destroy();
}

// A fiery burst at a world point: particles fly out and drift upward,
// fading yellow → orange → red, while the sprite flickers orange instead
// of the white hit flash. Calls onDone when the flicker ends.
export function playFireBurst(scene, sprite, center, onDone) {
  ensureFireTexture(scene);
  const emitter = scene.add
    .particles(center.x, center.y, FIRE_PARTICLE_KEY, {
      speed: { min: 15, max: 55 },
      angle: { min: 0, max: 360 },
      gravityY: -60,
      lifespan: { min: FIRE_LIFESPAN_MS * 0.6, max: FIRE_LIFESPAN_MS },
      scale: { start: 1.3, end: 0 },
      alpha: { start: 1, end: 0 },
      color: [0xfff3a0, 0xffb000, 0xff5a00, 0xb01800],
      blendMode: 'ADD',
      emitting: false,
    })
    .setDepth(EFFECT_DEPTH);
  emitter.explode(FIRE_PARTICLE_COUNT);
  scene.time.delayedCall(FIRE_LIFESPAN_MS, () => emitter.destroy());

  let toggles = 0;
  scene.time.addEvent({
    delay: FIRE_FLICKER_INTERVAL_MS,
    repeat: FIRE_FLICKER_TOGGLES - 1,
    callback: () => {
      toggles += 1;
      if (toggles === FIRE_FLICKER_TOGGLES) {
        sprite.clearTint();
        onDone?.();
      } else {
        sprite.setTintFill(FIRE_FLICKER_COLORS[toggles % FIRE_FLICKER_COLORS.length]);
      }
    },
  });
}
