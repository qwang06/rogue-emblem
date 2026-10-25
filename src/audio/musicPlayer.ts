// Plays the songs from src/audio/songs.ts with Web Audio, looping, and
// crossfades between them. Thin, untested glue like player.ts: which song
// plays is decided in musicTrack.ts and what it sounds like in songs.ts.

import {
  getSongLength,
  getStepSeconds,
  parseDrumLane,
  parseLine,
  SONGS,
  STEPS_PER_BAR,
  type Line,
  type NoteEvent,
  type TrackId,
} from './songs.ts';

const LOOKAHEAD_S = 0.2; // how far ahead notes are scheduled
const TICK_MS = 50; // how often the scheduler looks ahead
const FADE_S = 0.6; // crossfade between songs
const SILENT = 0.0001;

export interface MusicPlayer {
  play(track: TrackId | null): void;
  setVolume(gain: number): void;
}

interface Playback {
  stop(): void;
}

export function createMusicPlayer(context: AudioContext, destination: AudioNode): MusicPlayer {
  const bus = context.createGain();
  bus.connect(destination);
  let volume = 1;
  let current: { track: TrackId; playback: Playback } | null = null;
  // The track the game wants, kept while the music is silent so turning
  // it up starts it.
  let wanted: TrackId | null = null;
  let noise: AudioBuffer | null = null;

  function getNoise(): AudioBuffer {
    if (noise) return noise;
    noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return noise;
  }

  function playNote(out: AudioNode, line: Line, frequency: number, start: number, seconds: number) {
    const end = start + seconds * 0.92;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(SILENT, start);
    envelope.gain.exponentialRampToValueAtTime(line.gain, start + 0.008);
    envelope.gain.setValueAtTime(line.gain, Math.max(start + 0.008, end - 0.04));
    envelope.gain.exponentialRampToValueAtTime(SILENT, end);
    envelope.connect(out);
    const oscillator = context.createOscillator();
    oscillator.type = line.wave === 'noise' ? 'square' : line.wave;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.connect(envelope);
    oscillator.onended = () => envelope.disconnect();
    oscillator.start(start);
    oscillator.stop(end + 0.02);
  }

  // A drum hit: a falling thump for the kick, filtered noise for the
  // snare (long) and hat (short, bright).
  function playDrum(out: AudioNode, kind: 'kick' | 'snare' | 'hat', gain: number, start: number) {
    const envelope = context.createGain();
    const length = kind === 'kick' ? 0.14 : kind === 'snare' ? 0.12 : 0.04;
    envelope.gain.setValueAtTime(gain * (kind === 'hat' ? 0.5 : 1), start);
    envelope.gain.exponentialRampToValueAtTime(SILENT, start + length);
    envelope.connect(out);
    let source: AudioScheduledSourceNode;
    if (kind === 'kick') {
      const oscillator = context.createOscillator();
      oscillator.frequency.setValueAtTime(150, start);
      oscillator.frequency.exponentialRampToValueAtTime(45, start + length);
      oscillator.connect(envelope);
      source = oscillator;
    } else {
      const buffer = context.createBufferSource();
      buffer.buffer = getNoise();
      const filter = context.createBiquadFilter();
      filter.type = kind === 'hat' ? 'highpass' : 'bandpass';
      filter.frequency.value = kind === 'hat' ? 7000 : 1800;
      buffer.connect(filter).connect(envelope);
      source = buffer;
    }
    source.onended = () => envelope.disconnect();
    source.start(start);
    source.stop(start + length + 0.02);
  }

  // Starts looping a song, fading in; stop() fades it out and ends it.
  function startSong(track: TrackId): Playback {
    const song = SONGS[track];
    const out = context.createGain();
    out.gain.setValueAtTime(SILENT, context.currentTime);
    out.gain.exponentialRampToValueAtTime(1, context.currentTime + FADE_S);
    out.connect(bus);

    const length = getSongLength(song);
    const stepSeconds = getStepSeconds(song.bpm);
    const byStep = (events: NoteEvent[]) => {
      const map = new Map<number, NoteEvent[]>();
      for (const event of events) map.set(event.step, [...(map.get(event.step) ?? []), event]);
      return map;
    };
    const lead = byStep(parseLine(song.lead.bars));
    const bass = byStep(parseLine(song.bass.bars));
    const drums = song.drums && {
      kick: new Set(parseDrumLane(song.drums.kick)),
      snare: new Set(parseDrumLane(song.drums.snare)),
      hat: new Set(parseDrumLane(song.drums.hat)),
    };

    const startAt = context.currentTime + 0.05;
    let nextStep = 0;
    const tick = () => {
      while (startAt + nextStep * stepSeconds < context.currentTime + LOOKAHEAD_S) {
        const time = startAt + nextStep * stepSeconds;
        const step = nextStep % length;
        for (const note of lead.get(step) ?? [])
          playNote(out, song.lead, note.frequency, time, note.length * stepSeconds);
        for (const note of bass.get(step) ?? [])
          playNote(out, song.bass, note.frequency, time, note.length * stepSeconds);
        if (drums && song.drums) {
          const beat = step % STEPS_PER_BAR;
          for (const kind of ['kick', 'snare', 'hat'] as const)
            if (drums[kind].has(beat)) playDrum(out, kind, song.drums.gain, time);
        }
        nextStep += 1;
      }
    };
    tick();
    const timer = setInterval(tick, TICK_MS);

    return {
      stop() {
        clearInterval(timer);
        const now = context.currentTime;
        out.gain.cancelScheduledValues(now);
        out.gain.setValueAtTime(Math.max(out.gain.value, SILENT), now);
        out.gain.exponentialRampToValueAtTime(SILENT, now + FADE_S);
        setTimeout(() => out.disconnect(), (FADE_S + LOOKAHEAD_S) * 1000 + 100);
      },
    };
  }

  return {
    play(track) {
      wanted = track;
      if (current?.track === track) return;
      current?.playback.stop();
      current = track && volume > 0 ? { track, playback: startSong(track) } : null;
    },
    setVolume(gain) {
      const wasSilent = volume === 0;
      volume = gain;
      bus.gain.setValueAtTime(gain, context.currentTime);
      if (gain === 0 && current) {
        current.playback.stop();
        current = null;
      } else if (wasSilent && gain > 0 && wanted) {
        current = { track: wanted, playback: startSong(wanted) };
      }
    },
  };
}
