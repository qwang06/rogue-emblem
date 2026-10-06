// Short descriptions of a dungeon floor's enemy groups for its config
// card, e.g. "2 · rows 0–34% · 6–12 steps".

import type { EnemyGroup } from '../game/enemySpawns.ts';

const percent = (n: number) => Math.round(n * 100);

function span(name: string, fractions?: readonly [number, number]): string | null {
  return fractions ? `${name} ${percent(fractions[0])}–${percent(fractions[1])}%` : null;
}

function distance({ minDistance: min, maxDistance: max }: EnemyGroup): string | null {
  if (min !== undefined && max !== undefined) return min === max ? `${min} steps` : `${min}–${max} steps`;
  if (min !== undefined) return `${min}+ steps`;
  if (max !== undefined) return `up to ${max} steps`;
  return null;
}

// The group's count, then whichever of its limits are set.
export function describeEnemyGroup(group: EnemyGroup): string {
  const parts = [String(group.count), span('columns', group.region?.x), span('rows', group.region?.y), distance(group)];
  return parts.filter((part) => part !== null).join(' · ');
}
