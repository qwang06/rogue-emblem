import { describe, expect, it } from 'vitest';
import { parseRegionSettings } from '../game/warband/regionsFile.ts';
import { REGION_CONFIGS, REGION_SETTINGS, REGIONS_TEXT } from './regions.ts';

// Importing regions.ts parses regions.json, so a mistake in it fails this
// suite before the game ever shows it.
describe('REGION_SETTINGS', () => {
  it('generates a map for every region', () => {
    expect(() => parseRegionSettings(REGIONS_TEXT)).not.toThrow();
  });

  it('moves to the next region every stage', () => {
    expect(REGION_SETTINGS.stagesPerRegion).toBe(1);
  });

  it('has several uniquely named, described regions', () => {
    expect(REGION_CONFIGS.length).toBeGreaterThan(1);
    expect(new Set(REGION_CONFIGS.map((c) => c.name)).size).toBe(REGION_CONFIGS.length);
    for (const region of REGION_CONFIGS) expect(region.description).toBeTruthy();
  });

  it('starts on the Meadowlands', () => {
    expect(REGION_CONFIGS[0].name).toBe('Meadowlands');
  });
});
