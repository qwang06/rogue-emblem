// Starts the game's sound: loads the player's sound settings into the
// store, keeps them saved, and plays a sound for every cue a store change
// raises (getSoundCues).

import { gameStore, type GameState } from '../bridge/gameStore.ts';
import { browserStorage } from '../data/customStorage.ts';
import { getSoundCues } from './cues.ts';
import { createSoundPlayer, type SoundPlayer } from './player.ts';
import { getMasterGain, loadAudioSettings, saveAudioSettings } from './settings.ts';

export function startAudio(): void {
  const storage = browserStorage();
  gameStore.setState({ audio: loadAudioSettings(storage) });

  // Made on the first click or key press, since browsers keep audio
  // silent until one. Nothing plays before then, which is only the title.
  let player: SoundPlayer | null = null;
  const unlock = () => {
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
    player = createSoundPlayer();
    player?.setMasterGain(getMasterGain(gameStore.getState().audio));
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  let prev: GameState = gameStore.getState();
  gameStore.subscribe((next) => {
    if (next.audio !== prev.audio) {
      saveAudioSettings(storage, next.audio);
      player?.setMasterGain(getMasterGain(next.audio));
      // A blip at the new volume, so the player hears what they picked.
      player?.play('menuMove');
    }
    if (player) for (const cue of getSoundCues(prev, next)) player.play(cue);
    prev = next;
  });
}
