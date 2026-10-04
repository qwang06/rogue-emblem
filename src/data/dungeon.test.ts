import { describe, expect, it } from 'vitest';
import { parseDungeonSettings } from '../game/dungeonConfigFile.ts';
import { DUNGEON_CONFIGS, DUNGEON_SETTINGS, DUNGEON_TEXT } from './dungeon.ts';

// Importing dungeon.ts parses dungeon.json, so a mistake in it fails this
// suite before the game ever shows it.
describe('DUNGEON_SETTINGS', () => {
  it('generates a map for every floor', () => {
    expect(() => parseDungeonSettings(DUNGEON_TEXT)).not.toThrow();
  });

  it('moves to the next config every floor', () => {
    expect(DUNGEON_SETTINGS.floorsPerConfig).toBe(1);
  });

  it('has several uniquely named, described floor configs', () => {
    expect(DUNGEON_CONFIGS.length).toBeGreaterThan(1);
    expect(new Set(DUNGEON_CONFIGS.map((c) => c.name)).size).toBe(DUNGEON_CONFIGS.length);
    for (const config of DUNGEON_CONFIGS) expect(config.description).toBeTruthy();
  });

  it('starts on the Meadowlands', () => {
    expect(DUNGEON_CONFIGS[0].name).toBe('Meadowlands');
  });
});
