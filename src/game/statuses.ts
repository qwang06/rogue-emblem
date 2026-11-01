// Pure rules for statuses: short-lived conditions a skill leaves on a unit
// in battle (see the `status` field of a skill in skills.ts). A unit keeps
// its statuses in `Unit.statuses` until its own team's next phase ends,
// when they all wear off (see startPhase in battle/commands.ts): one laid
// on a foe in the player phase lasts through the enemy phase that follows,
// so allies can follow it up first. Statuses are battle-only and never
// saved. No Phaser, no hidden state.
//
// - Rooted: it can't move (getPhaseMovement in enemyAI.ts reads it).
// - Sundered: it takes 3 more damage from every hit.
// - Marked: it has 15 less avoid.

import type { Modifier } from './modifiers.ts';

export const STATUS_IDS = Object.freeze(['rooted', 'sundered', 'marked'] as const);
export type StatusId = (typeof STATUS_IDS)[number];

export interface Status {
  id: StatusId;
  label: string;
  description: string;
  // What it adds to the unit's combat, like a modifier it carries.
  modifiers: readonly Modifier[];
}

export const STATUSES: Readonly<Record<StatusId, Status>> = Object.freeze({
  rooted: Object.freeze({ id: 'rooted', label: 'Rooted', description: "Can't move.", modifiers: Object.freeze([]) }),
  sundered: Object.freeze({
    id: 'sundered',
    label: 'Sundered',
    description: 'Takes 3 more damage from every hit.',
    modifiers: Object.freeze([Object.freeze<Modifier>({ kind: 'combat', term: 'guard', amount: -3 })]),
  }),
  marked: Object.freeze({
    id: 'marked',
    label: 'Marked',
    description: '15 less avoid.',
    modifiers: Object.freeze([Object.freeze<Modifier>({ kind: 'combat', term: 'avoid', amount: -15 })]),
  }),
});

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
