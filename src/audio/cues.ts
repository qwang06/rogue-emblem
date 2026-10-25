// Which sound effects a store change should play. The game never asks for
// a sound directly: the audio layer compares each store state with the one
// before it and plays a cue for every new thing the HUD is about to show
// (a damage number, a phase banner, a level up, a menu opening...). So
// sounds follow what's on screen, at whatever speed the game plays it.

import type { GameState } from '../bridge/gameStore.ts';
import type { Menu } from '../game/actionMenu.ts';
import type { PopupKind } from '../bridge/views.ts';

export type SoundCue =
  | 'hit'
  | 'crit'
  | 'miss'
  | 'heal'
  | 'loot'
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
  | 'menuOpen'
  | 'menuMove'
  | 'dialog';

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
>;

const POPUP_CUES: Readonly<Record<PopupKind, SoundCue>> = Object.freeze({
  damage: 'hit',
  crit: 'crit',
  miss: 'miss',
  health: 'heal',
  mana: 'heal',
  broke: 'break',
  loot: 'loot',
  stored: 'loot',
  learned: 'learn',
  horn: 'warHorn',
  arrived: 'hit',
  blocked: 'miss',
  enraged: 'enrage',
  drowned: 'miss',
  steadfast: 'miss',
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

// What changing one menu sounds like: opening it, or moving its pointer.
// Closing it is silent, since whatever the pick leads to makes its own.
function getMenuCue(prev: Menu | null, next: Menu | null): SoundCue | null {
  if (!next) return null;
  if (!prev) return 'menuOpen';
  return prev.selectedIndex !== next.selectedIndex ? 'menuMove' : null;
}

// The cues to play going from `prev` to `next`, in order, without
// repeats: two damage numbers landing in the same update play one hit.
export function getSoundCues(prev: SoundState, next: SoundState): SoundCue[] {
  const cues = new Set<SoundCue>();

  const shown = new Set(prev.damagePopups.map((popup) => popup.id));
  for (const popup of next.damagePopups) if (!shown.has(popup.id)) cues.add(POPUP_CUES[popup.kind]);

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

  // One menu sound per update, however many menus changed: picking an
  // action closes one menu and opens the next.
  const menuCues = MENU_KEYS.map((key) => getMenuCue(prev[key] as Menu | null, next[key] as Menu | null));
  const menuCue = menuCues.includes('menuOpen') ? 'menuOpen' : menuCues.find((cue) => cue !== null);
  if (menuCue) cues.add(menuCue);

  return [...cues];
}
