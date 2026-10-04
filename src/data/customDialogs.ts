// Keeps the dialog files the player uploads in the config editor, by
// dialog file name, in this browser's storage (see customStorage.ts).

import { applyCustomDialogs, type DialogTexts } from '../game/dialogUploads.ts';
import type { DialogFiles } from '../game/dialogScript.ts';
import { browserStorage, type KeyValueStorage } from './customStorage.ts';
import { CHARACTERS, DIALOGS } from './dialogs.ts';

export const CUSTOM_DIALOGS_KEY = 'rogue-emblem:custom-dialogs';

export interface CustomDialogStore {
  // Uploaded text by dialog file name; empty when there's none or storage fails.
  load(): DialogTexts;
  // Each returns false when storage couldn't be written.
  save(name: string, text: string): boolean;
  remove(name: string): boolean;
}

export function createCustomDialogStore(storage: KeyValueStorage | null): CustomDialogStore {
  function load(): DialogTexts {
    try {
      const parsed: unknown = JSON.parse(storage?.getItem(CUSTOM_DIALOGS_KEY) ?? '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      return Object.fromEntries(Object.entries(parsed).filter(([, text]) => typeof text === 'string'));
    } catch {
      return {};
    }
  }

  function write(texts: DialogTexts): boolean {
    if (!storage) return false;
    try {
      storage.setItem(CUSTOM_DIALOGS_KEY, JSON.stringify(texts));
      return true;
    } catch {
      return false;
    }
  }

  return {
    load,
    save: (name, text) => write({ ...load(), [name]: text }),
    remove: (name) => write(Object.fromEntries(Object.entries(load()).filter(([key]) => key !== name))),
  };
}

export const customDialogStore = createCustomDialogStore(browserStorage());

// The dialog files battles play: the built-in ones, with this browser's
// uploads in place of any they replace.
export function getActiveDialogs(store: CustomDialogStore = customDialogStore): DialogFiles {
  return applyCustomDialogs(DIALOGS, store.load(), CHARACTERS).files;
}
