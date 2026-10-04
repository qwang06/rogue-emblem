import { describe, expect, it } from 'vitest';
import { createStoredText } from './customStorage.ts';
import { memoryStorage, throwingStorage } from './testStorage.ts';

describe('createStoredText', () => {
  it('starts empty', () => {
    expect(createStoredText(memoryStorage(), 'k').load()).toBeNull();
  });

  it('saves, loads and clears its text', () => {
    const stored = createStoredText(memoryStorage(), 'k');
    expect(stored.save('hello')).toBe(true);
    expect(stored.load()).toBe('hello');
    expect(stored.clear()).toBe(true);
    expect(stored.load()).toBeNull();
  });

  it('keeps separate keys apart', () => {
    const storage = memoryStorage();
    createStoredText(storage, 'a').save('one');
    expect(createStoredText(storage, 'b').load()).toBeNull();
  });

  it('reads as empty and reports failed writes when storage is missing or blocked', () => {
    for (const storage of [null, throwingStorage]) {
      const stored = createStoredText(storage, 'k');
      expect(stored.load()).toBeNull();
      expect(stored.save('text')).toBe(false);
      expect(stored.clear()).toBe(false);
    }
  });
});
