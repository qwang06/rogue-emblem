import { describe, expect, it } from 'vitest';
import { formatRegionSettings } from '../game/warband/regionsFile.ts';
import { REGION_CONFIGS, REGION_SETTINGS } from './regions.ts';
import { getActiveRegionSettings, readRegionsUpload } from './customRegions.ts';
import { createStoredText } from './customStorage.ts';
import { memoryStorage } from './testStorage.ts';

// With a spawn area on its first group, which old uploads called `region`.
const base = REGION_CONFIGS[2];
const custom = {
  stagesPerRegion: 3,
  regions: [
    {
      ...base,
      name: 'Custom',
      enemies: base.enemies.map((group, i) => (i === 0 ? { ...group, area: { y: [0, 0.34] as const } } : group)),
    },
  ],
};

describe('readRegionsUpload', () => {
  it('uses the built-in settings with no upload', () => {
    expect(readRegionsUpload(null)).toEqual({ settings: REGION_SETTINGS, error: null });
  });

  it('reads an upload and caches the parsed settings for the same text', () => {
    const text = formatRegionSettings(custom);
    const first = readRegionsUpload(text);
    expect(first).toEqual({ settings: custom, error: null });
    expect(readRegionsUpload(text).settings).toBe(first.settings);
  });

  it('falls back to the built-in settings when the upload no longer parses', () => {
    const { settings, error } = readRegionsUpload('{"stagesPerRegion": 0, "regions": []}');
    expect(settings).toBe(REGION_SETTINGS);
    expect(error).toContain('stagesPerRegion');
  });
});

describe('getActiveRegionSettings', () => {
  it("plays this browser's upload", () => {
    const store = createStoredText(memoryStorage(), 'k');
    expect(getActiveRegionSettings(store)).toBe(REGION_SETTINGS);
    store.save(formatRegionSettings(custom));
    expect(getActiveRegionSettings(store).regions[0].name).toBe('Custom');
  });
});

describe('an upload from before Warband Mode', () => {
  it('still plays, read from its old shape', () => {
    const store = createStoredText(memoryStorage(), 'k');
    const floors = custom.regions.map((region) => ({
      ...region,
      enemies: region.enemies.map(({ area, ...group }) => (area ? { ...group, region: area } : group)),
    }));
    expect(JSON.stringify(floors)).toContain('"region"');
    store.save(JSON.stringify({ floorsPerConfig: 3, floors }));
    expect(getActiveRegionSettings(store)).toEqual(custom);
  });
});
