// Pure rules for healing. A staff is an item a healer carries in its
// inventory (see items.ts) and uses through the Heal action on a wounded
// ally within its range: the ally regains the staff's power plus the
// healer's magic, capped at its missing health, and the healer earns XP.
// A staff entry's `quantity` is the uses it has left, one spent per heal,
// and a staff that runs out breaks and is gone. Staves aren't weapons:
// they can't attack or counter. No Phaser, no rendering, no hidden state.

import { getAttackTargets, type TargetTile } from './combat.ts';
import type { Grid, Point } from './grid.ts';
import type { Inventory, InventoryEntry } from './items.ts';

// A staff: { kind: 'staff', id, label, power, minRange, maxRange, uses }.
// `power` adds to the healer's magic for the health it restores.
export interface Staff {
  kind: 'staff';
  id: string;
  label: string;
  power: number;
  minRange: number;
  maxRange: number;
  uses: number;
}

// A staff in an inventory: which one, its slot, and the uses it has left.
export interface CarriedStaff {
  staff: Staff;
  index: number;
  uses: number;
}

// What a heal reads off the healer and the ally it heals.
export interface Healer {
  magic: number;
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
  power: 2,
  minRange: 1,
  maxRange: 1,
  uses: 20,
});

// A fresh inventory entry for staff, with all its uses.
export function staffEntry(staff: Staff): InventoryEntry {
  return Object.freeze({ item: staff, quantity: staff.uses });
}

export function isStaff(item: { kind: string }): item is Staff {
  return item.kind === 'staff';
}

// Every staff in the inventory, in inventory order.
export function getStaves(inventory: Inventory): CarriedStaff[] {
  const result: CarriedStaff[] = [];
  inventory.forEach(({ item, quantity }, index) => {
    if (isStaff(item)) result.push({ staff: item, index, uses: quantity });
  });
  return result;
}

// Whether an ally can be healed: alive and below its maximum health.
export function isWounded(patient: Patient): boolean {
  return patient.health > 0 && patient.health < patient.maxHealth;
}

// Health a heal with staff restores to patient: the staff's power plus the
// healer's magic, capped at what the patient is missing (never below 0).
export function getHealAmount(healer: Healer, staff: Pick<Staff, 'power'>, patient: Patient): number {
  const missing = Math.max(0, patient.maxHealth - patient.health);
  return Math.max(0, Math.min(staff.power + healer.magic, missing));
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

// The first staff in the inventory that `hasTarget` says can reach
// someone to heal, or null.
export function findUsableStaff(inventory: Inventory, hasTarget: (staff: Staff) => boolean): CarriedStaff | null {
  return getStaves(inventory).find(({ staff }) => hasTarget(staff)) ?? null;
}

// Spends one use of the staff at `index` and returns { inventory, broke }:
// a staff that runs out is removed (broke is true). Throws if there's no
// staff there.
export function spendStaffUse(inventory: Inventory, index: number): { inventory: Inventory; broke: boolean } {
  const entry = inventory[index];
  if (!entry || !isStaff(entry.item)) throw new Error(`No staff at slot ${index}`);
  const quantity = entry.quantity - 1;
  if (quantity > 0) {
    const next = inventory.map((e, i) => (i === index ? Object.freeze({ ...e, quantity }) : e));
    return { inventory: Object.freeze(next), broke: false };
  }
  return { inventory: Object.freeze(inventory.filter((_, i) => i !== index)), broke: true };
}
