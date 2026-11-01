// Pure rules for statuses: short-lived conditions a skill leaves on a unit
// in battle (see the `status` field of a skill in skills.ts). A unit keeps
// its statuses in `Unit.statuses` for the battle only (never saved), and
// they wear off by kind (see startPhase in battle/commands.ts):
// - a debuff, laid on a foe, lasts until the end of the foe's own next
//   phase: one laid in the player phase lasts through the enemy phase that
//   follows, so allies can follow it up first;
// - a buff, given to an ally, lasts until the start of the ally's own next
//   phase: one given in the player phase holds through the enemy phase.
// No Phaser, no hidden state.
//
// Debuffs:
// - Rooted: it can't move (getPhaseMovement in enemyAI.ts reads it).
// - Sundered: it takes 3 more damage from every hit.
// - Marked: it has 15 less avoid.
// Buffs:
// - Guarded: it takes 2 less damage from every hit.
// - Warded: it takes 4 less damage from every hit.
// - Hastened: it moves 2 more tiles.

import type { Modifier } from './modifiers.ts';

export const STATUS_IDS = Object.freeze(['rooted', 'sundered', 'marked', 'guarded', 'warded', 'hastened'] as const);
export type StatusId = (typeof STATUS_IDS)[number];

export type StatusKind = 'buff' | 'debuff';

export interface Status {
  id: StatusId;
  kind: StatusKind;
  label: string;
  description: string;
  // What it adds to the unit's combat, like a modifier it carries.
  modifiers: readonly Modifier[];
}

export const STATUSES: Readonly<Record<StatusId, Status>> = Object.freeze({
  rooted: Object.freeze({
    id: 'rooted',
    kind: 'debuff',
    label: 'Rooted',
    description: "Can't move.",
    modifiers: Object.freeze([]),
  }),
  sundered: Object.freeze({
    id: 'sundered',
    kind: 'debuff',
    label: 'Sundered',
    description: 'Takes 3 more damage from every hit.',
    modifiers: Object.freeze([Object.freeze<Modifier>({ kind: 'combat', term: 'guard', amount: -3 })]),
  }),
  marked: Object.freeze({
    id: 'marked',
    kind: 'debuff',
    label: 'Marked',
    description: '15 less avoid.',
    modifiers: Object.freeze([Object.freeze<Modifier>({ kind: 'combat', term: 'avoid', amount: -15 })]),
  }),
  guarded: Object.freeze({
    id: 'guarded',
    kind: 'buff',
    label: 'Guarded',
    description: 'Takes 2 less damage from every hit.',
    modifiers: Object.freeze([Object.freeze<Modifier>({ kind: 'combat', term: 'guard', amount: 2 })]),
  }),
  warded: Object.freeze({
    id: 'warded',
    kind: 'buff',
    label: 'Warded',
    description: 'Takes 4 less damage from every hit.',
    modifiers: Object.freeze([Object.freeze<Modifier>({ kind: 'combat', term: 'guard', amount: 4 })]),
  }),
  hastened: Object.freeze({
    id: 'hastened',
    kind: 'buff',
    label: 'Hastened',
    description: '+2 MOV.',
    modifiers: Object.freeze([]),
  }),
});

// MOV Hastened adds.
export const HASTE_MOVEMENT = 2;

// `statuses` without those of `kind`, as one wears off.
export function clearStatuses(statuses: readonly StatusId[], kind: StatusKind): readonly StatusId[] {
  return Object.freeze(statuses.filter((id) => STATUSES[id].kind !== kind));
}

// The MOV `statuses` add (Hastened).
export function getStatusMovement(unit: { statuses?: readonly StatusId[] }): number {
  return unit.statuses?.includes('hastened') ? HASTE_MOVEMENT : 0;
}

// `statuses` with `id` added, unless it's there already (a status doesn't
// stack).
export function addStatus(statuses: readonly StatusId[], id: StatusId): readonly StatusId[] {
  return statuses.includes(id) ? statuses : Object.freeze([...statuses, id]);
}

// Every modifier `statuses` add, in order.
export function getStatusModifiers(statuses: readonly StatusId[] | undefined): Modifier[] {
  return (statuses ?? []).flatMap((id) => STATUSES[id].modifiers);
}

// Whether a unit with `statuses` is rooted to its tile.
export function isRooted(unit: { statuses?: readonly StatusId[] }): boolean {
  return unit.statuses?.includes('rooted') ?? false;
}
