import { describe, expect, it } from 'vitest';
import { formatDungeonSettings } from '../game/dungeonConfigFile.ts';
import { DUNGEON_CONFIGS, DUNGEON_SETTINGS } from './dungeon.ts';
import { getActiveDungeonSettings, readDungeonUpload } from './customDungeon.ts';
import { createStoredText } from './customStorage.ts';
import { memoryStorage } from './testStorage.ts';

const custom = { floorsPerConfig: 3, floors: [{ ...DUNGEON_CONFIGS[2], name: 'Custom' }] };

describe('readDungeonUpload', () => {
  it('uses the built-in settings with no upload', () => {
    expect(readDungeonUpload(null)).toEqual({ settings: DUNGEON_SETTINGS, error: null });
  });

  it('reads an upload', () => {
    expect(readDungeonUpload(formatDungeonSettings(custom))).toEqual({ settings: custom, error: null });
  });

  it('falls back to the built-in settings when the upload no longer parses', () => {
    const { settings, error } = readDungeonUpload('{"floorsPerConfig": 0, "floors": []}');
    expect(settings).toBe(DUNGEON_SETTINGS);
    expect(error).toContain('floorsPerConfig');
  });
});

describe('getActiveDungeonSettings', () => {
  it("plays this browser's upload", () => {
    const store = createStoredText(memoryStorage(), 'k');
    expect(getActiveDungeonSettings(store)).toBe(DUNGEON_SETTINGS);
    store.save(formatDungeonSettings(custom));
    expect(getActiveDungeonSettings(store).floors[0].name).toBe('Custom');
  });
});
