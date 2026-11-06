// Which sound effects a store change should play. The game never asks for
// a sound directly: the audio layer compares each store state with the one
// before it and plays a cue for every new thing the HUD is about to show
// (a damage number, a phase banner, a level up, a menu opening...). So
// sounds follow what's on screen, at whatever speed the game plays it.

import type { GameState } from '../bridge/gameStore.ts';
import type { Menu } from '../game/actionMenu.ts';
import type { PopupKind } from '../bridge/views.ts';
import type { EquipmentScreenView } from '../bridge/equipmentView.ts';
import type { GearSound, StrikeSound } from './soundKinds.ts';

export type SoundCue =
  | 'hit'
  | 'crit'
  | 'miss'
  | 'heal'
  | 'break'
  | 'learn'
  | 'defeat'
  | 'experience'
  | 'levelUp'
  | 'playerPhase'
  | 'enemyPhase'
  | 'guestPhase'
  | 'bossIntro'
  | 'warHorn'
  | 'enrage'
  | 'victory'
  | 'gameOver'
  | 'button'
  | 'menuMove'
  | 'dialog'
  // Recorded only (samples.ts), with a synthesized stand-in in sfx.ts.
  | StrikeSound
  | 'potion'
  | 'healSpell'
  | 'coins'
  | 'promote'
  | `equip-${GearSound}`
  | `unequip-${GearSound}`;

// The slice of GameState the cues are read from.
export type SoundState = Pick<
  GameState,
  | 'damagePopups'
  | 'defeats'
  | 'experienceGain'
  | 'levelUp'
  | 'boonPick'
  | 'phaseBanner'
  | 'bossIntro'
  | 'battleOutcome'
  | 'dialog'
  | 'deploymentMenu'
  | 'rosterMenu'
  | 'pauseMenu'
  | 'actionMenu'
  | 'weaponMenu'
  | 'skillMenu'
  | 'itemMenu'
  | 'rewardMenu'
  | 'campMenu'
  | 'campGold'
  | 'rosterScreen'
  | 'merchantScreen'
  | 'equipmentScreen'
  | 'promotionScreen'
  | 'mentorScreen'
>;

const POPUP_CUES: Readonly<Record<PopupKind, SoundCue>> = Object.freeze({
  damage: 'hit',
  crit: 'crit',
  miss: 'miss',
  health: 'heal',
  mana: 'heal',
  loot: 'coins',
  stored: 'coins',
  learned: 'learn',
  horn: 'warHorn',
  arrived: 'hit',
  blocked: 'miss',
  enraged: 'enrage',
  drowned: 'miss',
  steadfast: 'miss',
  status: 'enrage',
});

const PHASE_CUES = Object.freeze({ player: 'playerPhase', enemy: 'enemyPhase', guest: 'guestPhase' } as const);

const MENU_KEYS = [
  'deploymentMenu',
  'rosterMenu',
  'pauseMenu',
  'actionMenu',
  'weaponMenu',
  'skillMenu',
  'itemMenu',
  'rewardMenu',
  'campMenu',
] as const satisfies readonly (keyof SoundState)[];

// The camp's screens, which click like a menu as they open and close.
const SCREEN_KEYS = [
  'rosterScreen',
  'merchantScreen',
  'equipmentScreen',
  'promotionScreen',
  'mentorScreen',
] as const satisfies readonly (keyof SoundState)[];

// What changing one menu sounds like: a click as it opens or closes (a
// pick or a cancel), or a tick as its pointer moves.
function getMenuCue(prev: Menu | null, next: Menu | null): SoundCue | null {
  if (!prev && !next) return null;
  if (!prev || !next) return 'button';
  return prev.selectedIndex !== next.selectedIndex ? 'menuMove' : null;
}

// Putting gear on or taking it off on the equipment screen: the sound of
// what went on (or, with the slot left empty, what came off).
function getEquipCue(prev: EquipmentScreenView | null, next: EquipmentScreenView | null): SoundCue | null {
  if (!prev || !next || prev.units[prev.unitIndex]?.id !== next.units[next.unitIndex]?.id) return null;
  for (const slot of next.slots) {
    const before = prev.slots.find((each) => each.slot === slot.slot)?.item ?? null;
    const after = slot.item;
    if (after && (!before || before.label !== after.label)) return `equip-${after.sound}`;
    if (before && !after) return `unequip-${before.sound}`;
  }
  return null;
}

// The cues to play going from `prev` to `next`, in order, without
// repeats: two damage numbers landing in the same update play one hit.
export function getSoundCues(prev: SoundState, next: SoundState): SoundCue[] {
  const cues = new Set<SoundCue>();

  const shown = new Set(prev.damagePopups.map((popup) => popup.id));
  for (const popup of next.damagePopups) {
    if (shown.has(popup.id)) continue;
    // A blow tagged with its weapon's sound plays that; a crit adds its ring.
    cues.add(popup.sound ?? POPUP_CUES[popup.kind]);
    if (popup.sound && popup.kind === 'crit') cues.add('crit');
  }

  if (next.defeats > prev.defeats) cues.add('defeat');
  if (next.experienceGain && next.experienceGain.id !== prev.experienceGain?.id) cues.add('experience');
  if (
    (next.levelUp && next.levelUp.id !== prev.levelUp?.id) ||
    (next.boonPick && next.boonPick.key !== prev.boonPick?.key)
  )
    cues.add('levelUp');
  if (next.phaseBanner && next.phaseBanner.id !== prev.phaseBanner?.id) cues.add(PHASE_CUES[next.phaseBanner.team]);
  if (next.bossIntro && next.bossIntro.id !== prev.bossIntro?.id) cues.add('bossIntro');
  if (next.battleOutcome && next.battleOutcome !== prev.battleOutcome)
    cues.add(next.battleOutcome === 'victory' ? 'victory' : 'gameOver');
  if (next.dialog && next.dialog.id !== prev.dialog?.id) cues.add('dialog');

  // Gold changing hands at camp: buying, selling, paying for a rest.
  const goldBefore = prev.merchantScreen?.gold ?? prev.campGold;
  const goldAfter = next.merchantScreen?.gold ?? next.campGold;
  if (goldBefore !== null && goldAfter !== null && goldBefore !== goldAfter) cues.add('coins');
  if (next.promotionScreen && prev.promotionScreen && next.promotionScreen.seals < prev.promotionScreen.seals)
    cues.add('promote');
  const equipCue = getEquipCue(prev.equipmentScreen, next.equipmentScreen);
  if (equipCue) cues.add(equipCue);

  // One menu sound per update, however many menus changed: picking an
  // action closes one menu and opens the next.
  const menuCues = MENU_KEYS.map((key) => getMenuCue(prev[key] as Menu | null, next[key] as Menu | null));
  for (const key of SCREEN_KEYS) if (!prev[key] !== !next[key]) menuCues.push('button');
  const menuCue = menuCues.includes('button') ? 'button' : menuCues.find((cue) => cue !== null);
  if (menuCue) cues.add(menuCue);

  return [...cues];
}
