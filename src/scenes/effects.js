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
