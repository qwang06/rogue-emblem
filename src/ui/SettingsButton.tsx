import { gameStore } from '../bridge/gameStore.ts';
import { FEATURE_FLAGS } from '../featureFlags.ts';
import { changeVolume, toggleMute, VOLUME_STEP, type AudioSettings, type VolumeChannel } from '../audio/settings.ts';
import { HeaderPopover } from './HeaderPopover.tsx';
import { useGameStore } from './useGameStore.ts';

type AudioUpdate = (settings: AudioSettings) => AudioSettings;

const setAudio = (update: AudioUpdate) => gameStore.setState((state) => ({ audio: update(state.audio) }));

// Header button that opens the settings panel: sound on or off, and the
// sound effect and music volumes (music only with its feature flag on). They live in the store, where
// src/audio/index.ts picks them up (and saves them), so changing them
// doesn't touch the game.
export function SettingsButton() {
  const audio = useGameStore((state) => state.audio);

  return (
    <HeaderPopover button="Settings" title="Settings">
      <div className="settings__row">
        <span className="settings__label">Sound</span>
        <button
          type="button"
          className="header-button settings__toggle"
          aria-pressed={!audio.muted}
          onClick={() => setAudio(toggleMute)}
        >
          {audio.muted ? 'Off' : 'On'}
        </button>
      </div>
      <VolumeRow label="Effects" channel="volume" audio={audio} />
      {FEATURE_FLAGS.music && <VolumeRow label="Music" channel="musicVolume" audio={audio} />}
    </HeaderPopover>
  );
}

// One volume with − and + buttons either side of its percentage.
function VolumeRow({ label, channel, audio }: { label: string; channel: VolumeChannel; audio: AudioSettings }) {
  const value = audio[channel];
  const percent = Math.round(value * 100);
  return (
    <div className="settings__row">
      <span className="settings__label">{label}</span>
      <div className="settings__stepper">
        <button
          type="button"
          className="header-button settings__step"
          aria-label={`Lower ${label.toLowerCase()} volume`}
          disabled={value < VOLUME_STEP / 2}
          onClick={() => setAudio((settings) => changeVolume(settings, -1, channel))}
        >
          −
        </button>
        <output className="settings__value" aria-label={`${label} volume ${percent} percent`} data-muted={audio.muted}>
          {percent}%
        </output>
        <button
          type="button"
          className="header-button settings__step"
          aria-label={`Raise ${label.toLowerCase()} volume`}
          disabled={value > 1 - VOLUME_STEP / 2}
          onClick={() => setAudio((settings) => changeVolume(settings, 1, channel))}
        >
          +
        </button>
      </div>
    </div>
  );
}
