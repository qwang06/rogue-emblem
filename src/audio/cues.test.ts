import { describe, expect, it } from 'vitest';
import { BATTLE_STATE_DEFAULTS } from '../bridge/gameStore.ts';
import { toDamagePopupView, type PhaseBannerView } from '../bridge/views.ts';
import type { Menu } from '../game/actionMenu.ts';
import { getSoundCues, type SoundState } from './cues.ts';

const base: SoundState = { ...BATTLE_STATE_DEFAULTS };

const popup = (id: number, kind: Parameters<typeof toDamagePopupView>[0]['kind']) =>
  toDamagePopupView({ id, amount: 3, kind, x: 0, y: 0, durationMs: 700 });

const menu = (selectedIndex: number): Menu => ({
  actions: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ],
  selectedIndex,
});

const banner = (id: number, team: PhaseBannerView['team']): PhaseBannerView => ({
  id,
  team,
  turn: 1,
  label: 'Phase',
  durationMs: 1000,
});

describe('getSoundCues', () => {
  it('plays nothing when nothing changed', () => {
    expect(getSoundCues(base, base)).toEqual([]);
    expect(getSoundCues(base, { ...base })).toEqual([]);
  });

  it('plays a cue for each new popup, by its kind', () => {
    expect(getSoundCues(base, { ...base, damagePopups: [popup(1, 'damage')] })).toEqual(['hit']);
    expect(getSoundCues(base, { ...base, damagePopups: [popup(1, 'crit')] })).toEqual(['crit']);
    expect(getSoundCues(base, { ...base, damagePopups: [popup(1, 'miss')] })).toEqual(['miss']);
    expect(getSoundCues(base, { ...base, damagePopups: [popup(1, 'health')] })).toEqual(['heal']);
    expect(getSoundCues(base, { ...base, damagePopups: [popup(1, 'mana')] })).toEqual(['heal']);
    expect(getSoundCues(base, { ...base, damagePopups: [popup(1, 'stored')] })).toEqual(['loot']);
    expect(getSoundCues(base, { ...base, damagePopups: [popup(1, 'broke')] })).toEqual(['break']);
    expect(getSoundCues(base, { ...base, damagePopups: [popup(1, 'learned')] })).toEqual(['learn']);
  });

  it('only plays popups that are new, not ones already up or taken down', () => {
    const prev = { ...base, damagePopups: [popup(1, 'damage')] };
    expect(getSoundCues(prev, { ...base, damagePopups: [popup(1, 'damage'), popup(2, 'miss')] })).toEqual(['miss']);
    expect(getSoundCues(prev, { ...base, damagePopups: [] })).toEqual([]);
  });

  it('plays one hit for two hits landing at once', () => {
    expect(getSoundCues(base, { ...base, damagePopups: [popup(1, 'damage'), popup(2, 'damage')] })).toEqual(['hit']);
  });

  it('plays the defeat sound when a unit falls, not when the count resets', () => {
    expect(getSoundCues(base, { ...base, defeats: 1 })).toEqual(['defeat']);
    expect(getSoundCues({ ...base, defeats: 3 }, base)).toEqual([]);
  });

  it('announces each phase by team, once per banner', () => {
    expect(getSoundCues(base, { ...base, phaseBanner: banner(1, 'player') })).toEqual(['playerPhase']);
    expect(getSoundCues(base, { ...base, phaseBanner: banner(1, 'enemy') })).toEqual(['enemyPhase']);
    expect(getSoundCues(base, { ...base, phaseBanner: banner(1, 'guest') })).toEqual(['guestPhase']);
    const shown = { ...base, phaseBanner: banner(1, 'player') };
    expect(getSoundCues(shown, { ...shown, phaseBanner: banner(1, 'player') })).toEqual([]);
    expect(getSoundCues(shown, { ...base, phaseBanner: null })).toEqual([]);
  });

  it('plays the result jingle once the battle is decided', () => {
    expect(getSoundCues(base, { ...base, battleOutcome: 'victory' })).toEqual(['victory']);
    expect(getSoundCues(base, { ...base, battleOutcome: 'defeat' })).toEqual(['gameOver']);
    const won = { ...base, battleOutcome: 'victory' as const };
    expect(getSoundCues(won, { ...won })).toEqual([]);
  });

  it('plays XP, level ups and dialog lines when a new one shows', () => {
    const experienceGain = {
      id: 4,
      name: 'Ada',
      level: 1,
      gained: 10,
      startPercent: 0,
      endPercent: 10,
      durationMs: 1000,
    };
    expect(getSoundCues(base, { ...base, experienceGain })).toEqual(['experience']);
    const withGain = { ...base, experienceGain };
    expect(getSoundCues(withGain, { ...withGain, experienceGain: { ...experienceGain } })).toEqual([]);

    const levelUp = { id: 5, name: 'Ada', unitClass: null, level: 2, stats: [], skills: [], durationMs: 2000 };
    expect(getSoundCues(base, { ...base, levelUp })).toEqual(['levelUp']);

    const line = {
      id: 1,
      speaker: 'Ada',
      side: 'left' as const,
      text: 'Hi',
      portrait: null,
      sprite: null,
      revealed: false,
      charsPerSecond: 30,
      isLast: false,
    };
    const speaking = { ...base, dialog: line };
    expect(getSoundCues(base, speaking)).toEqual(['dialog']);
    // Revealing the rest of the same line isn't a new one.
    expect(getSoundCues(speaking, { ...base, dialog: { ...line, revealed: true } })).toEqual([]);
    expect(getSoundCues(speaking, { ...base, dialog: { ...line, id: 2 } })).toEqual(['dialog']);
  });

  it('blips when a menu opens or its pointer moves, and stays quiet when it closes', () => {
    expect(getSoundCues(base, { ...base, actionMenu: menu(0) })).toEqual(['menuOpen']);
    const open = { ...base, actionMenu: menu(0) };
    expect(getSoundCues(open, { ...base, actionMenu: menu(1) })).toEqual(['menuMove']);
    expect(getSoundCues(open, { ...base, actionMenu: menu(0) })).toEqual([]);
    expect(getSoundCues(open, base)).toEqual([]);
  });

  it('plays one menu sound when one menu gives way to another', () => {
    const open = { ...base, actionMenu: menu(0) };
    expect(getSoundCues(open, { ...base, pauseMenu: menu(0) })).toEqual(['menuOpen']);
    expect(getSoundCues({ ...open, campMenu: menu(0) }, { ...base, actionMenu: menu(1), campMenu: menu(1) })).toEqual([
      'menuMove',
    ]);
  });

  it('plays different kinds of cue together', () => {
    const cues = getSoundCues(base, { ...base, damagePopups: [popup(1, 'crit')], defeats: 1 });
    expect(cues).toEqual(['crit', 'defeat']);
  });
});
