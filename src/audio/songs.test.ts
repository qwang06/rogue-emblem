import { describe, expect, it } from 'vitest';
import {
  barSteps,
  getSongLength,
  getStepSeconds,
  noteFrequency,
  parseDrumLane,
  parseLine,
  SONGS,
  STEPS_PER_BAR,
} from './songs.ts';

describe('noteFrequency', () => {
  it('tunes A4 to 440 Hz and octaves by doubling', () => {
    expect(noteFrequency('A4')).toBe(440);
    expect(noteFrequency('A5')).toBe(880);
    expect(noteFrequency('A2')).toBe(110);
  });

  it('reads naturals, sharps and flats', () => {
    expect(noteFrequency('C4')).toBeCloseTo(261.63, 1);
    expect(noteFrequency('C#5')).toBeCloseTo(554.37, 1);
    expect(noteFrequency('Bb3')).toBeCloseTo(233.08, 1);
    expect(noteFrequency('G#4')).toBeCloseTo(noteFrequency('Ab4')!, 6);
  });

  it('rejects anything that is not a note', () => {
    expect(noteFrequency('H4')).toBeNull();
    expect(noteFrequency('A')).toBeNull();
    expect(noteFrequency('-')).toBeNull();
    expect(noteFrequency('a4')).toBeNull();
  });
});

describe('parseLine', () => {
  it('turns notes into events at their steps', () => {
    expect(parseLine(['A4 . C5 .'])).toEqual([
      { step: 0, length: 1, frequency: 440 },
      { step: 2, length: 1, frequency: noteFrequency('C5') },
    ]);
  });

  it('lengthens a note for each hold after it, across bars', () => {
    expect(parseLine(['A4 - -', '- . A5'])).toEqual([
      { step: 0, length: 4, frequency: 440 },
      { step: 5, length: 1, frequency: 880 },
    ]);
  });

  it('treats a hold after a rest or at the start as silence', () => {
    expect(parseLine(['- A4 . - A5'])).toEqual([
      { step: 1, length: 1, frequency: 440 },
      { step: 4, length: 1, frequency: 880 },
    ]);
  });

  it('throws on a typo, naming it', () => {
    expect(() => parseLine(['A4 Q4'])).toThrow('Q4');
  });

  it('gives nothing for an empty line', () => {
    expect(parseLine([])).toEqual([]);
  });
});

describe('parseDrumLane', () => {
  it('lists the steps hit', () => {
    expect(parseDrumLane('x . . x . x . .')).toEqual([0, 3, 5]);
    expect(parseDrumLane('. . . .')).toEqual([]);
  });
});

describe('getStepSeconds', () => {
  it('is an eighth note', () => {
    expect(getStepSeconds(120)).toBe(0.25);
    expect(getStepSeconds(60)).toBe(0.5);
  });
});

describe('SONGS', () => {
  for (const [id, song] of Object.entries(SONGS)) {
    describe(id, () => {
      it('has full bars of notes that all parse', () => {
        for (const line of [song.lead, song.bass]) {
          for (const bar of line.bars) expect(barSteps(bar), bar).toHaveLength(STEPS_PER_BAR);
          expect(parseLine(line.bars).length).toBeGreaterThan(0);
        }
      });

      it('has lead and bass of the same length, so the loop lines up', () => {
        expect(song.lead.bars.length).toBe(song.bass.bars.length);
        expect(getSongLength(song)).toBe(song.lead.bars.length * STEPS_PER_BAR);
      });

      it('has one-bar drum lanes', () => {
        if (!song.drums) return;
        for (const lane of [song.drums.kick, song.drums.snare, song.drums.hat])
          expect(barSteps(lane)).toHaveLength(STEPS_PER_BAR);
      });

      it('stays quiet under the sound effects and in a playable range', () => {
        expect(song.bpm).toBeGreaterThanOrEqual(60);
        expect(song.bpm).toBeLessThanOrEqual(180);
        for (const line of [song.lead, song.bass]) {
          expect(line.gain).toBeGreaterThan(0);
          expect(line.gain).toBeLessThanOrEqual(0.2);
          for (const note of parseLine(line.bars)) {
            expect(note.frequency).toBeGreaterThanOrEqual(50);
            expect(note.frequency).toBeLessThanOrEqual(2100);
          }
        }
      });
    });
  }
});
