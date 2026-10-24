// Keeps Warband Mode's meta-progression (renown and what it unlocked, see
// src/game/warband/meta.ts) in the browser's localStorage, across runs.
// Missing or blocked storage, or a save that doesn't parse, reads as a
// fresh start.

import { NEW_META, parseMeta, serializeMeta, type MetaState } from '../game/warband/meta.ts';
import { browserStorage, createStoredText, type StoredText } from './customStorage.ts';

export const META_SAVE_KEY = 'rogue-emblem:warband-meta';

export const metaSaveStore = createStoredText(browserStorage(), META_SAVE_KEY);

// The saved meta state, or a fresh one when there's none or it doesn't parse.
export function loadMeta(store: StoredText = metaSaveStore): MetaState {
  const text = store.load();
  return (text === null ? null : parseMeta(text)) ?? NEW_META;
}

// Saves `meta` over the earlier one. Returns false when storage couldn't
// be written.
export function saveMeta(meta: MetaState, store: StoredText = metaSaveStore): boolean {
  return store.save(serializeMeta(meta));
}
