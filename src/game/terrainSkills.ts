// Pure rules for skills that change the map rather than strike a unit:
// mines (Lay Mine) and breaching (Breach, Breaching Shot), see the `mine`
// and `breach` fields of a skill in skills.ts. No Phaser, no hidden state.

import { getCell, isSameTile, type Grid, type Point, type Terrain } from './grid.ts';
import { areAllied } from './teams.ts';
import type { Team } from './turns.ts';

// A hidden mine on the map, laid by `team`: it goes off under the first
// foe of that team to walk onto it, for `damage`.
export interface Mine extends Point {
  team: Team;
  damage: number;
}

// The terrain a breach can knock down: a wall or a mountain's rock.
export const BREACHABLE_TERRAIN: ReadonlySet<string> = new Set(['wall', 'mountain']);

// What a breached tile becomes: open ground.
export const RUBBLE_TERRAIN = 'dirt';

export function canBreach(terrain: Terrain): boolean {
  return terrain !== null && BREACHABLE_TERRAIN.has(terrain);
}

// Whether a mine can be laid on `tile`: in bounds, empty and open ground
// (anything a unit can walk on).
export function canLayMineOn(grid: Grid, tile: Point, walkable: (terrain: Terrain) => boolean): boolean {
  const cell = getCell(grid, tile.x, tile.y);
  return cell !== undefined && cell.unitId === null && walkable(cell.terrain);
}

// `mines` with `mine` laid, replacing any already on its tile.
export function addMine(mines: readonly Mine[], mine: Mine): readonly Mine[] {
  return Object.freeze([...mines.filter((other) => !isSameTile(other, mine)), Object.freeze({ ...mine })]);
}

// `mines` without the one on `tile`.
export function removeMine(mines: readonly Mine[], tile: Point): readonly Mine[] {
  return Object.freeze(mines.filter((mine) => !isSameTile(mine, tile)));
}

// The first mine a unit of `team` walking `path` (starting on its own
// tile, which never counts) steps on that a foe of its team laid, or null.
export function findTrippedMine(mines: readonly Mine[], path: readonly Point[], team: Team): Mine | null {
  for (const tile of path.slice(1)) {
    const mine = mines.find((other) => isSameTile(other, tile));
    if (mine && !areAllied(mine.team, team)) return mine;
  }
  return null;
}

// What a mine's blast costs a unit with `health` HP: its damage, but never
// the unit's last HP.
export function getMineDamage(mine: Pick<Mine, 'damage'>, health: number): number {
  return Math.max(0, Math.min(mine.damage, health - 1));
}
