// Buildings a map can hold: each stands on one tile (tall ones only overhang
// the tile north of it). Which art a kind draws with lives in tileset.ts
// (BUILDING_ART); every building on a map shares one color palette
// (BUILDING_PALETTES), picked per level.

import type { Point } from './grid.ts';

export const BUILDING_KINDS = [
  'house',
  'fort',
  'temple',
  'windmill',
  'camp',
  'workshop',
  'farm',
  'fountain',
  'goldMine',
  'mine',
  'tower',
  'castle',
] as const;

export type BuildingKind = (typeof BUILDING_KINDS)[number];

export interface BuildingPlacement extends Point {
  building: BuildingKind;
}
