import { describe, expect, it } from 'vitest';
import { memoryStorage, throwingStorage } from '../data/testStorage.ts';
import {
  changeVolume,
  clampVolume,
  cycleVolume,
  DEFAULT_AUDIO_SETTINGS,
  getMasterGain,
  loadAudioSettings,
  saveAudioSettings,
  toggleMute,
} from './settings.ts';

describe('clampVolume', () => {
  it('snaps to the nearest step', () => {
    expect(clampVolume(0.44)).toBe(0.4);
    expect(clampVolume(0.46)).toBe(0.5);
  });

  it('keeps it between 0 and 1', () => {
    expect(clampVolume(-0.3)).toBe(0);
    expect(clampVolume(1.7)).toBe(1);
  });

  it('falls back to the default for nonsense', () => {
    expect(clampVolume(Number.NaN)).toBe(DEFAULT_AUDIO_SETTINGS.volume);
  });
});

describe('changeVolume', () => {
  it('steps up and down without float drift', () => {
    let settings = { muted: false, volume: 0 };
    for (let i = 0; i < 3; i++) settings = changeVolume(settings, 1);
    expect(settings.volume).toBe(0.3);
    expect(changeVolume(settings, -1).volume).toBe(0.2);
  });

  it('stops at the ends', () => {
    expect(changeVolume({ muted: false, volume: 1 }, 1).volume).toBe(1);
    expect(changeVolume({ muted: false, volume: 0 }, -1).volume).toBe(0);
  });

  it('unmutes', () => {
    expect(changeVolume({ muted: true, volume: 0.5 }, 1).muted).toBe(false);
  });
});

describe('cycleVolume', () => {
  it('steps up, and wraps from full to silent', () => {
    expect(cycleVolume({ muted: false, volume: 0.5 })).toEqual({ muted: false, volume: 0.6 });
    expect(cycleVolume({ muted: true, volume: 1 })).toEqual({ muted: false, volume: 0 });
  });
});

describe('toggleMute', () => {
  it('flips mute and keeps the volume', () => {
    expect(toggleMute({ muted: false, volume: 0.7 })).toEqual({ muted: true, volume: 0.7 });
    expect(toggleMute({ muted: true, volume: 0.7 })).toEqual({ muted: false, volume: 0.7 });
  });
});

describe('getMasterGain', () => {
  it('is silent when muted or at zero', () => {
    expect(getMasterGain({ muted: true, volume: 1 })).toBe(0);
    expect(getMasterGain({ muted: false, volume: 0 })).toBe(0);
  });

  it('is full at full volume and quieter than linear in between', () => {
    expect(getMasterGain({ muted: false, volume: 1 })).toBe(1);
    expect(getMasterGain({ muted: false, volume: 0.5 })).toBeLessThan(0.5);
  });
});

describe('loadAudioSettings / saveAudioSettings', () => {
  it('round-trips through storage', () => {
    const storage = memoryStorage();
    expect(saveAudioSettings(storage, { muted: true, volume: 0.3 })).toBe(true);
    expect(loadAudioSettings(storage)).toEqual({ muted: true, volume: 0.3 });
  });

  it('gives the defaults with nothing saved or no storage', () => {
    expect(loadAudioSettings(memoryStorage())).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(loadAudioSettings(null)).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(saveAudioSettings(null, DEFAULT_AUDIO_SETTINGS)).toBe(false);
  });

  it('survives storage that throws', () => {
    expect(loadAudioSettings(throwingStorage)).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(saveAudioSettings(throwingStorage, DEFAULT_AUDIO_SETTINGS)).toBe(false);
  });

  it('ignores malformed or partial saves field by field', () => {
    expect(loadAudioSettings(memoryStorage({ 'rogue-emblem:audio': 'not json' }))).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(loadAudioSettings(memoryStorage({ 'rogue-emblem:audio': '"loud"' }))).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(loadAudioSettings(memoryStorage({ 'rogue-emblem:audio': '{"muted":true,"volume":"max"}' }))).toEqual({
      muted: true,
      volume: DEFAULT_AUDIO_SETTINGS.volume,
    });
    expect(loadAudioSettings(memoryStorage({ 'rogue-emblem:audio': '{"volume":4}' }))).toEqual({
      muted: false,
      volume: 1,
    });
  });
});
