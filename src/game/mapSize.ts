// How big a Warband stage's map is: sized to the fight on it, so a stage
// with one slime gets a small field and a stage with eight enemies gets
// room to move, while the walk to the enemy stays short. Pure: the same
// inputs and Rng always give the same size.
//
// The rule:
// - area: about TILES_PER_UNIT walkable tiles for every unit on the field
//   (the deploy cap plus the enemies), assuming OPEN_SHARE of the map is
//   walkable, never less than the region's own size
// - shape: each archetype's aspect (width over height): wide for fights
//   that run side to side, near square for an ambush; maps grow wide
//   before they grow deep, since depth is what the warband has to walk
// - the seed nudges the width a column either way
// - never past MAX_MAP_SIZE (or an archetype's own cap), so the whole map
//   fits the battle camera at 2x on a desktop window

import type { Rng } from './combatStats.ts';
import type { MapArchetype } from './mapArchetypes.ts';
import { MAP_GEN_DEFAULTS, type MapGenOptions } from './mapGen.ts';

export interface MapSize {
  width: number;
  height: number;
}

// Walkable tiles each unit on the field gets.
export const TILES_PER_UNIT = 8;
// The share of a map that's walkable, for sizing (maps run 0.8 to 0.95).
export const OPEN_SHARE = 0.85;
// The smallest and largest a stage's map may be.
export const MIN_MAP_SIZE: Readonly<MapSize> = Object.freeze({ width: 8, height: 8 });
export const MAX_MAP_SIZE: Readonly<MapSize> = Object.freeze({ width: 14, height: 10 });

export interface ArchetypeShape {
  // Width over height.
  aspect: number;
  // Caps tighter than MAX_MAP_SIZE, e.g. a gauntlet's switchback, whose
  // road grows twice as fast as its width.
  maxWidth?: number;
  maxHeight?: number;
}

export const ARCHETYPE_SHAPES: Readonly<Record<MapArchetype, Readonly<ArchetypeShape>>> = Object.freeze({
  advance: Object.freeze({ aspect: 1.35 }),
  crossroads: Object.freeze({ aspect: 1.5 }),
  islands: Object.freeze({ aspect: 1.5 }),
  ambush: Object.freeze({ aspect: 1.15 }),
  gauntlet: Object.freeze({ aspect: 1.1, maxWidth: 10, maxHeight: 9 }),
  fortress: Object.freeze({ aspect: 1.3 }),
});

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

// The tiles a map for `unitCount` units should have: TILES_PER_UNIT
// walkable tiles each, OPEN_SHARE of the map walkable.
export function getTargetArea(unitCount: number): number {
  return Math.ceil((TILES_PER_UNIT * Math.max(0, unitCount)) / OPEN_SHARE);
}

// The map size for `unitCount` units on an `archetype` map (see the top
// of this file), at least `min` (the region's own size) and at most
// MAX_MAP_SIZE and the archetype's caps. When `min` is past the caps, `min`
// wins, so a region authored bigger keeps its size.
export function getMapSize(unitCount: number, archetype: MapArchetype, rng: Rng, min: MapSize = MIN_MAP_SIZE): MapSize {
  const shape = ARCHETYPE_SHAPES[archetype];
  const maxWidth = Math.max(min.width, Math.min(MAX_MAP_SIZE.width, shape.maxWidth ?? Infinity));
  const maxHeight = Math.max(min.height, Math.min(MAX_MAP_SIZE.height, shape.maxHeight ?? Infinity));
  const area = Math.max(min.width * min.height, getTargetArea(unitCount));
  const height = clamp(Math.round(Math.sqrt(area / shape.aspect)), min.height, maxHeight);
  const nudge = Math.floor(rng() * 3) - 1;
  const width = clamp(Math.round(area / height) + nudge, min.width, maxWidth);
  return { width, height };
}

// The fill counts generateTerrain reads (see MapGenOptions), which scale
// with a map's area.
const SCALED_COUNTS = ['lakes', 'mountains', 'forests', 'meadows', 'ruins', 'buildings'] as const;

// `count` times `scale`, rounded up or down at random by its fraction, so
// on average it scales exactly.
export function scaleCount(count: number, scale: number, rng: Rng): number {
  const scaled = count * scale;
  const whole = Math.floor(scaled);
  return whole + (rng() < scaled - whole ? 1 : 0);
}

// `options` laid out at `size` instead: the size set, and each patch,
// ruin and building count (or its default when unset) scaled by how much
// the area grew, so a region keeps its mix of terrain on a bigger map.
// Patch sizes stay as they are: a bigger map has more patches, not bigger
// ones. Counts never shrink below the region's own.
export function resizeMapOptions(options: MapGenOptions, size: MapSize, rng: Rng): MapGenOptions {
  const scale = Math.max(1, (size.width * size.height) / (options.width * options.height));
  const counts = Object.fromEntries(
    SCALED_COUNTS.map((name) => [name, scaleCount(options[name] ?? MAP_GEN_DEFAULTS[name], scale, rng)]),
  );
  return { ...options, ...counts, width: size.width, height: size.height };
}
