import { describe, expect, it } from 'vitest';
import { getSoundLength, SOUND_EFFECTS } from './sfx.ts';

describe('SOUND_EFFECTS', () => {
  it('gives every cue at least one playable voice', () => {
    for (const [cue, voices] of Object.entries(SOUND_EFFECTS)) {
      expect(voices.length, cue).toBeGreaterThan(0);
      for (const voice of voices) {
        // Exponential ramps need positive values on both ends.
        expect(voice.from, cue).toBeGreaterThan(0);
        expect(voice.to, cue).toBeGreaterThan(0);
        expect(voice.at, cue).toBeGreaterThanOrEqual(0);
        expect(voice.duration, cue).toBeGreaterThan(0);
        expect(voice.gain, cue).toBeGreaterThan(0);
        expect(voice.gain, cue).toBeLessThanOrEqual(1);
      }
    }
  });

  it('keeps combat and menu sounds short, so they never pile up', () => {
    for (const cue of ['hit', 'crit', 'miss', 'menuOpen', 'menuMove', 'dialog'] as const)
      expect(getSoundLength(SOUND_EFFECTS[cue]), cue).toBeLessThanOrEqual(0.3);
  });
});

describe('getSoundLength', () => {
  it('is when the last voice ends', () => {
    expect(
      getSoundLength([
        { wave: 'sine', from: 1, to: 1, at: 0, duration: 0.2, gain: 1 },
        { wave: 'sine', from: 1, to: 1, at: 0.3, duration: 0.1, gain: 1 },
      ]),
    ).toBeCloseTo(0.4);
  });

  it('is zero for no voices', () => {
    expect(getSoundLength([])).toBe(0);
  });
});
