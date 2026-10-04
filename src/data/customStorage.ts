// Shared plumbing for configs the player uploads in the config editor,
// kept in the browser's localStorage so they survive reloads (only this
// browser sees them). Storage can be missing or throw (private windows,
// blocked site data), so every access is guarded: reads come back empty
// and writes report failure instead of throwing.

export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

// localStorage, or null where there's none (tests, blocked storage).
export function browserStorage(): KeyValueStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

// One uploaded file's text under `key`.
export interface StoredText {
  // The stored text, or null when there's none or storage fails.
  load(): string | null;
  // Each returns false when storage couldn't be written.
  save(text: string): boolean;
  clear(): boolean;
}

export function createStoredText(storage: KeyValueStorage | null, key: string): StoredText {
  function write(value: string | null): boolean {
    if (!storage) return false;
    try {
      // An empty string marks "nothing stored", so no removeItem is needed.
      storage.setItem(key, value ?? '');
      return true;
    } catch {
      return false;
    }
  }

  return {
    load() {
      try {
        return storage?.getItem(key) || null;
      } catch {
        return null;
      }
    },
    save: (text) => write(text),
    clear: () => write(null),
  };
}
