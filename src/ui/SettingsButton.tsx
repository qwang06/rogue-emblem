import type { CSSProperties } from 'react';
import { gameStore } from '../bridge/gameStore.ts';
import { FEATURE_FLAGS } from '../featureFlags.ts';
import { changeVolume, toggleMute, VOLUME_STEP, type AudioSettings, type VolumeChannel } from '../audio/settings.ts';
import { GlyphIcon, type GlyphKind } from './GlyphIcon.tsx';
import { HeaderPopover } from './HeaderPopover.tsx';
import { useGameStore } from './useGameStore.ts';

type AudioUpdate = (settings: AudioSettings) => AudioSettings;

const setAudio = (update: AudioUpdate) => gameStore.setState((state) => ({ audio: update(state.audio) }));

// Header button (a gear) that opens the settings panel: sound on or off (a
// checkbox), and the sound effect and music volumes (music only with its
// feature flag on). They live in the store, where src/audio/index.ts picks
// them up (and saves them), so changing them doesn't touch the game.
export function SettingsButton() {
  const audio = useGameStore((state) => state.audio);

  return (
    <HeaderPopover
      button={<GlyphIcon kind="settings" />}
      label="Settings"
      title="Settings"
      className="header-button--icon"
    >
      <div className="settings__row">
        <span className="settings__label">
          <GlyphIcon kind="music" />
          Sound
        </span>
        <button
          type="button"
          role="switch"
          className="settings__toggle"
          aria-checked={!audio.muted}
          aria-label="Sound"
          title={audio.muted ? 'Sound off' : 'Sound on'}
          onClick={() => setAudio(toggleMute)}
        />
      </div>
      <VolumeRow label="Effects" icon="skill" channel="volume" audio={audio} />
      {FEATURE_FLAGS.music && <VolumeRow label="Music" icon="music" channel="musicVolume" audio={audio} />}
    </HeaderPopover>
  );
}

// One volume with − and + buttons either side of a slider showing it (the
// sheet's bar trough with a teal fill and an orange knob); the percentage
// is there for screen readers.
function VolumeRow({
  label,
  icon,
  channel,
  audio,
}: {
  label: string;
  icon: GlyphKind;
  channel: VolumeChannel;
  audio: AudioSettings;
}) {
  const value = audio[channel];
  const percent = Math.round(value * 100);
  return (
    <div className="settings__row">
      <span className="settings__label">
        <GlyphIcon kind={icon} />
        {label}
      </span>
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
        <output
          className="settings__slider"
          aria-label={`${label} volume ${percent} percent`}
          title={`${percent}%`}
          data-muted={audio.muted}
          style={{ '--level': value } as CSSProperties}
        >
          <span className="settings__slider-fill" />
          <span className="settings__slider-knob" />
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
