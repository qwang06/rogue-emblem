// How hard each blow lands on screen: the freeze on contact (hit-stop), the
// camera shake and how far the striker lunges. Pure numbers for
// effects.ts and GridScene to play, so the feel can be tuned and tested
// without Phaser. Durations are at 1x; the scene clock scales them by the
// game speed.

export interface Shake {
  durationMs: number;
  intensity: number;
}

export interface StrikeJuice {
  // How long both units freeze when the blow connects.
  hitStopMs: number;
  // The camera shake on contact, or null for none.
  shake: Shake | null;
}

export interface StrikeImpact {
  hit: boolean;
  crit: boolean;
  // Whether the blow defeats the struck unit.
  lethal: boolean;
}

const HIT_STOP_MS = 60;
const CRIT_HIT_STOP_MS = 130;
// A finishing blow holds a little longer, so the kill registers.
const LETHAL_HIT_STOP_BONUS_MS = 50;

export const CRIT_SHAKE: Readonly<Shake> = Object.freeze({ durationMs: 220, intensity: 0.012 });
// A light bump for a finishing blow that isn't a crit.
const LETHAL_SHAKE: Readonly<Shake> = Object.freeze({ durationMs: 120, intensity: 0.005 });

// What a strike looks like when it lands. With reduced motion the camera
// never shakes; the freeze stays, since nothing moves during it.
export function getStrikeJuice({ hit, crit, lethal }: StrikeImpact, reducedMotion: boolean): StrikeJuice {
  if (!hit) return { hitStopMs: 0, shake: null };
  const hitStopMs = (crit ? CRIT_HIT_STOP_MS : HIT_STOP_MS) + (lethal ? LETHAL_HIT_STOP_BONUS_MS : 0);
  const shake = reducedMotion ? null : crit ? CRIT_SHAKE : lethal ? LETHAL_SHAKE : null;
  return { hitStopMs, shake };
}

const MELEE_LUNGE_PX = 10;
// A ranged attacker only leans in, since its blow lands from afar.
const RANGED_LUNGE_PX = 4;
const REDUCED_LUNGE_PX = 3;

// How far the striker darts toward a target `tiles` away (grid distance).
export function getLungeDistance(tiles: number, reducedMotion: boolean): number {
  if (reducedMotion) return REDUCED_LUNGE_PX;
  return tiles <= 1 ? MELEE_LUNGE_PX : RANGED_LUNGE_PX;
}
