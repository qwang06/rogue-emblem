// Which region (regions.ts) a realm site plays as. A site's region sets
// its battle: the map's makeup, the enemies and their levels. The realm
// keeps difficulty rising with depth by only picking regions meant for
// stages near the site's depth, and keeps it logical by preferring one
// whose biome matches the land around the site: a battle by a lake plays
// Lakeside or the Fens, one in the woods Deep Woods. When the region was
// meant for an earlier or later stage, its enemies' levels shift by the
// difference (`levelOffset`), so the curve holds. Pure.

import type { Rng } from '../../combatStats.ts';
import { randomItem } from '../../rng.ts';
import type { RegionSettings } from '../regions.ts';
import type { Biome, SiteKind } from './realm.ts';
import { landAt, type RealmLand } from './realmTerrain.ts';

// The biomes a region can say it belongs to (RegionConfig.biome): the
// land's four, plus 'fort' for a region that plays as a fort site.
export const REGION_BIOMES = ['meadow', 'lake', 'forest', 'hills', 'fort'] as const;
export type RegionBiome = (typeof REGION_BIOMES)[number];

// How many stages before a site's depth a region it plays may be meant
// for (never after, since a later region fields more enemies, not just
// higher levels); forts look further back, and one stage ahead, for a fort
// region. A fort's enemies are FORT_LEVELS above the site's depth.
export const REGION_WINDOW = 1;
export const FORT_WINDOW = 3;
export const FORT_LEVELS = 1;

// The biome of the land around (x, y): the tiles within 2 steps, by what
// there's most of. A few water or mountain tiles are enough to count, since
// they're what a battle map is shaped by; otherwise forest, else meadow.
export function detectBiome(land: RealmLand, x: number, y: number): Biome {
  const counts = { water: 0, mountain: 0, forest: 0 };
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > 2) continue;
      const terrain = landAt(land, x + dx, y + dy);
      if (terrain === 'water' || terrain === 'bridge') counts.water++;
      else if (terrain === 'mountain') counts.mountain++;
      else if (terrain === 'forest') counts.forest++;
    }
  }
  if (counts.mountain >= 3 && counts.mountain >= counts.water) return 'hills';
  if (counts.water >= 3) return 'lake';
  if (counts.forest >= 4) return 'forest';
  return 'meadow';
}

// The stages region `index` is meant for: first to last (last Infinity for
// the last region, which every later stage falls back on).
export function getRegionSpan(settings: RegionSettings, index: number): { first: number; last: number } {
  const first = index * settings.stagesPerRegion + 1;
  const last = index === settings.regions.length - 1 ? Infinity : first + settings.stagesPerRegion - 1;
  return { first, last };
}

// The index of the region meant for `stage`.
export function getRegionIndex(settings: RegionSettings, stage: number): number {
  return Math.min(Math.floor((Math.max(1, stage) - 1) / settings.stagesPerRegion), settings.regions.length - 1);
}

// The region a site of `kind` at `depth` on land of `biome` plays, and how
// many levels its enemies shift (see the top of this file). The Hold plays
// the region of the final depth; depth 1 always plays the first region (the
// run's quick opener); a fort prefers a 'fort' region and fields its
// enemies FORT_LEVELS higher. Regions meant for the final depth are kept
// for the Hold.
export function pickSiteRegion(
  settings: RegionSettings,
  depth: number,
  finalDepth: number,
  kind: SiteKind,
  biome: Biome,
  rng: Rng,
): { region: number; levelOffset: number } {
  const finalRegion = getRegionIndex(settings, finalDepth);
  const offsetFor = (region: number) => {
    const { first, last } = getRegionSpan(settings, region);
    return depth - Math.min(Math.max(depth, first), last);
  };
  const result = (region: number) => ({ region, levelOffset: offsetFor(region) });
  if (kind === 'hold' || depth >= finalDepth) return result(finalRegion);
  if (depth <= 1) return result(getRegionIndex(settings, 1));
  const inWindow = (before: number, after: number) => {
    const indexes = new Set<number>();
    for (let stage = Math.max(1, depth - before); stage <= depth + after; stage++) {
      const index = getRegionIndex(settings, stage);
      if (index !== finalRegion) indexes.add(index);
    }
    return [...indexes];
  };
  const biomeOf = (index: number) => settings.regions[index].biome;
  if (kind === 'fort') {
    const forts = inWindow(FORT_WINDOW, 1).filter((index) => biomeOf(index) === 'fort');
    const region = forts.length > 0 ? closest(forts, depth, settings, rng) : getRegionIndex(settings, depth);
    return { region, levelOffset: offsetFor(region) + FORT_LEVELS };
  }
  const candidates = inWindow(REGION_WINDOW, 0);
  if (candidates.length === 0) return result(getRegionIndex(settings, depth));
  const plain = candidates.filter((index) => biomeOf(index) !== 'fort');
  const pool = plain.length > 0 ? plain : candidates;
  const matching = pool.filter((index) => biomeOf(index) === biome);
  return result(closest(matching.length > 0 ? matching : pool, depth, settings, rng));
}

// The regions of `indexes` meant for stages nearest `depth`, one picked
// at random when several tie.
function closest(indexes: readonly number[], depth: number, settings: RegionSettings, rng: Rng): number {
  const distance = (index: number) => {
    const { first, last } = getRegionSpan(settings, index);
    return depth < first ? first - depth : depth > last ? depth - last : 0;
  };
  const nearest = Math.min(...indexes.map(distance));
  return randomItem(
    rng,
    indexes.filter((index) => distance(index) === nearest),
  );
}
