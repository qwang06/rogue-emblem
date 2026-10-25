import { describe, expect, it } from 'vitest';
import { memoryStorage, throwingStorage } from '../data/testStorage.ts';
import {
  changeVolume,
  clampVolume,
  cycleVolume,
  DEFAULT_AUDIO_SETTINGS,
  getChannelGain,
  loadAudioSettings,
  saveAudioSettings,
  toggleMute,
  type AudioSettings,
} from './settings.ts';

const settings = (overrides: Partial<AudioSettings> = {}): AudioSettings => ({
  muted: false,
  volume: 0.5,
  musicVolume: 0.5,
  ...overrides,
});

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
    let current = settings({ volume: 0 });
    for (let i = 0; i < 3; i++) current = changeVolume(current, 1);
    expect(current.volume).toBe(0.3);
    expect(changeVolume(current, -1).volume).toBe(0.2);
  });

  it('stops at the ends', () => {
    expect(changeVolume(settings({ volume: 1 }), 1).volume).toBe(1);
    expect(changeVolume(settings({ volume: 0 }), -1).volume).toBe(0);
  });

  it('unmutes', () => {
    expect(changeVolume(settings({ muted: true }), 1).muted).toBe(false);
  });

  it('changes only the channel asked for', () => {
    expect(changeVolume(settings(), 1, 'musicVolume')).toEqual(settings({ musicVolume: 0.6 }));
    expect(changeVolume(settings(), -1)).toEqual(settings({ volume: 0.4 }));
  });
});

describe('cycleVolume', () => {
  it('steps up, and wraps from full to silent', () => {
    expect(cycleVolume(settings())).toEqual(settings({ volume: 0.6 }));
    expect(cycleVolume(settings({ muted: true, volume: 1 }))).toEqual(settings({ volume: 0 }));
  });

  it('cycles the music volume on its own', () => {
    expect(cycleVolume(settings({ musicVolume: 1 }), 'musicVolume')).toEqual(settings({ musicVolume: 0 }));
  });
});

describe('toggleMute', () => {
  it('flips mute and keeps the volumes', () => {
    expect(toggleMute(settings({ volume: 0.7 }))).toEqual(settings({ muted: true, volume: 0.7 }));
    expect(toggleMute(settings({ muted: true }))).toEqual(settings());
  });
});

describe('getChannelGain', () => {
  it('is silent when muted or at zero', () => {
    expect(getChannelGain(settings({ muted: true, volume: 1, musicVolume: 1 }))).toBe(0);
    expect(getChannelGain(settings({ muted: true, musicVolume: 1 }), 'musicVolume')).toBe(0);
    expect(getChannelGain(settings({ volume: 0 }))).toBe(0);
  });

  it('is full at full volume and quieter than linear in between', () => {
    expect(getChannelGain(settings({ volume: 1 }))).toBe(1);
    expect(getChannelGain(settings({ volume: 0.5 }))).toBeLessThan(0.5);
  });

  it('reads the channel asked for', () => {
    expect(getChannelGain(settings({ volume: 1, musicVolume: 0 }), 'musicVolume')).toBe(0);
  });
});

describe('loadAudioSettings / saveAudioSettings', () => {
  it('round-trips through storage', () => {
    const storage = memoryStorage();
    const saved = settings({ muted: true, volume: 0.3, musicVolume: 0.8 });
    expect(saveAudioSettings(storage, saved)).toBe(true);
    expect(loadAudioSettings(storage)).toEqual(saved);
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
      ...DEFAULT_AUDIO_SETTINGS,
      muted: true,
    });
    expect(loadAudioSettings(memoryStorage({ 'rogue-emblem:audio': '{"volume":4,"musicVolume":-1}' }))).toEqual({
      muted: false,
      volume: 1,
      musicVolume: 0,
    });
  });

  it('gives saves from before music the default music volume', () => {
    expect(loadAudioSettings(memoryStorage({ 'rogue-emblem:audio': '{"muted":false,"volume":0.3}' }))).toEqual({
      muted: false,
      volume: 0.3,
      musicVolume: DEFAULT_AUDIO_SETTINGS.musicVolume,
    });
  });
});
