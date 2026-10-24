import { gameStore } from '../bridge/gameStore.ts';
import { changeVolume, toggleMute, VOLUME_STEP, type AudioSettings } from '../audio/settings.ts';
import { HeaderPopover } from './HeaderPopover.tsx';
import { useGameStore } from './useGameStore.ts';

// Header button that opens the settings panel: the sound effects' mute and
// volume. They live in the store, where src/audio/index.ts picks them up
// (and saves them), so changing them doesn't touch the game.
export function SettingsButton() {
  const audio = useGameStore((state) => state.audio);
  const percent = Math.round(audio.volume * 100);
  const setAudio = (update: (settings: AudioSettings) => AudioSettings) =>
    gameStore.setState((state) => ({ audio: update(state.audio) }));

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
      <div className="settings__row">
        <span className="settings__label">Volume</span>
        <div className="settings__stepper">
          <button
            type="button"
            className="header-button settings__step"
            aria-label="Lower volume"
            disabled={audio.volume < VOLUME_STEP / 2}
            onClick={() => setAudio((settings) => changeVolume(settings, -1))}
          >
            −
          </button>
          <output className="settings__value" aria-label={`Volume ${percent} percent`} data-muted={audio.muted}>
            {percent}%
          </output>
          <button
            type="button"
            className="header-button settings__step"
            aria-label="Raise volume"
            disabled={audio.volume > 1 - VOLUME_STEP / 2}
            onClick={() => setAudio((settings) => changeVolume(settings, 1))}
          >
            +
          </button>
        </div>
      </div>
    </HeaderPopover>
  );
}
