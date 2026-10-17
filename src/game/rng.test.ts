import { describe, expect, it } from 'vitest';
import { createResumableRng, createSeededRng, randomInt, randomItem, shuffle } from './rng.ts';

describe('createSeededRng', () => {
  it('gives the same sequence for the same seed', () => {
    const a = createSeededRng(42);
    const b = createSeededRng(42);
    for (let i = 0; i < 20; i++) expect(a()).toBe(b());
  });

  it('gives different sequences for different seeds', () => {
    const a = createSeededRng(1);
    const b = createSeededRng(2);
    expect([a(), a(), a()]).not.toEqual([b(), b(), b()]);
  });

  it('stays in [0, 1)', () => {
    const rng = createSeededRng(0);
    for (let i = 0; i < 1000; i++) {
      const n = rng();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });
});

describe('createResumableRng', () => {
  it('rolls the same numbers as createSeededRng', () => {
    const plain = createSeededRng(7);
    const { rng } = createResumableRng(7);
    for (let i = 0; i < 10; i++) expect(rng()).toBe(plain());
  });

  it('picks the sequence up from its state', () => {
    const first = createResumableRng(99);
    first.rng();
    first.rng();
    const resumed = createResumableRng(first.state());
    for (let i = 0; i < 10; i++) expect(resumed.rng()).toBe(first.rng());
  });
});

describe('randomInt', () => {
  it('includes both ends of the range', () => {
    expect(randomInt(() => 0, 3, 5)).toBe(3);
    expect(randomInt(() => 0.9999, 3, 5)).toBe(5);
  });

  it('returns min when the range is a single number', () => {
    expect(randomInt(() => 0.5, 7, 7)).toBe(7);
  });
});

describe('randomItem', () => {
  it('picks by position in the list', () => {
    expect(randomItem(() => 0, ['a', 'b', 'c'])).toBe('a');
    expect(randomItem(() => 0.99, ['a', 'b', 'c'])).toBe('c');
  });

  it('throws on an empty list', () => {
    expect(() => randomItem(() => 0, [])).toThrow();
  });
});

describe('shuffle', () => {
  it('keeps every item and leaves the input alone', () => {
    const items = [1, 2, 3, 4, 5];
    const shuffled = shuffle(createSeededRng(3), items);
    expect([...shuffled].sort()).toEqual(items);
    expect(items).toEqual([1, 2, 3, 4, 5]);
  });
});
