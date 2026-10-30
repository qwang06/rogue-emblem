import { describe, expect, it } from 'vitest';
import { createActionMenu, getSelectedAction, moveSelection } from './actionMenu.ts';
import {
  describeRenown,
  getFirstEnabledIndex,
  getHeatActions,
  getHeatOfAction,
  getStartingClassActions,
  getWarbandActions,
  hasHeatPick,
  getSettingsActions,
  STARTING_CLASS_ACTIONS,
  TITLE_ACTIONS,
} from './titleMenu.ts';
import { NEW_META, UNLOCKS } from './warband/meta.ts';
import { MAX_HEAT } from './warband/heat.ts';
import { BASE_ORIGINS, UNLOCKABLE_ORIGINS } from './warband/origins.ts';
import { advanceStage, createRun } from './warband/run.ts';
import { createStartingWarband } from './warband/stageLevel.ts';

describe('TITLE_ACTIONS', () => {
  it('lists Story Mode, Warband Mode, Training, then Settings', () => {
    expect(TITLE_ACTIONS.map((a) => a.id)).toEqual(['story', 'warband', 'training', 'map-generator', 'settings']);
    expect(TITLE_ACTIONS.map((a) => a.label)).toEqual([
      'Story Mode',
      'Warband Mode',
      'Training',
      'Map Generator',
      'Settings',
    ]);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(TITLE_ACTIONS)).toBe(true);
    expect(TITLE_ACTIONS.every(Object.isFrozen)).toBe(true);
  });

  it('starts on Story Mode and wraps around the entries', () => {
    const menu = createActionMenu(TITLE_ACTIONS);
    expect(getSelectedAction(menu)!.id).toBe('story');
    expect(getSelectedAction(moveSelection(menu, 1))!.id).toBe('warband');
    expect(getSelectedAction(moveSelection(menu, -1))!.id).toBe('settings');
    expect(getSelectedAction(moveSelection(menu, 5))!.id).toBe('story');
  });
});

describe('getSettingsActions', () => {
  it('offers sound, both volumes and the game configs', () => {
    const actions = getSettingsActions({ muted: false, volume: 0.6, musicVolume: 0.4 }, { music: true });
    expect(actions.map((a) => a.id)).toEqual(['sound', 'volume', 'musicVolume', 'configs']);
    expect(actions.map((a) => a.label)).toEqual(['Sound: On', 'Effects: 60%', 'Music: 40%', 'Game Configs']);
  });

  it('shows sound off and the volume at its ends', () => {
    expect(getSettingsActions({ muted: true, volume: 1, musicVolume: 0 }, { music: true }).map((a) => a.label)).toEqual(
      ['Sound: Off', 'Effects: 100%', 'Music: 0%', 'Game Configs'],
    );
  });

  it('leaves out the music volume while music is off', () => {
    const actions = getSettingsActions({ muted: false, volume: 0.6, musicVolume: 0.4 }, { music: false });
    expect(actions.map((a) => a.id)).toEqual(['sound', 'volume', 'configs']);
  });

  it('is frozen', () => {
    const actions = getSettingsActions({ muted: false, volume: 0.6, musicVolume: 0.4 }, { music: true });
    expect(Object.isFrozen(actions)).toBe(true);
    expect(actions.every(Object.isFrozen)).toBe(true);
  });
});

describe('getWarbandActions', () => {
  it('offers to continue the saved run at its stage, or start a new one', () => {
    const run = advanceStage(advanceStage(createRun(1, createStartingWarband())));
    const actions = getWarbandActions(run);
    expect(actions.map((a) => a.id)).toEqual(['continue-run', 'new-run']);
    expect(actions.map((a) => a.label)).toEqual(['Continue Run (Stage 3)', 'New Run']);
    expect(Object.isFrozen(actions)).toBe(true);
  });

  it('shows Continue Run disabled when no run is saved', () => {
    const actions = getWarbandActions(null);
    expect(actions.map((a) => a.id)).toEqual(['continue-run', 'new-run']);
    expect(actions.map((a) => a.label)).toEqual(['Continue Run', 'New Run']);
    expect(actions.map((a) => a.disabled ?? false)).toEqual([true, false]);
    expect(Object.isFrozen(actions)).toBe(true);
  });

  it('leaves Continue Run enabled with a run saved', () => {
    expect(getWarbandActions(createRun(1, createStartingWarband()))[0].disabled).toBeUndefined();
  });
});

