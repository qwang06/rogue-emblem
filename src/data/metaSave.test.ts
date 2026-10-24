import { describe, expect, it } from 'vitest';
import { NEW_META } from '../game/warband/meta.ts';
import { createStoredText } from './customStorage.ts';
import { loadMeta, saveMeta } from './metaSave.ts';
import { memoryStorage, throwingStorage } from './testStorage.ts';

const meta = { renown: 60, runs: 2, wins: 0, bestStage: 6 };

describe('the saved meta-progression', () => {
  it('is a fresh start until something is saved', () => {
    expect(loadMeta(createStoredText(memoryStorage(), 'k'))).toEqual(NEW_META);
  });

  it('loads what was saved', () => {
    const store = createStoredText(memoryStorage(), 'k');
    expect(saveMeta(meta, store)).toBe(true);
    expect(loadMeta(store)).toEqual(meta);
  });

  it('reads a corrupt save as a fresh start', () => {
    expect(loadMeta(createStoredText(memoryStorage({ k: '{"renown": "lots"' }), 'k'))).toEqual(NEW_META);
  });

  it('reports blocked storage instead of throwing', () => {
    const store = createStoredText(throwingStorage, 'k');
    expect(saveMeta(meta, store)).toBe(false);
    expect(loadMeta(store)).toEqual(NEW_META);
  });
});
