import { describe, expect, it } from 'vitest';
import { BATTLE_STATE_DEFAULTS } from '../bridge/gameStore.ts';
import type { Menu } from '../game/actionMenu.ts';
import { getMusicTrack, type MusicState } from './musicTrack.ts';

const menu: Menu = { actions: [{ id: 'a', label: 'A' }], selectedIndex: 0 };

const battle: MusicState = {
  ...BATTLE_STATE_DEFAULTS,
  screen: 'battle',
  mapReady: true,
  phase: 'battle',
  turn: { turn: 1, team: 'player', label: 'Player Phase' },
};

describe('getMusicTrack', () => {
  it('plays the title theme on the title', () => {
    expect(getMusicTrack({ ...BATTLE_STATE_DEFAULTS, screen: 'title' })).toBe('title');
  });

  it('marches across the realm', () => {
    expect(getMusicTrack({ ...BATTLE_STATE_DEFAULTS, screen: 'overworld' })).toBe('march');
  });

  it('is silent while a map loads and on a map preview', () => {
    expect(getMusicTrack({ ...battle, mapReady: false })).toBeNull();
    expect(getMusicTrack({ ...battle, screen: 'preview' })).toBeNull();
  });

  it('plays the camp theme while deploying', () => {
    expect(getMusicTrack({ ...battle, phase: 'deployment', turn: null })).toBe('camp');
  });

  it('follows the phase: battle for the player and guests, the enemy theme for the enemy', () => {
    expect(getMusicTrack(battle)).toBe('battle');
    expect(getMusicTrack({ ...battle, turn: { turn: 1, team: 'guest', label: 'Guest Phase' } })).toBe('battle');
    expect(getMusicTrack({ ...battle, turn: { turn: 1, team: 'enemy', label: 'Enemy Phase' } })).toBe('enemy');
  });

  it('goes quiet once the battle is decided, for the jingle', () => {
    expect(getMusicTrack({ ...battle, battleOutcome: 'victory' })).toBeNull();
    expect(getMusicTrack({ ...battle, battleOutcome: 'defeat' })).toBeNull();
  });

  it('plays the camp theme from the reward pick through camp', () => {
    const won = { ...battle, battleOutcome: 'victory' as const };
    expect(getMusicTrack({ ...won, rewardMenu: menu as MusicState['rewardMenu'] })).toBe('camp');
    expect(getMusicTrack({ ...won, campMenu: menu })).toBe('camp');
    expect(getMusicTrack({ ...won, rosterScreen: {} as MusicState['rosterScreen'] })).toBe('camp');
    expect(getMusicTrack({ ...won, merchantScreen: {} as MusicState['merchantScreen'] })).toBe('camp');
    expect(getMusicTrack({ ...won, boonPick: {} as MusicState['boonPick'] })).toBe('camp');
  });
});
