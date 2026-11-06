// Which looping background sound fits what's on screen, read from the
// store like the music (musicTrack.ts): the crackle of the camp while the
// warband rests between stages.

import type { GameState } from '../bridge/gameStore.ts';
import type { AmbienceId } from './samples.ts';

export type AmbienceState = Pick<
  GameState,
  'screen' | 'campMenu' | 'rosterScreen' | 'merchantScreen' | 'equipmentScreen' | 'promotionScreen' | 'mentorScreen'
>;

export function getAmbience(state: AmbienceState): AmbienceId | null {
  if (state.screen !== 'battle') return null;
  const atCamp =
    state.campMenu ||
    state.rosterScreen ||
    state.merchantScreen ||
    state.equipmentScreen ||
    state.promotionScreen ||
    state.mentorScreen;
  return atCamp ? 'camp' : null;
}
