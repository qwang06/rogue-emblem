// Short descriptions of a region's enemy groups for its card, e.g.
// "2 villager · rows 0–34% · 6–12 steps · 4 HP".

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

// The group's count and class, then whichever of its limits and its health are set.
export function describeEnemyGroup(group: EnemyGroup): string {
  const parts = [
    group.unitClass ? `${group.count} ${group.unitClass}` : String(group.count),
    span('columns', group.area?.x),
    span('rows', group.area?.y),
    distance(group),
    group.health !== undefined ? `${group.health} HP` : null,
    group.levelUpOnKill ? 'level up on kill' : null,
  ];
  return parts.filter((part) => part !== null).join(' · ');
}
