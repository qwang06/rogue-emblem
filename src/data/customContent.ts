// The game content battles are built from: the built-in data with this
// browser's config editor uploads in place of what they replace. The map
// scene reads it once per battle, so an upload applies from the next one.

import type { GameContent } from '../game/battleSetup.ts';
import { getActiveDialogs } from './customDialogs.ts';
import { getActiveDungeonSettings } from './customDungeon.ts';

export function getActiveContent(): GameContent {
  return { dialogs: getActiveDialogs(), dungeon: getActiveDungeonSettings() };
}
