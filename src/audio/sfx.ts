// What each sound cue sounds like, as data: every sound is a few
// synthesized voices (an oscillator or a burst of noise, with a pitch sweep
// and a quick fade), so the game needs no audio files. src/audio/player.ts
// plays them with Web Audio.

import type { SoundCue } from './cues.ts';

export type Wave = 'square' | 'triangle' | 'sawtooth' | 'sine' | 'noise';

export interface Voice {
  wave: Wave;
  // Pitch in Hz at the start and end of the voice (swept exponentially).
  // For noise, the cutoff of the low-pass filter it's played through.
  from: number;
  to: number;
  // Seconds after the cue starts that this voice begins, and how long it rings.
  at: number;
  duration: number;
  // Peak loudness, 0–1, before the master volume.
  gain: number;
}

const tone = (wave: Wave, from: number, to: number, at: number, duration: number, gain: number): Voice =>
  Object.freeze({ wave, from, to, at, duration, gain });

// Notes for the jingles, in Hz.
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;
const A4 = 440;
const F4 = 349.23;
const D4 = 293.66;
const A3 = 220;

// An arpeggio: one note every `step` seconds, each ringing `length`.
const arpeggio = (wave: Wave, notes: readonly number[], step: number, length: number, gain: number): Voice[] =>
  notes.map((note, i) => tone(wave, note, note, i * step, length, gain));

export const SOUND_EFFECTS: Readonly<Record<SoundCue, readonly Voice[]>> = Object.freeze({
  // A thump with a crunch of noise on top.
  hit: [tone('square', 180, 60, 0, 0.12, 0.35), tone('noise', 3000, 400, 0, 0.1, 0.4)],
  // Like a hit, but heavier, with a bright ring after it.
  crit: [
    tone('sawtooth', 220, 40, 0, 0.22, 0.4),
    tone('noise', 5000, 300, 0, 0.18, 0.55),
    tone('square', 1320, 880, 0.03, 0.18, 0.12),
  ],
  // A whiff of air.
  miss: [tone('noise', 1200, 4000, 0, 0.16, 0.25)],
  // A rising sparkle.
  heal: arpeggio('triangle', [C5, E5, G5, C6], 0.06, 0.18, 0.25),
  // A coin: two quick high notes.
  loot: [tone('square', 988, 988, 0, 0.07, 0.15), tone('square', 1319, 1319, 0.07, 0.2, 0.15)],
  // A snap and a falling clatter.
  break: [tone('noise', 6000, 800, 0, 0.12, 0.4), tone('square', 600, 120, 0.02, 0.25, 0.18)],
  // A shimmer for learning a spell.
  learn: arpeggio('sine', [G5, C6, G5 * 2], 0.07, 0.25, 0.2),
  // A falling groan and a burst.
  defeat: [tone('sawtooth', 300, 50, 0, 0.45, 0.3), tone('noise', 2000, 100, 0.05, 0.4, 0.35)],
  // A soft rising tick for the XP bar.
  experience: [tone('triangle', 600, 1200, 0, 0.25, 0.12)],
  // A short fanfare.
  levelUp: [
    ...arpeggio('square', [C5, E5, G5], 0.08, 0.1, 0.14),
    tone('square', C6, C6, 0.24, 0.35, 0.16),
    tone('triangle', C5, C5, 0.24, 0.35, 0.2),
  ],
  // Phase horns: bright for the player, low and ominous for the enemy.
  playerPhase: [tone('square', G5 / 2, G5 / 2, 0, 0.12, 0.14), tone('square', C5, C5, 0.12, 0.3, 0.16)],
  enemyPhase: [tone('sawtooth', A3, A3, 0, 0.14, 0.16), tone('sawtooth', A3 * 0.94, A3 * 0.94, 0.14, 0.35, 0.16)],
  guestPhase: [tone('triangle', A4, A4, 0, 0.12, 0.2), tone('triangle', E5, E5, 0.12, 0.28, 0.2)],
  victory: [
    ...arpeggio('square', [C5, E5, G5, C6], 0.12, 0.14, 0.14),
    tone('square', C6, C6, 0.48, 0.6, 0.16),
    tone('triangle', C5 / 2, C5 / 2, 0.48, 0.6, 0.25),
  ],
  gameOver: [...arpeggio('triangle', [A4, F4, D4], 0.22, 0.3, 0.22), tone('triangle', A3, A3, 0.66, 0.8, 0.22)],
  // UI blips.
  menuOpen: [tone('square', 660, 880, 0, 0.06, 0.08)],
  menuMove: [tone('square', 1200, 1200, 0, 0.03, 0.05)],
  dialog: [tone('triangle', 520, 520, 0, 0.05, 0.1)],
});

// How long a cue rings, in seconds: until its last voice ends.
export function getSoundLength(voices: readonly Voice[]): number {
  return voices.reduce((longest, voice) => Math.max(longest, voice.at + voice.duration), 0);
}
