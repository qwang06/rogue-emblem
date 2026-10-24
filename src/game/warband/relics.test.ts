import { describe, expect, it } from 'vitest';
import {
  findRelic,
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
