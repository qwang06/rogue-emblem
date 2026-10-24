import { describe, expect, it } from 'vitest';
import { DEFAULT_CONTENT } from '../../battleSetup.ts';
import { createSeededRng } from '../../rng.ts';
import type { RegionSettings } from '../regions.ts';
import { detectBiome, FORT_LEVELS, getRegionIndex, getRegionSpan, pickSiteRegion } from './realmRegions.ts';
import type { RealmLand, RealmTerrain } from './realmTerrain.ts';

const SETTINGS = DEFAULT_CONTENT.regions;

function landOf(rows: readonly string[]): RealmLand {
  const terrain: Record<string, RealmTerrain> = { '.': 'grass', '~': 'water', '^': 'mountain', T: 'forest' };
  return { width: rows[0].length, height: rows.length, cells: rows.flatMap((row) => [...row].map((c) => terrain[c])) };
}

describe('detectBiome', () => {
  it('reads the land within two steps by what shapes it most', () => {
    expect(detectBiome(landOf(['.....', '.....', '.....', '.....', '.....']), 2, 2)).toBe('meadow');
    expect(detectBiome(landOf(['..~..', '.~~..', '.....', '.....', '.....']), 2, 2)).toBe('lake');
    expect(detectBiome(landOf(['..^..', '.^^^.', '.....', '.....', '.....']), 2, 2)).toBe('hills');
    expect(detectBiome(landOf(['..T..', '.TTT.', '.....', '.....', '.....']), 2, 2)).toBe('forest');
  });

  it('counts only what lies inside the map', () => {
    expect(detectBiome(landOf(['~~', '~.']), 1, 1)).toBe('lake');
  });
});

describe('getRegionSpan and getRegionIndex', () => {
  const settings: RegionSettings = { ...SETTINGS, stagesPerRegion: 2 };

  it('gives each region its stages, the last region every later one', () => {
    expect(getRegionSpan(settings, 0)).toEqual({ first: 1, last: 2 });
    expect(getRegionSpan(settings, 1)).toEqual({ first: 3, last: 4 });
    expect(getRegionSpan(settings, settings.regions.length - 1).last).toBe(Infinity);
  });

  it('finds the region for a stage, clamped to the list', () => {
    expect(getRegionIndex(settings, 0)).toBe(0);
    expect(getRegionIndex(settings, 4)).toBe(1);
    expect(getRegionIndex(settings, 999)).toBe(settings.regions.length - 1);
  });
});

describe('pickSiteRegion', () => {
  const rng = () => createSeededRng(9);
  const final = SETTINGS.regions.length - 1;

  it('plays the final region at the Hold, and the first at depth 1', () => {
    expect(pickSiteRegion(SETTINGS, 10, 10, 'hold', 'meadow', rng()).region).toBe(final);
    expect(pickSiteRegion(SETTINGS, 1, 10, 'battle', 'lake', rng())).toEqual({ region: 0, levelOffset: 0 });
  });

  it("prefers a region whose biome matches the site's land, from its depth or one before", () => {
    for (let depth = 2; depth < 9; depth++) {
      for (const biome of ['meadow', 'lake', 'forest', 'hills'] as const) {
        const { region, levelOffset } = pickSiteRegion(SETTINGS, depth, 10, 'battle', biome, rng());
        expect([depth - 1, depth - 2]).toContain(region);
        expect(levelOffset).toBe(depth - 1 - region);
        const matches = [depth - 1, depth - 2].filter((i) => SETTINGS.regions[i]?.biome === biome);
        if (matches.length > 0) expect(matches).toContain(region);
        expect(SETTINGS.regions[region].biome).not.toBe('fort');
      }
    }
  });

  it('sends a fort to a fort region, its enemies FORT_LEVELS stronger', () => {
    const fortIndex = SETTINGS.regions.findIndex((region) => region.biome === 'fort');
    const depth = fortIndex + 1;
    expect(pickSiteRegion(SETTINGS, depth, 10, 'fort', 'meadow', rng())).toEqual({
      region: fortIndex,
      levelOffset: FORT_LEVELS,
    });
  });

  it('never plays the final region before the Hold', () => {
    for (let depth = 2; depth < 10; depth++) {
      expect(pickSiteRegion(SETTINGS, depth, 10, 'battle', 'meadow', rng()).region).not.toBe(final);
    }
  });
});
