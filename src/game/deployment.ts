// Pure rules for the deployment phase: before a battle starts, the player
// places units from their roster onto the tiles of a deployment zone.
// No Phaser, no rendering, no hidden state. Grid-changing functions return
// a new grid.

import type { MenuAction } from './actionMenu.ts';
import { findUnit, getCell, setUnit, type Grid, type Point } from './grid.ts';

// Entries of the deployment menu. Start is disabled until at least one
// unit has been placed; the caller decides what disabled means for input.
export function getDeploymentActions({ canStart }: { canStart: boolean }): readonly MenuAction[] {
  return Object.freeze([
    Object.freeze({ id: 'place-units', label: 'Place Units' }),
    Object.freeze({ id: 'start', label: 'Start', disabled: !canStart }),
  ]);
}

export function isInZone(zone: readonly Point[], x: number, y: number): boolean {
  return zone.some((tile) => tile.x === x && tile.y === y);
}

// A unit can go on a zone tile that's empty, that it already stands on, or
// that another of the `swappable` units (the roster) holds: placing it
// there swaps the two (see placeUnit). Anyone else, such as a guest, keeps
// their tile.
export function canPlaceUnit(
  grid: Grid,
  zone: readonly Point[],
  unitId: string,
  x: number,
  y: number,
  swappable: readonly string[] = [],
): boolean {
  if (!isInZone(zone, x, y)) return false;
  const cell = getCell(grid, x, y);
  if (!cell) return false;
  return cell.unitId === null || cell.unitId === unitId || swappable.includes(cell.unitId);
}

// Puts unitId on (x, y), lifting it off wherever it was placed before. A
// `swappable` unit already on the tile moves to where unitId stood, or
// off the map when unitId wasn't placed yet (it's benched in its place).
// Throws if the tile isn't a valid spot — check canPlaceUnit first.
export function placeUnit(
  grid: Grid,
  zone: readonly Point[],
  unitId: string,
  x: number,
  y: number,
  swappable: readonly string[] = [],
): Grid {
  if (!canPlaceUnit(grid, zone, unitId, x, y, swappable)) {
    throw new Error(`${unitId} can't be placed on (${x}, ${y})`);
  }
  const current = findUnit(grid, unitId);
  if (current?.x === x && current?.y === y) return grid;
  const occupant = getCell(grid, x, y)!.unitId;
  const lifted = current ? setUnit(grid, current.x, current.y, occupant) : grid;
  return setUnit(lifted, x, y, unitId);
}

// Whether placing unitId on (x, y) would take a slot from the roster unit
// standing there rather than need a free one.
export function replacesPlacedUnit(
  grid: Grid,
  roster: readonly string[],
  unitId: string,
  x: number,
  y: number,
): boolean {
  const occupant = getCell(grid, x, y)?.unitId;
  return occupant != null && occupant !== unitId && roster.includes(occupant);
}

export function isPlaced(grid: Grid, unitId: string): boolean {
  return findUnit(grid, unitId) !== null;
}

// The battle can start once at least one roster unit is on the map.
export function canStartBattle(grid: Grid, roster: readonly string[]): boolean {
  return roster.some((unitId) => isPlaced(grid, unitId));
}

// The first zone tile nobody stands on, or null when the zone is full.
export function getFirstOpenTile(grid: Grid, zone: readonly Point[]): Point | null {
  return zone.find((tile) => getCell(grid, tile.x, tile.y)?.unitId === null) ?? null;
}

// How many roster units are on the map.
export function countPlaced(grid: Grid, roster: readonly string[]): number {
  return roster.filter((unitId) => isPlaced(grid, unitId)).length;
}

// How many units this deployment can field: the level's `maxDeployed`,
// capped by how many units the roster has and how many tiles the zone has.
export function getDeploymentLimit(roster: readonly string[], zone: readonly Point[], maxDeployed: number): number {
  return Math.max(0, Math.min(maxDeployed, roster.length, zone.length));
}

// Whether unitId may be (re)placed: a unit already on the map can always
// move, a new one only while fewer than `limit` are placed.
export function canDeployUnit(grid: Grid, roster: readonly string[], limit: number, unitId: string): boolean {
  return isPlaced(grid, unitId) || countPlaced(grid, roster) < limit;
}

// Whether unitId can be picked to place: it can be (re)placed (canDeployUnit),
// or every slot is taken and it can go in a placed roster unit's place.
export function canPickToDeploy(grid: Grid, roster: readonly string[], limit: number, unitId: string): boolean {
  return canDeployUnit(grid, roster, limit, unitId) || countPlaced(grid, roster) > 0;
}

// Whether the roster unit unitId can be placed on (x, y) this deployment:
// a zone tile it can stand on (canPlaceUnit, swapping with a roster unit
// there), and either a slot for it or a roster unit there to take the
// place of.
export function canDeployUnitAt(
  grid: Grid,
  zone: readonly Point[],
  roster: readonly string[],
  limit: number,
  unitId: string,
  x: number,
  y: number,
): boolean {
  return (
    canPlaceUnit(grid, zone, unitId, x, y, roster) &&
    (canDeployUnit(grid, roster, limit, unitId) || replacesPlacedUnit(grid, roster, unitId, x, y))
  );
}

// Deployment is complete once every slot is filled (`limit` from
// getDeploymentLimit) — there's nothing left to place.
export function isDeploymentComplete(grid: Grid, roster: readonly string[], limit: number): boolean {
  return countPlaced(grid, roster) >= limit;
}
