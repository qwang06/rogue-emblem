import { describe, expect, it } from 'vitest';
import { BATTLE_STATE_DEFAULTS } from '../bridge/gameStore.ts';
import type { Menu } from '../game/actionMenu.ts';
import { getAmbience, type AmbienceState } from './ambience.ts';

const base: AmbienceState = { ...BATTLE_STATE_DEFAULTS, screen: 'battle' };
const campMenu: Menu = { actions: [{ id: 'march', label: 'Next Stage' }], selectedIndex: 0 };

describe('getAmbience', () => {
  it('crackles at camp, on its menu or any of its screens', () => {
    expect(getAmbience({ ...base, campMenu })).toBe('camp');
    expect(getAmbience({ ...base, merchantScreen: {} as AmbienceState['merchantScreen'] })).toBe('camp');
    expect(getAmbience({ ...base, equipmentScreen: {} as AmbienceState['equipmentScreen'] })).toBe('camp');
  });

  it('is quiet in battle and off the battle screen', () => {
    expect(getAmbience(base)).toBeNull();
    expect(getAmbience({ ...base, screen: 'title', campMenu })).toBeNull();
  });
});
