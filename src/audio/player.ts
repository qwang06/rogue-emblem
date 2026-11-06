// Plays the sound cues with Web Audio: a cue's recorded sample
// (samples.ts) once it has loaded, else its synthesized voices (sfx.ts),
// plus a looping ambience under it all. This is the thin, untested layer:
// which sounds play is decided in cues.ts and ambience.ts.

import type { SoundCue } from './cues.ts';
import { AMBIENCE_URLS, SAMPLE_URLS, type AmbienceId } from './samples.ts';
import { SOUND_EFFECTS, type Voice } from './sfx.ts';

// Gain can't ramp to exactly 0 exponentially, so voices fade to this.
const SILENT = 0.0001;
const ATTACK_S = 0.005;
// The same cue raised twice this close together (a mouse click on a menu
// that also opens one) plays once.
const REPEAT_S = 0.06;
const AMBIENCE_GAIN = 0.35;
const AMBIENCE_FADE_S = 1;

export interface SoundPlayer {
  play(cue: SoundCue): void;
  setAmbience(id: AmbienceId | null): void;
  setMasterGain(gain: number): void;
}

// Fetches and decodes every sample, filling `into` as each one arrives. A
// sample that fails to load is left out, so its cue stays synthesized.
function loadSamples<K extends string>(
  context: AudioContext,
  urls: Readonly<Partial<Record<K, string>>>,
  into: Map<K, AudioBuffer>,
  onLoad?: (key: K) => void,
) {
  for (const [key, url] of Object.entries(urls) as [K, string][]) {
    fetch(url)
      .then((response) => response.arrayBuffer())
      .then((data) => context.decodeAudioData(data))
      .then((buffer) => {
        into.set(key, buffer);
        onLoad?.(key);
      })
      .catch(() => {});
  }
}

// Plays sound effects into `destination` through its own volume.
export function createSoundPlayer(context: AudioContext, destination: AudioNode): SoundPlayer {
  const master = context.createGain();
  master.connect(destination);
  let masterGain = 1;
  let noise: AudioBuffer | null = null;
  const samples = new Map<SoundCue, AudioBuffer>();
  const lastPlayed = new Map<SoundCue, number>();
  loadSamples(context, SAMPLE_URLS, samples);

  const ambiences = new Map<AmbienceId, AudioBuffer>();
  let wantedAmbience: AmbienceId | null = null;
  let ambience: { id: AmbienceId; source: AudioBufferSourceNode; gain: GainNode } | null = null;

  function startAmbience() {
    const id = wantedAmbience;
    if (ambience?.id === id) return;
    if (ambience) {
      const { source, gain } = ambience;
      const now = context.currentTime;
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + AMBIENCE_FADE_S);
      source.stop(now + AMBIENCE_FADE_S + 0.05);
      source.onended = () => gain.disconnect();
      ambience = null;
    }
    const buffer = id && ambiences.get(id);
    if (!id || !buffer) return;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = context.createGain();
    const now = context.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(AMBIENCE_GAIN, now + AMBIENCE_FADE_S);
    source.connect(gain).connect(master);
    source.start(now);
    ambience = { id, source, gain };
  }
  loadSamples(context, AMBIENCE_URLS, ambiences, (id) => {
    if (id === wantedAmbience) startAmbience();
  });

  function playSample(buffer: AudioBuffer, start: number) {
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(master);
    source.start(start);
  }

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
      const last = lastPlayed.get(cue);
      if (last !== undefined && now - last < REPEAT_S) return;
      lastPlayed.set(cue, now);
      const sample = samples.get(cue);
      if (sample) playSample(sample, now);
      else for (const voice of SOUND_EFFECTS[cue]) playVoice(voice, now);
    },
    setAmbience(id) {
      wantedAmbience = id;
      startAmbience();
    },
    setMasterGain(gain) {
      masterGain = gain;
      master.gain.setValueAtTime(gain, context.currentTime);
    },
  };
}