describe('STARTING_CLASS_ACTIONS', () => {
  it('offers each starting class by its id, with its pitch', () => {
    expect(STARTING_CLASS_ACTIONS.map((a) => a.id)).toEqual(['warrior', 'soldier', 'archer']);
    expect(STARTING_CLASS_ACTIONS.map((a) => a.label)).toEqual(['Warrior', 'Soldier', 'Archer']);
    expect(STARTING_CLASS_ACTIONS.map((a) => a.description)).toEqual(BASE_ORIGINS.map((c) => c.description));
  });

  it('is frozen', () => {
    expect(Object.isFrozen(STARTING_CLASS_ACTIONS)).toBe(true);
    expect(STARTING_CLASS_ACTIONS.every(Object.isFrozen)).toBe(true);
  });
});

describe('getStartingClassActions', () => {
  it('offers the base origins, then the unlockable ones locked until renown opens them', () => {
    const actions = getStartingClassActions(NEW_META);
    expect(actions.map((a) => a.id)).toEqual([...BASE_ORIGINS, ...UNLOCKABLE_ORIGINS].map((c) => c.id));
    expect(actions.slice(0, BASE_ORIGINS.length)).toEqual(STARTING_CLASS_ACTIONS);
    expect(actions.find((a) => a.id === 'sellswords')?.units).toEqual(['soldier', 'archer']);
    const locked = actions.slice(BASE_ORIGINS.length);
    expect(locked.every((a) => a.disabled)).toBe(true);
    expect(locked[0].description).toBe(`Unlocks at ${UNLOCKS[0].renown} renown (0 so far).`);
    expect(Object.isFrozen(actions)).toBe(true);
  });

  it('opens an origin with its pitch once its renown is reached', () => {
    const [first] = UNLOCKS;
    const actions = getStartingClassActions({ ...NEW_META, renown: first.renown });
    const opened = actions.find((a) => a.id === first.origin)!;
    expect(opened.disabled).toBeUndefined();
    expect(opened.description).toBe(UNLOCKABLE_ORIGINS[0].description);
    expect(actions.filter((a) => a.disabled)).toHaveLength(UNLOCKS.length - 1);
  });
});

describe('getHeatActions', () => {
  it('is only asked for once a Heat is open', () => {
    expect(hasHeatPick(NEW_META)).toBe(false);
    expect(hasHeatPick({ ...NEW_META, heat: 1 })).toBe(true);
  });

  it('offers no Heat, then each level, locked above the highest open', () => {
    const actions = getHeatActions({ ...NEW_META, heat: 2 });
    expect(actions.map((a) => a.id)).toEqual(Array.from({ length: MAX_HEAT + 1 }, (_, level) => `heat-${level}`));
    expect(actions.map((a) => Boolean(a.disabled))).toEqual([false, false, false, ...Array(MAX_HEAT - 2).fill(true)]);
    expect(actions[1].label).toBe('Heat 1');
    expect(actions[1].description).toBe('Hardened Foes: Enemies are 1 level higher.');
    expect(actions[2].description).toMatch(/Plus Heat 1\.$/);
    expect(actions[3].description).toBe('Costly Rest: win a run at Heat 2 to unlock.');
    expect(actions.map((a) => getHeatOfAction(a.id))).toEqual(
      Array.from({ length: MAX_HEAT + 1 }, (_, level) => level),
    );
  });
});

describe('describeRenown', () => {
  it('shows the highest Heat open once there is one', () => {
    expect(describeRenown({ ...NEW_META, renown: 15, heat: 2 })).toBe(
      `Renown 15 · Heat 2 · Next: ${UNLOCKS[0].label} at ${UNLOCKS[0].renown}`,
    );
  });

  it('shows the renown and the next unlock, or that everything is open', () => {
    expect(describeRenown({ ...NEW_META, renown: 15 })).toBe(
      `Renown 15 · Next: ${UNLOCKS[0].label} at ${UNLOCKS[0].renown}`,
    );
    expect(describeRenown({ ...NEW_META, renown: 10_000 })).toBe('Renown 10000 · Everything unlocked');
  });
});

describe('getFirstEnabledIndex', () => {
  it('skips disabled entries', () => {
    expect(getFirstEnabledIndex(getWarbandActions(null))).toBe(1);
    expect(getFirstEnabledIndex(getWarbandActions(createRun(1, createStartingWarband())))).toBe(0);
  });

  it('falls back to the first entry when all are disabled or there are none', () => {
    expect(getFirstEnabledIndex([{ id: 'a', label: 'A', disabled: true }])).toBe(0);
    expect(getFirstEnabledIndex([])).toBe(0);
  });
});
