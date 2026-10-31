import { describe, expect, it } from 'vitest';
import { BATTLEFIELD_SIZE } from '../game/battlefields.ts';
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

  // Every region is fought on the battlefield's size, the open ground the
  // painted battlefields leave clear.
  it('uses BATTLEFIELD_SIZE maps', () => {
    for (const region of REGION_CONFIGS) {
      expect([region.terrain.width, region.terrain.height]).toEqual([BATTLEFIELD_SIZE.width, BATTLEFIELD_SIZE.height]);
    }
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
