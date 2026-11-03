import { describe, expect, it } from 'vitest';
import {
  canTakeRelic,
  countRelic,
  findRelic,
  getOfferableRelics,
  getRelicDescription,
  isStackingRelic,
  MAX_RELIC_COPIES,
  rollOfferableRelics,
  getRelicModifiers,
  getUnownedRelics,
  hasRelic,
  RELICS,
  rollRelics,
  rollStartingRelics,
  STARTING_RELIC_CHOICES,
} from './relics.ts';
import { createSeededRng } from '../rng.ts';

describe('RELICS', () => {
  it('has unique ids, names and a description each', () => {
    expect(new Set(RELICS.map((relic) => relic.id)).size).toBe(RELICS.length);
    expect(new Set(RELICS.map((relic) => relic.name)).size).toBe(RELICS.length);
    for (const relic of RELICS) expect(relic.description.length).toBeGreaterThan(0);
  });

  it('has 15 to 20 relics', () => {
    expect(RELICS.length).toBeGreaterThanOrEqual(15);
    expect(RELICS.length).toBeLessThanOrEqual(20);
  });
});

describe('findRelic and hasRelic', () => {
  it('looks relics up by id', () => {
    expect(findRelic(RELICS[0].id)).toBe(RELICS[0]);
    expect(findRelic('nope')).toBeNull();
    expect(hasRelic({ relics: [RELICS[2].id] }, RELICS[2])).toBe(true);
    expect(hasRelic({ relics: [] }, RELICS[2])).toBe(false);
  });
});

describe('getRelicModifiers', () => {
  it("is every relic's modifiers in order, skipping unknown ids", () => {
    const boots = findRelic('winged-boots')!;
    const coin = findRelic('gamblers-coin')!;
    expect(getRelicModifiers(['winged-boots', 'nope', 'gamblers-coin'])).toEqual([
      ...boots.modifiers,
      ...coin.modifiers,
    ]);
    expect(getRelicModifiers(['field-kitchen'])).toEqual([]);
  });
});

describe('rollRelics', () => {
  it("offers different relics the run doesn't hold", () => {
    const held = RELICS.slice(0, 5).map((relic) => relic.id);
    for (let seed = 0; seed < 20; seed++) {
      const offers = rollRelics(createSeededRng(seed), held, 3);
      expect(offers).toHaveLength(3);
      expect(new Set(offers.map((relic) => relic.id)).size).toBe(3);
      for (const relic of offers) expect(held).not.toContain(relic.id);
    }
  });

  it('offers fewer once nearly all are held, and none once all are', () => {
    const all = RELICS.map((relic) => relic.id);
    expect(rollRelics(createSeededRng(1), all.slice(1), 3)).toEqual([RELICS[0]]);
    expect(rollRelics(createSeededRng(1), all, 3)).toEqual([]);
    expect(getUnownedRelics(all)).toEqual([]);
  });
});

describe('rollStartingRelics', () => {
  it('is three different relics, the same for the same seed', () => {
    const offers = rollStartingRelics(42);
    expect(offers).toHaveLength(STARTING_RELIC_CHOICES);
    expect(new Set(offers).size).toBe(STARTING_RELIC_CHOICES);
    expect(rollStartingRelics(42)).toEqual(offers);
    const seeds = Array.from({ length: 10 }, (_, seed) =>
      rollStartingRelics(seed)
        .map((relic) => relic.id)
        .join(),
    );
    expect(new Set(seeds).size).toBeGreaterThan(1);
  });
});

describe('relic stage scaling', () => {
  it('grows flat damage, guard and healing with the stage, but not rates, MOV or XP', () => {
    expect(getRelicModifiers(['duelists-gauntlet'], 1)).toEqual(findRelic('duelists-gauntlet')!.modifiers);
    expect(getRelicModifiers(['duelists-gauntlet', 'bloodpact', 'hawk-lens', 'winged-boots'], 20)).toEqual([
      { kind: 'combat', term: 'damage', amount: 5, when: 'attacking' },
      { kind: 'kill-heal', amount: 10 },
      { kind: 'combat', term: 'hit', amount: 15 },
      { kind: 'movement', amount: 1 },
    ]);
  });

  it('describes a relic with its number at the stage and its copies added up', () => {
    const crest = findRelic('bulwark-crest')!;
    expect(getRelicDescription(crest)).toBe(crest.description);
    expect(getRelicDescription(crest, 20)).toBe('Units take 5 less damage when attacked.');
    expect(getRelicDescription(crest, 1, 2)).toBe('Units take 4 less damage when attacked.');
    const kitchen = findRelic('field-kitchen')!;
    expect(getRelicDescription(kitchen, 1, 2)).toBe(`${kitchen.description} (×2)`);
  });
});

describe('relic copies', () => {
  it('stacks only relics made of modifiers that add up', () => {
    expect(isStackingRelic(findRelic('hawk-lens')!)).toBe(true);
    expect(isStackingRelic(findRelic('scholars-quill')!)).toBe(true);
    expect(isStackingRelic(findRelic('field-kitchen')!)).toBe(false);
    expect(isStackingRelic(findRelic('field-kitchen')!)).toBe(false);
  });

  it(`offers another copy of a stacking relic until the run holds ${MAX_RELIC_COPIES}`, () => {
    expect(countRelic(['hawk-lens', 'field-kitchen', 'hawk-lens'], 'hawk-lens')).toBe(2);
    expect(canTakeRelic(['hawk-lens'], 'hawk-lens')).toBe(true);
    expect(canTakeRelic(['hawk-lens', 'hawk-lens'], 'hawk-lens')).toBe(false);
    expect(canTakeRelic(['field-kitchen'], 'field-kitchen')).toBe(false);
    expect(canTakeRelic([], 'nope')).toBe(false);
    const ids = getOfferableRelics(['hawk-lens', 'field-kitchen']).map((relic) => relic.id);
    expect(ids).toContain('hawk-lens');
    expect(ids).not.toContain('field-kitchen');
  });

  it('counts each copy in the modifiers', () => {
    expect(getRelicModifiers(['hawk-lens', 'hawk-lens'])).toEqual([
      ...findRelic('hawk-lens')!.modifiers,
      ...findRelic('hawk-lens')!.modifiers,
    ]);
  });

  it('rolls different offerable relics', () => {
    const held = ['hawk-lens', 'hawk-lens', 'field-kitchen'];
    for (let seed = 0; seed < 20; seed++) {
      const offers = rollOfferableRelics(createSeededRng(seed), held, 4);
      expect(offers).toHaveLength(4);
      expect(new Set(offers).size).toBe(4);
      for (const relic of offers) expect(['hawk-lens', 'field-kitchen']).not.toContain(relic.id);
    }
  });
});
