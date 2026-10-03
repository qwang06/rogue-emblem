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

// A unit can go on a zone tile that's empty, or that it already stands on.
export function canPlaceUnit(grid: Grid, zone: readonly Point[], unitId: string, x: number, y: number): boolean {
  if (!isInZone(zone, x, y)) return false;
  const cell = getCell(grid, x, y);
  if (!cell) return false;
  return cell.unitId === null || cell.unitId === unitId;
}

// Puts unitId on (x, y), lifting it off wherever it was placed before.
// Throws if the tile isn't a valid spot — check canPlaceUnit first.
export function placeUnit(grid: Grid, zone: readonly Point[], unitId: string, x: number, y: number): Grid {
  if (!canPlaceUnit(grid, zone, unitId, x, y)) {
    throw new Error(`${unitId} can't be placed on (${x}, ${y})`);
  }
  const current = findUnit(grid, unitId);
  if (current?.x === x && current?.y === y) return grid;
  const lifted = current ? setUnit(grid, current.x, current.y, null) : grid;
  return setUnit(lifted, x, y, unitId);
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
