import { describe, expect, it } from 'vitest';
import { createRun } from '../game/warband/run.ts';
import { createStartingWarband } from '../game/warband/stageLevel.ts';
import { createStoredText } from './customStorage.ts';
import { clearSavedRun, loadSavedRun, saveRun } from './runSave.ts';
import { memoryStorage, throwingStorage } from './testStorage.ts';

const run = createRun(7, createStartingWarband());

describe('the saved run', () => {
  it('is null until a run is saved', () => {
    expect(loadSavedRun(createStoredText(memoryStorage(), 'k'))).toBeNull();
  });

  it('loads what was saved', () => {
    const store = createStoredText(memoryStorage(), 'k');
    expect(saveRun(run, store)).toBe(true);
    expect(loadSavedRun(store)).toEqual(run);
  });

  it('is gone once cleared', () => {
    const store = createStoredText(memoryStorage(), 'k');
    saveRun(run, store);
    expect(clearSavedRun(store)).toBe(true);
    expect(loadSavedRun(store)).toBeNull();
  });

  it('reads a corrupt save as no run', () => {
    const store = createStoredText(memoryStorage({ k: '{"stage": "three"' }), 'k');
    expect(loadSavedRun(store)).toBeNull();
  });

  it('reports blocked storage instead of throwing', () => {
    const store = createStoredText(throwingStorage, 'k');
    expect(saveRun(run, store)).toBe(false);
    expect(loadSavedRun(store)).toBeNull();
    expect(clearSavedRun(store)).toBe(false);
  });
});
