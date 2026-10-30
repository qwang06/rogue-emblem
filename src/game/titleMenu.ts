// Entries on the title screen menu. Selection state reuses the generic menu
// helpers in actionMenu.ts; carrying out a choice is the caller's job.

import type { MenuAction } from './actionMenu.ts';
import type { AudioSettings } from '../audio/settings.ts';
import { HEAT_LEVELS } from './warband/heat.ts';
import { getNextUnlock, getUnlockedOrigins, UNLOCKS, type MetaState } from './warband/meta.ts';
import { BASE_ORIGINS, UNLOCKABLE_ORIGINS, type Origin } from './warband/origins.ts';
import type { RunState } from './warband/run.ts';

export const TITLE_ACTIONS: readonly MenuAction[] = Object.freeze([
  Object.freeze({ id: 'story', label: 'Story Mode' }),
  Object.freeze({ id: 'warband', label: 'Warband Mode' }),
  Object.freeze({ id: 'training', label: 'Training' }),
  Object.freeze({ id: 'map-generator', label: 'Map Generator' }),
  Object.freeze({ id: 'settings', label: 'Settings' }),
]);

// Entries on the Settings submenu the title menu's Settings opens, which
// show the current sound settings: 'sound' turns sound on or off, 'volume'
// and 'musicVolume' change the sound effect and music volumes (their ids
// are the AudioSettings fields), and 'configs' leads to the config editor
// (#/configs). The music volume is only offered when `music` is on (the
// music feature flag, src/featureFlags.ts).
export function getSettingsActions(audio: AudioSettings, { music }: { music: boolean }): readonly MenuAction[] {
  const entries: MenuAction[] = [
    { id: 'sound', label: `Sound: ${audio.muted ? 'Off' : 'On'}` },
    { id: 'volume', label: `Effects: ${Math.round(audio.volume * 100)}%` },
    ...(music ? [{ id: 'musicVolume', label: `Music: ${Math.round(audio.musicVolume * 100)}%` }] : []),
    { id: 'configs', label: 'Game Configs' },
  ];
  return Object.freeze(entries.map((entry) => Object.freeze(entry)));
}

// Entries on the submenu Warband Mode opens: carry on with the saved run
// from the stage it's on, or start a new one (in its place, if there is
// one). With no run saved, Continue Run is shown but disabled.
export function getWarbandActions(savedRun: RunState | null): readonly MenuAction[] {
  const continueRun = savedRun
    ? { id: 'continue-run', label: `Continue Run (Stage ${savedRun.stage})` }
    : { id: 'continue-run', label: 'Continue Run', disabled: true };
  return Object.freeze([Object.freeze(continueRun), Object.freeze({ id: 'new-run', label: 'New Run' })]);
}

// An entry on the New Run submenus: an origin (or Heat level) to start
// the run with, and its pitch.
export interface StartingClassAction extends MenuAction {
  description: string;
}

// An origin's entry on the New Run submenu, with the classes of the units
// it starts with, to draw them.
export interface OriginAction extends StartingClassAction {
  units: readonly string[];
}

function toOriginAction({ id, label, description, units }: Origin): OriginAction {
  return Object.freeze({ id, label, description, units });
}

// Entries on the submenu New Run opens before any unlock: one per base
// origin (see BASE_ORIGINS), whose id is the origin id.
export const STARTING_CLASS_ACTIONS: readonly OriginAction[] = Object.freeze(BASE_ORIGINS.map(toOriginAction));

// The New Run submenu for a player with `meta`'s renown: the base origins,
// then every unlockable one (UNLOCKABLE_ORIGINS), disabled until its
// renown is reached, its pitch then saying how much it takes.
export function getStartingClassActions(meta: MetaState): readonly OriginAction[] {
  const unlocked = getUnlockedOrigins(meta);
  const locked = UNLOCKABLE_ORIGINS.map((origin) => {
    if (unlocked.includes(origin.id)) return toOriginAction(origin);
    const renown = UNLOCKS.find((unlock) => unlock.origin === origin.id)?.renown ?? 0;
    return Object.freeze({
      ...toOriginAction(origin),
      description: `Unlocks at ${renown} renown (${meta.renown} so far).`,
      disabled: true,
    });
  });
  return Object.freeze([...STARTING_CLASS_ACTIONS, ...locked]);
}

// Whether New Run asks for a Heat level: once a won run has opened one.
export function hasHeatPick(meta: MetaState): boolean {
  return meta.heat > 0;
}

// The Heat submenu for a player with `meta`'s Heat open: no Heat, then
// every level (id `heat-<level>`), each pitched with its name, its own
// rule and, above 1, that it keeps the lower levels'. Levels above meta.heat are
// disabled, their pitch saying which win opens them.
export function getHeatActions(meta: MetaState): readonly StartingClassAction[] {
  const levels = HEAT_LEVELS.map(({ level, name, description }) => {
    const label = `Heat ${level}`;
    if (level > meta.heat) {
      return Object.freeze({
        id: `heat-${level}`,
        label,
        description: `${name}: win a run at Heat ${level - 1} to unlock.`,
        disabled: true,
      });
    }
    const lower = level > 1 ? ` Plus Heat ${level === 2 ? '1' : `1–${level - 1}`}.` : '';
    return Object.freeze({ id: `heat-${level}`, label, description: `${name}: ${description}${lower}` });
  });
  return Object.freeze([
    Object.freeze({ id: 'heat-0', label: 'No Heat', description: 'The run as it comes.' }),
    ...levels,
  ]);
}

// The Heat level a Heat submenu entry's id picks.
export function getHeatOfAction(id: string): number {
  return Number(id.replace('heat-', '')) || 0;
}

// The Warband Mode submenu's renown line: the renown earned so far, the
// highest Heat open (once one is), and the next unlock it leads to.
export function describeRenown(meta: MetaState): string {
  const next = getNextUnlock(meta);
  const heat = hasHeatPick(meta) ? ` · Heat ${meta.heat}` : '';
  return `Renown ${meta.renown}${heat} · ${next ? `Next: ${next.label} at ${next.renown}` : 'Everything unlocked'}`;
}

// The entry to select when a menu opens: the first that isn't disabled
// (or the first, if they all are).
export function getFirstEnabledIndex(actions: readonly MenuAction[]): number {
  return Math.max(
    0,
    actions.findIndex((action) => !action.disabled),
  );
}
