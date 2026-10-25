// The game's music, as data: short chiptune loops written as note
// patterns, synthesized at play time (src/audio/musicPlayer.ts), so the
// game needs no audio files. getMusicTrack (musicTrack.ts) picks which one
// plays.

import type { Wave } from './sfx.ts';

export type TrackId = 'title' | 'march' | 'camp' | 'battle' | 'enemy';

// Every bar is STEPS_PER_BAR eighth notes. In a melodic line each step is a
// note ("A4", "F#5", "Bb3"), "-" to hold the note before, or "." for a
// rest. In a drum lane each step is "x" (hit) or "." (none).
export const STEPS_PER_BAR = 8;

export interface Line {
  wave: Wave;
  gain: number;
  bars: readonly string[];
}

export interface Drums {
  // One bar each, repeated for the whole loop.
  kick: string;
  snare: string;
  hat: string;
  gain: number;
}

export interface Song {
  // Quarter notes per minute; steps are eighths, so two per beat.
  bpm: number;
  lead: Line;
  bass: Line;
  drums: Drums | null;
}

export interface NoteEvent {
  step: number;
  // How many steps it rings, held notes included.
  length: number;
  frequency: number;
}

const NOTE_OFFSETS: Readonly<Record<string, number>> = Object.freeze({ C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 });

