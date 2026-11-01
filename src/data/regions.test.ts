import { describe, expect, it } from 'vitest';
import { parseRegionSettings } from '../game/warband/regionsFile.ts';
import { REGION_CONFIGS, REGION_SETTINGS, REGIONS_TEXT } from './regions.ts';

// Importing regions.ts parses regions.json, so a mistake in it fails this
// suite before the game ever shows it.
describe('REGION_SETTINGS', () => {
  it('generates a map for every region', () => {
    expect(() => parseRegionSettings(REGIONS_TEXT)).not.toThrow();
  });

  it('spreads the regions over a 30-stage run', () => {
    expect(REGION_SETTINGS.stagesPerRegion).toBeUndefined();
    expect(REGION_SETTINGS.finalStage).toBe(30);
  });

  it('has several uniquely named, described regions', () => {
    expect(REGION_CONFIGS.length).toBeGreaterThan(1);
    expect(new Set(REGION_CONFIGS.map((c) => c.name)).size).toBe(REGION_CONFIGS.length);
    for (const region of REGION_CONFIGS) expect(region.description).toBeTruthy();
  });

  // Small maps keep a run fast: the enemy is a turn or two away.
  it('uses 8x8 maps', () => {
    for (const region of REGION_CONFIGS) {
      expect([region.terrain.width, region.terrain.height]).toEqual([8, 8]);
    }
  });

  // Starship is still being built: in the file, but no stage plays it.
  it('parks Starship outside the run, with the Hold still the finale', () => {
    expect(REGION_SETTINGS.parkedRegions?.map((r) => r.name)).toEqual(['Starship']);
    expect(REGION_CONFIGS.map((r) => r.name)).not.toContain('Starship');
    expect(REGION_CONFIGS.at(-1)?.name).toBe("Warlord's Hold");
  });

  it('starts on the Meadowlands', () => {
    expect(REGION_CONFIGS[0].name).toBe('Meadowlands');
  });

  it('follows the first recruit choice with two goblins, one wounded', () => {
    expect(REGION_CONFIGS[1].enemies).toMatchObject([
      { count: 1, unitClass: 'goblin' },
      { count: 1, unitClass: 'goblin', health: 5 },
    ]);
  });
});
