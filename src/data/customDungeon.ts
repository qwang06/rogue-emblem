// Keeps the dungeon settings file the player uploads in the config editor
// (see src/game/dungeonConfigFile.ts for the format), stored as written so
// it can be downloaded again.

import { parseDungeonSettings } from '../game/dungeonConfigFile.ts';
import type { DungeonSettings } from '../game/dungeonConfigs.ts';
import { DUNGEON_SETTINGS } from './dungeon.ts';
import { browserStorage, createStoredText, type StoredText } from './customStorage.ts';

export const CUSTOM_DUNGEON_KEY = 'rogue-emblem:custom-dungeon';

export const customDungeonStore = createStoredText(browserStorage(), CUSTOM_DUNGEON_KEY);

// The settings an uploaded file's text stands for: the built-in ones when
// there's no upload, or when it no longer parses (`error` says why).
export function readDungeonUpload(text: string | null): { settings: DungeonSettings; error: string | null } {
  if (text === null) return { settings: DUNGEON_SETTINGS, error: null };
  try {
    return { settings: parseDungeonSettings(text), error: null };
  } catch (error) {
    return { settings: DUNGEON_SETTINGS, error: (error as Error).message };
  }
}

// The settings Dungeon Mode plays: this browser's upload, else the built-in ones.
export function getActiveDungeonSettings(store: StoredText = customDungeonStore): DungeonSettings {
  return readDungeonUpload(store.load()).settings;
}
