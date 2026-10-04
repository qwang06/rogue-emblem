import { describe, expect, it } from 'vitest';
import { createCustomDialogStore, CUSTOM_DIALOGS_KEY, getActiveDialogs } from './customDialogs.ts';
import { DIALOGS } from './dialogs.ts';
import { memoryStorage, throwingStorage } from './testStorage.ts';

describe('createCustomDialogStore', () => {
  it('starts empty', () => {
    expect(createCustomDialogStore(memoryStorage()).load()).toEqual({});
  });

  it('saves, loads and removes uploads by name', () => {
    const store = createCustomDialogStore(memoryStorage());
    expect(store.save('demo', 'one')).toBe(true);
    expect(store.save('training', 'two')).toBe(true);
    expect(store.load()).toEqual({ demo: 'one', training: 'two' });
    expect(store.save('demo', 'three')).toBe(true);
    expect(store.remove('training')).toBe(true);
    expect(store.load()).toEqual({ demo: 'three' });
  });

  it('ignores corrupt or wrongly shaped data', () => {
    expect(createCustomDialogStore(memoryStorage({ [CUSTOM_DIALOGS_KEY]: '{not json' })).load()).toEqual({});
    expect(createCustomDialogStore(memoryStorage({ [CUSTOM_DIALOGS_KEY]: '["demo"]' })).load()).toEqual({});
    expect(createCustomDialogStore(memoryStorage({ [CUSTOM_DIALOGS_KEY]: '{"demo":3,"x":"ok"}' })).load()).toEqual({
      x: 'ok',
    });
  });

  it('reads as empty and reports failed writes when storage is missing or blocked', () => {
    for (const storage of [null, throwingStorage]) {
      const store = createCustomDialogStore(storage);
      expect(store.load()).toEqual({});
      expect(store.save('demo', 'text')).toBe(false);
      expect(store.remove('demo')).toBe(false);
    }
  });
});

describe('getActiveDialogs', () => {
  it('plays the built-in files when nothing is uploaded', () => {
    expect(getActiveDialogs(createCustomDialogStore(memoryStorage()))).toEqual(DIALOGS);
  });

  it('plays an upload in place of the built-in file', () => {
    const store = createCustomDialogStore(memoryStorage());
    store.save('demo', '[opening]\nalden: A new beginning.');
    const files = getActiveDialogs(store);
    expect(files.demo.opening.map((line) => line.text)).toEqual(['A new beginning.']);
    expect(files.demo.victory).toBeUndefined();
    expect(files.training).toBe(DIALOGS.training);
  });
});
