// Keeps the regions file the player uploads in the config editor (see
// src/game/warband/regionsFile.ts for the format), stored as written so it
// can be downloaded again.

import { parseRegionSettings } from '../game/warband/regionsFile.ts';
import type { RegionSettings } from '../game/warband/regions.ts';
import { REGION_SETTINGS } from './regions.ts';
import { browserStorage, createStoredText, type StoredText } from './customStorage.ts';

// Named for Dungeon Mode, and kept so uploads from before the rename
// still play (the parser reads their old shape too).
export const CUSTOM_REGIONS_KEY = 'rogue-emblem:custom-dungeon';

export const customRegionsStore = createStoredText(browserStorage(), CUSTOM_REGIONS_KEY);

// The settings an uploaded file's text stands for: the built-in ones when
// there's no upload, or when it no longer parses (`error` says why).
export function readRegionsUpload(text: string | null): { settings: RegionSettings; error: string | null } {
  if (text === null) return { settings: REGION_SETTINGS, error: null };
  try {
    return { settings: parseRegionSettings(text), error: null };
  } catch (error) {
    return { settings: REGION_SETTINGS, error: (error as Error).message };
  }
}

// The settings Warband Mode plays: this browser's upload, else the built-in ones.
export function getActiveRegionSettings(store: StoredText = customRegionsStore): RegionSettings {
  return readRegionsUpload(store.load()).settings;
}