// A note name like "A4", "C#5" or "Bb3" as its frequency in Hz (A4 = 440),
// or null for anything else.
export function noteFrequency(note: string): number | null {
  const match = /^([A-G])([#b]?)(-?\d)$/.exec(note);
  if (!match) return null;
  const [, letter, accidental, octave] = match;
  const semitones = NOTE_OFFSETS[letter] + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0);
  return 440 * 2 ** (Number(octave) - 4 + semitones / 12);
}

// A bar's steps: its whitespace-separated tokens.
export function barSteps(bar: string): string[] {
  return bar.trim().split(/\s+/);
}

// A melodic line's notes, in step order. "-" lengthens the note before
// it; a "-" with no note before it (or after a rest) is silence. Throws on
// a token that's no note, so a typo in the score fails the tests.
export function parseLine(bars: readonly string[]): NoteEvent[] {
  const events: NoteEvent[] = [];
  let current: NoteEvent | null = null;
  bars.flatMap(barSteps).forEach((token, step) => {
    if (token === '-') {
      if (current) current.length += 1;
      return;
    }
    if (token === '.') {
      current = null;
      return;
    }
    const frequency = noteFrequency(token);
    if (frequency === null) throw new Error(`Not a note: "${token}" at step ${step}`);
    current = { step, length: 1, frequency };
    events.push(current);
  });
  return events;
}

// The steps a drum lane hits on, within its bar.
export function parseDrumLane(lane: string): number[] {
  return [...lane.replace(/\s+/g, '')].flatMap((token, step) => (token === 'x' ? [step] : []));
}

// How many steps a song loops over: its longest line.
export function getSongLength(song: Song): number {
  return Math.max(song.lead.bars.length, song.bass.bars.length) * STEPS_PER_BAR;
}

// Seconds per step (an eighth note) at a tempo.
export function getStepSeconds(bpm: number): number {
  return 60 / bpm / 2;
}

export const SONGS: Readonly<Record<TrackId, Song>> = Object.freeze({
  // The title: a bright, heroic C major theme.
  title: {
    bpm: 100,
    lead: {
      wave: 'square',
      gain: 0.07,
      bars: [
        'E5 - - G5 C6 - B5 A5',
        'A5 - - E5 A5 - G5 E5',
        'F5 - - A5 C6 - D6 C6',
        'B5 - - - G5 - - .',
        'E5 - - G5 C6 - D6 E6',
        'E6 - D6 C6 A5 - - E5',
        'F5 - A5 C6 B5 - G5 B5',
        'C6 - - - - - . .',
      ],
    },
    bass: {
      wave: 'triangle',
      gain: 0.16,
      bars: [
        'C3 . C4 . C3 . C4 .',
        'A2 . A3 . A2 . A3 .',
        'F2 . F3 . F2 . F3 .',
        'G2 . G3 . G2 . G3 .',
        'C3 . C4 . C3 . C4 .',
        'A2 . A3 . A2 . A3 .',
        'F2 . F3 . G2 . G3 .',
        'C3 . C4 . C3 - - .',
      ],
    },
    drums: { kick: 'x . . . x . . .', snare: '. . x . . . x .', hat: '. . . . . . . .', gain: 0.12 },
  },
  // Crossing the realm: a striding G major march.
  march: {
    bpm: 112,
    lead: {
      wave: 'square',
      gain: 0.06,
      bars: [
        'G4 - B4 D5 G5 - D5 B4',
        'C5 - E5 G5 E5 - C5 .',
        'D5 - F#5 A5 F#5 - D5 .',
        'G5 - - - D5 - B4 .',
        'E5 - G5 B5 G5 - E5 .',
        'C5 - E5 G5 C6 - B5 A5',
        'A5 - G5 F#5 E5 - F#5 A5',
        'G5 - - - G4 - . .',
      ],
    },
    bass: {
      wave: 'triangle',
      gain: 0.16,
      bars: [
        'G2 . D3 . G2 . D3 .',
        'C3 . G3 . C3 . G3 .',
        'D3 . A3 . D3 . A3 .',
        'G2 . D3 . G2 . D3 .',
        'E2 . B2 . E2 . B2 .',
        'C3 . G3 . C3 . G3 .',
        'D3 . A3 . D3 . A3 .',
        'G2 . D3 . G2 . . .',
      ],
    },
    drums: { kick: 'x . . . x . . .', snare: '. . x . . . x x', hat: '. . . . . . . .', gain: 0.12 },
  },
  // Camp and deployment: a gentle F major rest.
  camp: {
    bpm: 88,
    lead: {
      wave: 'triangle',
      gain: 0.14,
      bars: [
        'A4 - C5 - F5 - E5 D5',
        'D5 - - - A4 - - .',
        'Bb4 - D5 - F5 - G5 F5',
        'E5 - - - C5 - - .',
        'A4 - C5 - F5 - A5 G5',
        'F5 - D5 - A4 - D5 -',
        'D5 - C5 Bb4 G4 - Bb4 D5',
        'C5 - - - - - . .',
      ],
    },
    bass: {
      wave: 'triangle',
      gain: 0.13,
      bars: [
        'F2 - - - C3 - - -',
        'D2 - - - A2 - - -',
        'Bb2 - - - F2 - - -',
        'C3 - - - G2 - - -',
        'F2 - - - C3 - - -',
        'D2 - - - A2 - - -',
        'Bb2 - - - C3 - - -',
        'F2 - - - - - . .',
      ],
    },
    drums: null,
  },
  // The player's phase: a driving A minor battle theme.
  battle: {
    bpm: 140,
    lead: {
      wave: 'square',
      gain: 0.06,
      bars: [
        'A4 . A4 C5 E5 - D5 C5',
        'F5 - E5 - C5 - A4 .',
        'G4 . G4 B4 D5 - C5 B4',
        'E5 - - - G#4 - B4 -',
        'A4 . A4 C5 E5 - A5 -',
        'F5 - E5 F5 G5 - F5 E5',
        'D5 - C5 D5 B4 - G4 B4',
        'E5 - - - E4 - . .',
      ],
    },
    bass: {
      wave: 'triangle',
      gain: 0.17,
      bars: [
        'A2 A3 A2 A3 A2 A3 A2 A3',
        'F2 F3 F2 F3 F2 F3 F2 F3',
        'G2 G3 G2 G3 G2 G3 G2 G3',
        'E2 E3 E2 E3 E2 E3 E2 E3',
        'A2 A3 A2 A3 A2 A3 A2 A3',
        'F2 F3 F2 F3 F2 F3 F2 F3',
        'G2 G3 G2 G3 G2 G3 G2 G3',
        'E2 E3 E2 E3 E2 E3 E2 E3',
      ],
    },
    drums: { kick: 'x . . . x x . .', snare: '. . x . . . x .', hat: 'x x x x x x x x', gain: 0.1 },
  },
  // The enemy's phase: an ominous D minor theme.
  enemy: {
    bpm: 128,
    lead: {
      wave: 'sawtooth',
      gain: 0.045,
      bars: [
        'D5 - - A4 D5 - E5 F5',
        'F5 - E5 D5 Bb4 - - .',
        'G4 - Bb4 D5 G5 - F5 E5',
        'E5 - - - C#5 - A4 .',
        'D5 - - A4 D5 - F5 A5',
        'Bb5 - A5 G5 F5 - D5 .',
        'G5 - F5 E5 D5 - E5 F5',
        'E5 - - - A4 - . .',
      ],
    },
    bass: {
      wave: 'triangle',
      gain: 0.18,
      bars: [
        'D2 . D3 D2 . D2 D3 .',
        'Bb1 . Bb2 Bb1 . Bb1 Bb2 .',
        'G2 . G3 G2 . G2 G3 .',
        'A2 . A3 A2 . A2 A3 .',
        'D2 . D3 D2 . D2 D3 .',
        'Bb1 . Bb2 Bb1 . Bb1 Bb2 .',
        'G2 . G3 G2 . G2 G3 .',
        'A2 . A3 A2 . A2 A3 .',
      ],
    },
    drums: { kick: 'x . . x . . x .', snare: '. . . . x . . .', hat: 'x . x . x . x .', gain: 0.1 },
  },
});
