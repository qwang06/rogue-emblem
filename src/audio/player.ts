// Plays the synthesized sounds from src/audio/sfx.ts with Web Audio. This
// is the thin, untested layer: which sounds play is decided in cues.ts and
// what they sound like in sfx.ts.

import type { SoundCue } from './cues.ts';
import { SOUND_EFFECTS, type Voice } from './sfx.ts';

// Gain can't ramp to exactly 0 exponentially, so voices fade to this.
const SILENT = 0.0001;
const ATTACK_S = 0.005;

export interface SoundPlayer {
  play(cue: SoundCue): void;
  setMasterGain(gain: number): void;
}

// Browsers only let audio start after a click or key press, so create the
// player from one. Null where there's no Web Audio.
export function createSoundPlayer(): SoundPlayer | null {
  const AudioContextClass = typeof window === 'undefined' ? undefined : window.AudioContext;
  if (!AudioContextClass) return null;
  const context = new AudioContextClass();
  const master = context.createGain();
  master.connect(context.destination);
  let masterGain = 1;
  let noise: AudioBuffer | null = null;

  // One second of white noise, shared by every noise voice.
  function getNoise(): AudioBuffer {
    if (noise) return noise;
    noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return noise;
  }

  function playVoice(voice: Voice, start: number) {
    const begin = start + voice.at;
    const end = begin + voice.duration;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(SILENT, begin);
    envelope.gain.exponentialRampToValueAtTime(voice.gain, begin + ATTACK_S);
    envelope.gain.exponentialRampToValueAtTime(SILENT, end);
    envelope.connect(master);

    let source: AudioScheduledSourceNode;
    if (voice.wave === 'noise') {
      const buffer = context.createBufferSource();
      buffer.buffer = getNoise();
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(voice.from, begin);
      filter.frequency.exponentialRampToValueAtTime(voice.to, end);
      buffer.connect(filter).connect(envelope);
      source = buffer;
    } else {
      const oscillator = context.createOscillator();
      oscillator.type = voice.wave;
      oscillator.frequency.setValueAtTime(voice.from, begin);
      oscillator.frequency.exponentialRampToValueAtTime(voice.to, end);
      oscillator.connect(envelope);
      source = oscillator;
    }
    source.onended = () => envelope.disconnect();
    source.start(begin);
    source.stop(end + 0.02);
  }

  return {
    play(cue) {
      if (masterGain === 0) return;
      if (context.state === 'suspended') void context.resume();
      const now = context.currentTime;
      for (const voice of SOUND_EFFECTS[cue]) playVoice(voice, now);
    },
    setMasterGain(gain) {
      masterGain = gain;
      master.gain.setValueAtTime(gain, context.currentTime);
    },
  };
}
