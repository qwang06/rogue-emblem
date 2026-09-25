// Pure combat rules: which tiles a unit can strike, which of those hold a
// valid target, and how much damage a hit deals. No Phaser, no rendering,
// no hidden state — applying the damage to a Unit is the caller's job.

import { getCell, isInBounds } from './grid.js';

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

// Every in-bounds tile from minRange to maxRange steps away (orthogonal
// distance, like movement), as [{ x, y }]. The attacker's own tile is never
// included. Terrain and units don't block — attacks aren't paths.
export function getAttackRange(grid, origin, maxRange, minRange = 1) {
  const tiles = [];
  const low = Math.max(1, minRange);
  for (let dy = -maxRange; dy <= maxRange; dy++) {
    for (let dx = -maxRange; dx <= maxRange; dx++) {
      const tile = { x: origin.x + dx, y: origin.y + dy };
      const distance = manhattan(origin, tile);
      if (distance < low || distance > maxRange) continue;
      if (isInBounds(grid, tile.x, tile.y)) tiles.push(tile);
    }
  }
  return tiles;
}

// The occupied tiles in attack range whose unit isHostile(unitId) accepts,
// as [{ x, y, unitId }].
export function getAttackTargets(grid, origin, maxRange, isHostile, minRange = 1) {
  return getAttackRange(grid, origin, maxRange, minRange)
    .map(({ x, y }) => ({ x, y, unitId: getCell(grid, x, y).unitId }))
    .filter(({ unitId }) => unitId && isHostile(unitId));
}

// Damage one hit deals: attack minus defense, never below zero.
export function calculateDamage(attacker, defender) {
  return Math.max(0, attacker.attack - defender.defense);
}
