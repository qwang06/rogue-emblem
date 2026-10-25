// Which music fits what's on screen. Like the sound cues, it's read from
// the store: the audio layer plays whatever this returns, crossfading when
// it changes.

import type { GameState } from '../bridge/gameStore.ts';
import type { TrackId } from './songs.ts';

export type MusicState = Pick<
  GameState,
  | 'screen'
  | 'mapReady'
  | 'phase'
  | 'turn'
  | 'battleOutcome'
  | 'rewardMenu'
  | 'boonPick'
  | 'campMenu'
  | 'rosterScreen'
  | 'merchantScreen'
>;

// The track to play, or null for silence: while a map loads, on a map
// preview, and once a battle is decided (its victory or defeat jingle
// plays alone) until the warband reaches camp.
export function getMusicTrack(state: MusicState): TrackId | null {
  if (state.screen === 'title') return 'title';
  if (state.screen === 'overworld') return 'march';
  if (state.screen !== 'battle' || !state.mapReady) return null;
  if (state.rewardMenu || state.boonPick || state.campMenu || state.rosterScreen || state.merchantScreen) return 'camp';
  if (state.battleOutcome) return null;
  if (state.phase === 'deployment') return 'camp';
  return state.turn?.team === 'enemy' ? 'enemy' : 'battle';
}
