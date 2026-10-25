// The player's sound settings, kept in the browser's localStorage so they
// survive reloads (see src/data/customStorage.ts for why every access is
// guarded).

import type { KeyValueStorage } from '../data/customStorage.ts';

export interface AudioSettings {
  muted: boolean;
  // Sound effect volume, 0–1 in VOLUME_STEP steps.
  volume: number;
  // Music volume, the same way.
  musicVolume: number;
}

// The two volumes a player can set.
export type VolumeChannel = 'volume' | 'musicVolume';

export const VOLUME_STEP = 0.1;

export const DEFAULT_AUDIO_SETTINGS: Readonly<AudioSettings> = Object.freeze({
  muted: false,
  volume: 0.6,
  musicVolume: 0.4,
});

const STORAGE_KEY = 'rogue-emblem:audio';

// Snaps a volume to the nearest step between 0 and 1.
export function clampVolume(volume: number): number {
  if (!Number.isFinite(volume)) return DEFAULT_AUDIO_SETTINGS.volume;
  const steps = Math.round(Math.min(1, Math.max(0, volume)) / VOLUME_STEP);
  return Math.round(steps * VOLUME_STEP * 10) / 10;
}

// Turns a volume (sound effects by default) up or down a step. Changing it
// unmutes, since a player reaching for the volume wants to hear the change.
export function changeVolume(
  settings: AudioSettings,
  direction: -1 | 1,
  channel: VolumeChannel = 'volume',
): AudioSettings {
  return { ...settings, muted: false, [channel]: clampVolume(settings[channel] + direction * VOLUME_STEP) };
}

// Turns the volume up a step, wrapping from full back to silent: for a
// single button (or Enter) that has to reach every volume.
export function cycleVolume(settings: AudioSettings, channel: VolumeChannel = 'volume'): AudioSettings {
  return settings[channel] >= 1 ? { ...settings, muted: false, [channel]: 0 } : changeVolume(settings, 1, channel);
}

export function toggleMute(settings: AudioSettings): AudioSettings {
  return { ...settings, muted: !settings.muted };
}

// The gain to play a channel at: silent when muted, and squared so the steps
// sound even (loudness isn't linear in amplitude).
export function getChannelGain(settings: AudioSettings, channel: VolumeChannel = 'volume'): number {
  return settings.muted ? 0 : settings[channel] * settings[channel];
}

// Reads saved settings, falling back to the defaults for anything missing,
// malformed or unreadable.
export function loadAudioSettings(storage: KeyValueStorage | null): AudioSettings {
  let raw: string | null = null;
  try {
    raw = storage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    raw = null;
  }
  if (!raw) return { ...DEFAULT_AUDIO_SETTINGS };
  try {
    const parsed: unknown = JSON.parse(raw);
    const saved = typeof parsed === 'object' && parsed !== null ? (parsed as Partial<AudioSettings>) : {};
    return {
      muted: typeof saved.muted === 'boolean' ? saved.muted : DEFAULT_AUDIO_SETTINGS.muted,
      volume: typeof saved.volume === 'number' ? clampVolume(saved.volume) : DEFAULT_AUDIO_SETTINGS.volume,
      musicVolume:
        typeof saved.musicVolume === 'number' ? clampVolume(saved.musicVolume) : DEFAULT_AUDIO_SETTINGS.musicVolume,
    };
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

// Saves settings; false when storage couldn't be written.
export function saveAudioSettings(storage: KeyValueStorage | null, settings: AudioSettings): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}
