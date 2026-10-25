import { describe, expect, it } from 'vitest';
import { createSeededRng } from '../rng.ts';
import { findQuirk, getQuirkModifiers, QUIRKS, rollQuirk, STURDY_HEALTH } from './quirks.ts';

describe('quirks', () => {
  it('have unique ids, a name and a description each', () => {
    expect(new Set(QUIRKS.map((quirk) => quirk.id)).size).toBe(QUIRKS.length);
    for (const quirk of QUIRKS) {
      expect(quirk.name).not.toBe('');
      expect(quirk.description).not.toBe('');
      // Every quirk does something.
      expect(quirk.modifiers.length > 0 || quirk.maxHealth > 0).toBe(true);
    }
  });

  it('include the Brave, Lucky and Sturdy quirks', () => {
    expect(findQuirk('brave')!.modifiers).toEqual([{ kind: 'combat', term: 'damage', amount: 2, when: 'attacking' }]);
    expect(findQuirk('lucky')!.modifiers).toEqual([{ kind: 'combat', term: 'avoid', amount: 10 }]);
    expect(findQuirk('sturdy')).toMatchObject({ modifiers: [], maxHealth: STURDY_HEALTH });
  });

  it('look up modifiers by id, giving none for no quirk or an unknown one', () => {
    expect(getQuirkModifiers('keen')).toEqual([{ kind: 'combat', term: 'hit', amount: 10 }]);
    expect(getQuirkModifiers(null)).toEqual([]);
    expect(getQuirkModifiers(undefined)).toEqual([]);
    expect(getQuirkModifiers('nope')).toEqual([]);
    expect(findQuirk('nope')).toBeNull();
  });
});

describe('rollQuirk', () => {
  it('rolls every quirk across seeds, the same for the same seed', () => {
    const rolled = new Set(Array.from({ length: 200 }, (_, seed) => rollQuirk(createSeededRng(seed)).id));
    expect(rolled.size).toBe(QUIRKS.length);
    expect(rollQuirk(createSeededRng(5))).toBe(rollQuirk(createSeededRng(5)));
  });

  it('skips excluded quirks, unless every one is excluded', () => {
    const exclude = QUIRKS.slice(1).map((quirk) => quirk.id);
    for (let seed = 0; seed < 20; seed++) expect(rollQuirk(createSeededRng(seed), exclude)).toBe(QUIRKS[0]);
    const all = QUIRKS.map((quirk) => quirk.id);
    expect(QUIRKS).toContain(rollQuirk(createSeededRng(1), all));
  });
});
