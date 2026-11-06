import { describe, expect, it } from 'vitest';
import { BATTLE_STATE_DEFAULTS } from '../bridge/gameStore.ts';
import { toDamagePopupView, type PhaseBannerView } from '../bridge/views.ts';
import type { Menu } from '../game/actionMenu.ts';
import type { EquipmentScreenView } from '../bridge/equipmentView.ts';
import type { MerchantScreenView } from '../bridge/merchantView.ts';
import type { PromotionScreenView } from '../bridge/promotionView.ts';
import { getSoundCues, type SoundCue, type SoundState } from './cues.ts';

const base: SoundState = { ...BATTLE_STATE_DEFAULTS };

const popup = (id: number, kind: Parameters<typeof toDamagePopupView>[0]['kind'], sound: SoundCue | null = null) =>
  toDamagePopupView({ id, amount: 3, kind, x: 0, y: 0, durationMs: 700, sound });

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

const intro = (id: number) => ({ id, name: 'Grukk', title: 'Orc Warlord', taunt: [], durationMs: 2000 });

describe('getSoundCues', () => {
  it('drums once as a boss name card comes up', () => {
    expect(getSoundCues(base, { ...base, bossIntro: intro(1) })).toEqual(['bossIntro']);
    const shown = { ...base, bossIntro: intro(1) };
    expect(getSoundCues(shown, { ...shown })).toEqual([]);
    expect(getSoundCues(shown, { ...base, bossIntro: null })).toEqual([]);
  });

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
    expect(getSoundCues(base, { ...base, damagePopups: [popup(1, 'stored')] })).toEqual(['coins']);
    expect(getSoundCues(base, { ...base, damagePopups: [popup(1, 'horn')] })).toEqual(['warHorn']);
    expect(getSoundCues(base, { ...base, damagePopups: [popup(1, 'enraged')] })).toEqual(['enrage']);
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

    const boonPick = {
      key: 'ada-2',
      name: 'Ada',
      classLabel: 'Soldier',
      sprite: 'Soldier_03',
      level: 2,
      stats: [],
      skills: [],
      boons: [],
      banishing: false,
    };
    expect(getSoundCues(base, { ...base, boonPick })).toEqual(['levelUp']);
    expect(getSoundCues({ ...base, boonPick }, { ...base, boonPick: { ...boonPick } })).toEqual([]);

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

  it('clicks when a menu opens or closes, and ticks when its pointer moves', () => {
    expect(getSoundCues(base, { ...base, actionMenu: menu(0) })).toEqual(['button']);
    const open = { ...base, actionMenu: menu(0) };
    expect(getSoundCues(open, { ...base, actionMenu: menu(1) })).toEqual(['menuMove']);
    expect(getSoundCues(open, { ...base, actionMenu: menu(0) })).toEqual([]);
    expect(getSoundCues(open, base)).toEqual(['button']);
  });

  it('clicks when a camp screen opens or closes', () => {
    const merchant = { gold: 10 } as MerchantScreenView;
    expect(getSoundCues(base, { ...base, merchantScreen: merchant })).toEqual(['button']);
    expect(getSoundCues({ ...base, merchantScreen: merchant }, base)).toEqual(['button']);
  });

  it('plays one menu sound when one menu gives way to another', () => {
    const open = { ...base, actionMenu: menu(0) };
    expect(getSoundCues(open, { ...base, pauseMenu: menu(0) })).toEqual(['button']);
    expect(getSoundCues({ ...open, campMenu: menu(0) }, { ...base, actionMenu: menu(1), campMenu: menu(1) })).toEqual([
      'menuMove',
    ]);
  });

  it('plays different kinds of cue together', () => {
    const cues = getSoundCues(base, { ...base, damagePopups: [popup(1, 'crit')], defeats: 1 });
    expect(cues).toEqual(['crit', 'defeat']);
  });

  it("plays a popup's own sound in place of its kind's, with a crit's ring on top", () => {
    expect(getSoundCues(base, { ...base, damagePopups: [popup(1, 'damage', 'axe')] })).toEqual(['axe']);
    expect(getSoundCues(base, { ...base, damagePopups: [popup(1, 'crit', 'sword')] })).toEqual(['sword', 'crit']);
    expect(getSoundCues(base, { ...base, damagePopups: [popup(1, 'health', 'potion')] })).toEqual(['potion']);
  });

  it('jingles coins as gold changes hands at camp, not when the camp opens', () => {
    const merchant = (gold: number) => ({ gold }) as MerchantScreenView;
    expect(getSoundCues({ ...base, campGold: 20 }, { ...base, campGold: 15 })).toEqual(['coins']);
    expect(getSoundCues(base, { ...base, campGold: 20 })).toEqual([]);
    const shopping = { ...base, campGold: 20, merchantScreen: merchant(20) };
    expect(getSoundCues(shopping, { ...shopping, merchantScreen: merchant(12) })).toEqual(['coins']);
    // Leaving the merchant with the camp's gold caught up is just a click.
    expect(getSoundCues({ ...shopping, merchantScreen: merchant(12) }, { ...base, campGold: 12 })).toEqual(['button']);
  });

  it('plays the promotion fanfare as a seal is spent', () => {
    const screen = (seals: number) => ({ seals }) as PromotionScreenView;
    expect(getSoundCues({ ...base, promotionScreen: screen(2) }, { ...base, promotionScreen: screen(1) })).toEqual([
      'promote',
    ]);
    expect(getSoundCues({ ...base, promotionScreen: screen(2) }, { ...base, promotionScreen: screen(2) })).toEqual([]);
  });

  it('plays the gear sound of what goes on, or of what comes off', () => {
    const screen = (
      unitId: string,
      body: { label: string; sound: 'plate' | 'robe' } | null,
      main: { label: string; sound: 'weapon' } | null = null,
    ) =>
      ({
        unitIndex: 0,
        units: [{ id: unitId }],
        slots: [
          { slot: 'main', item: main && { ...main, icon: null } },
          { slot: 'body', item: body && { ...body, icon: null } },
        ],
      }) as unknown as EquipmentScreenView;
    const plate = { label: 'Plate', sound: 'plate' as const };
    const robe = { label: 'Robe', sound: 'robe' as const };
    const at = (equipmentScreen: EquipmentScreenView) => ({ ...base, equipmentScreen });
    expect(getSoundCues(at(screen('a', null)), at(screen('a', plate)))).toEqual(['equip-plate']);
    expect(getSoundCues(at(screen('a', plate)), at(screen('a', robe)))).toEqual(['equip-robe']);
    expect(getSoundCues(at(screen('a', plate)), at(screen('a', null)))).toEqual(['unequip-plate']);
    expect(
      getSoundCues(at(screen('a', null)), at(screen('a', null, { label: 'Iron Sword', sound: 'weapon' }))),
    ).toEqual(['equip-weapon']);
    // Picking another unit isn't changing gear.
    expect(getSoundCues(at(screen('a', null)), at(screen('b', plate)))).toEqual([]);
    expect(getSoundCues(at(screen('a', plate)), at(screen('a', plate)))).toEqual([]);
  });

  it('plays a windup sound once each time a striker readies its blow', () => {
    const drawn = { ...base, windupSound: { id: 1, sound: 'bow' as const } };
    expect(getSoundCues(base, drawn)).toEqual(['bow']);
    expect(getSoundCues(drawn, { ...drawn })).toEqual([]);
    expect(getSoundCues(drawn, { ...base, windupSound: { id: 2, sound: 'bow' } })).toEqual(['bow']);
  });
});
