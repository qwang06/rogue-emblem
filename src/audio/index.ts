// Starts the game's sound: loads the player's sound settings into the
// store, keeps them saved, plays a sound for every cue a store change
// raises (getSoundCues) and keeps the music on the track that fits
// (getMusicTrack) when the music feature flag is on.

import { gameStore, type GameState } from '../bridge/gameStore.ts';
import { FEATURE_FLAGS } from '../featureFlags.ts';
import { browserStorage } from '../data/customStorage.ts';
import { getAmbience } from './ambience.ts';
import { getSoundCues } from './cues.ts';
import { createMusicPlayer, type MusicPlayer } from './musicPlayer.ts';
import { getMusicTrack } from './musicTrack.ts';
import { createSoundPlayer, type SoundPlayer } from './player.ts';
import { getChannelGain, loadAudioSettings, saveAudioSettings, type AudioSettings } from './settings.ts';

export function startAudio(): void {
  const storage = browserStorage();
  gameStore.setState({ audio: loadAudioSettings(storage) });

  // Made on the first click or key press, since browsers keep audio
  // silent until one. Nothing plays before then, which is only the title.
  let sounds: SoundPlayer | null = null;
  let music: MusicPlayer | null = null;
  const applyVolumes = (audio: AudioSettings) => {
    sounds?.setMasterGain(getChannelGain(audio, 'volume'));
    music?.setVolume(getChannelGain(audio, 'musicVolume'));
  };
  const unlock = () => {
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
    const AudioContextClass = typeof window === 'undefined' ? undefined : window.AudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    sounds = createSoundPlayer(context, context.destination);
    music = FEATURE_FLAGS.music ? createMusicPlayer(context, context.destination) : null;
    const state = gameStore.getState();
    applyVolumes(state.audio);
    music?.play(getMusicTrack(state));
    sounds.setAmbience(getAmbience(state));
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  // Every click on a button in the React UI clicks, wherever it is (the
  // title, the overworld, the camp's screens). A click that also opens or
  // closes a menu plays the one click (see REPEAT_S in player.ts).
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('button:not(:disabled), [role="button"], [role="menuitem"], [role="option"]'))
      sounds?.play('button');
  });

  let prev: GameState = gameStore.getState();
  gameStore.subscribe((next) => {
    if (next.audio !== prev.audio) {
      saveAudioSettings(storage, next.audio);
      applyVolumes(next.audio);
      // A blip at the new volume, so the player hears what they picked.
      if (next.audio.volume !== prev.audio.volume || next.audio.muted !== prev.audio.muted) sounds?.play('menuMove');
    }
    if (sounds) for (const cue of getSoundCues(prev, next)) sounds.play(cue);
    music?.play(getMusicTrack(next));
    sounds?.setAmbience(getAmbience(next));
    prev = next;
  });
}
