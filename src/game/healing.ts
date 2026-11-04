// Pure rules for healing. A staff is gear a healer holds in its main hand
// (see equipment.ts) and uses through the Heal action on a wounded ally
// within its range: the ally regains the staff's power plus the healer's
// intelligence, capped at its missing health, and the healer earns XP.
// Staves never break, and they aren't weapons: they can't attack or
// counter (a healer fights with the spells it knows). No Phaser, no
// rendering, no hidden state.

import type { Curse } from './curses.ts';
import type { Modifier } from './modifiers.ts';
import { getAttackTargets, type TargetTile } from './combat.ts';
import type { Grid, Point } from './grid.ts';
import type { InventoryEntry } from './items.ts';

// A staff: { kind: 'staff', id, label, hands, power, minRange, maxRange }.
// `power` adds to the healer's intelligence for the health it restores.
// Every staff takes both hands, so a unit holding one can't wear a shield
// (see hasHandFree in equipment.ts).
export interface Staff {
  kind: 'staff';
  id: string;
  label: string;
  hands: 2;
  power: number;
  minRange: number;
  maxRange: number;
  // What wearing it adds (modifiers.ts) and costs (curses.ts), for gear
  // that bends a rule; see getGearModifiers in equipment.ts.
  modifiers?: readonly Modifier[];
  curses?: readonly Curse[];
}

// A staff a unit holds, and its place in the unit's staff list (see
// Unit.staves).
export interface CarriedStaff {
  staff: Staff;
  index: number;
}

// What a heal reads off the healer and the ally it heals.
export interface Healer {
  intelligence: number;
}

export interface Patient {
  health: number;
  maxHealth: number;
}

// XP for each heal, whatever the levels: the same as landing a hit on an
// opponent of the healer's own level (see getHitExperience).
export const HEAL_EXPERIENCE = 10;

// The acolyte's staff: mends an adjacent ally.
export const HEAL_STAFF: Staff = Object.freeze({
  kind: 'staff',
  id: 'heal-staff',
  label: 'Heal',
  hands: 2,
  power: 2,
  minRange: 1,
  maxRange: 1,
});

// An inventory entry for staff (one of it).
export function staffEntry(staff: Staff): InventoryEntry {
  return Object.freeze({ item: staff, quantity: 1 });
}

export function isStaff(item: { kind: string }): item is Staff {
  return item.kind === 'staff';
}

// Whether an ally can be healed: alive and below its maximum health.
export function isWounded(patient: Patient): boolean {
  return patient.health > 0 && patient.health < patient.maxHealth;
}

// Health a heal with staff restores to patient: the staff's power plus the
// healer's intelligence, capped at what the patient is missing (never below 0).
export function getHealAmount(healer: Healer, staff: Pick<Staff, 'power'>, patient: Patient): number {
  const missing = Math.max(0, patient.maxHealth - patient.health);
  return Math.max(0, Math.min(staff.power + healer.intelligence, missing));
}

// The tiles of allies staff can reach from origin that `canHeal` accepts
// (the caller passes wounded allies), as [{ x, y, unitId }].
export function getHealTargets(
  grid: Grid,
  origin: Point,
  staff: Pick<Staff, 'minRange' | 'maxRange'>,
  canHeal: (unitId: string) => boolean,
): TargetTile[] {
  return getAttackTargets(grid, origin, staff.maxRange, canHeal, staff.minRange);
}

// The first of `staves` that `hasTarget` says can reach someone to heal,
// or null.
export function findUsableStaff(
  staves: readonly CarriedStaff[],
  hasTarget: (staff: Staff) => boolean,
): CarriedStaff | null {
  return staves.find(({ staff }) => hasTarget(staff)) ?? null;
}
