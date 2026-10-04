// What a small map preview draws for each tile of a level: its terrain, and
// at most one marker for what stands on it. Pure, so the config editor's
// preview component only has to turn cells into squares.

import type { BattleLevel } from '../game/battleSetup.ts';

export type PreviewMarker = 'enemy' | 'player' | 'deploy' | 'building' | 'tree';

export interface PreviewCell {
  x: number;
  y: number;
  terrain: string;
  marker: PreviewMarker | null;
}

const key = (x: number, y: number) => `${x},${y}`;

// One cell per tile in reading order. Units win over buildings, buildings
// over the deployment zone, and that over trees.
export function getMapPreview(level: BattleLevel): PreviewCell[] {
  const buildings = new Set((level.buildings ?? []).map((b) => key(b.x, b.y)));
  const deploy = new Set(level.deploymentZone.map((p) => key(p.x, p.y)));
  const trees = new Set((level.decorations ?? []).map((t) => key(t.x, t.y)));

  return level.grid.cells.map(({ x, y, terrain, unitId }) => {
    const here = key(x, y);
    const unit = unitId ? level.units.get(unitId) : undefined;
    let marker: PreviewMarker | null = null;
    if (unit) marker = unit.team === 'enemy' ? 'enemy' : 'player';
    else if (buildings.has(here)) marker = 'building';
    else if (deploy.has(here)) marker = 'deploy';
    else if (trees.has(here)) marker = 'tree';
    return { x, y, terrain: terrain ?? 'grass', marker };
  });
}
