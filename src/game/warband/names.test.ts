import { describe, expect, it } from 'vitest';
import { createSeededRng } from '../rng.ts';
import { cleanName, generateName, MAX_NAME_LENGTH, WARBAND_NAMES } from './names.ts';

describe('WARBAND_NAMES', () => {
  it('has no duplicates', () => {
    expect(new Set(WARBAND_NAMES).size).toBe(WARBAND_NAMES.length);
  });

  it('only has names that are already clean', () => {
    for (const name of WARBAND_NAMES) expect(cleanName(name)).toBe(name);
  });
});

describe('generateName', () => {
  it('is the same for the same seed', () => {
    expect(generateName(createSeededRng(42))).toBe(generateName(createSeededRng(42)));
  });

  it('picks from the name list', () => {
    const rng = createSeededRng(7);
    for (let i = 0; i < 100; i++) expect(WARBAND_NAMES).toContain(generateName(rng));
  });

  it('reaches many different names across seeds', () => {
    const names = new Set(Array.from({ length: 200 }, (_, seed) => generateName(createSeededRng(seed))));
    expect(names.size).toBeGreaterThan(WARBAND_NAMES.length / 2);
  });

  it('never repeats the name it avoids', () => {
    const rng = createSeededRng(3);
    let name = generateName(rng);
    for (let i = 0; i < 200; i++) {
      const next = generateName(rng, name);
      expect(next).not.toBe(name);
      name = next;
    }
  });

  it('repeats the avoided name when it is the only one', () => {
    expect(generateName(createSeededRng(1), 'Solo', ['Solo'])).toBe('Solo');
  });

  it('picks from a custom list, including its last entry', () => {
    expect(generateName(() => 0, undefined, ['A', 'B'])).toBe('A');
    expect(generateName(() => 0.999, undefined, ['A', 'B'])).toBe('B');
    expect(generateName(() => 0.999, 'B', ['A', 'B'])).toBe('A');
  });

  it('rejects an empty list', () => {
    expect(() => generateName(createSeededRng(1), undefined, [])).toThrow();
  });
});

describe('cleanName', () => {
  it('keeps a plain name', () => {
    expect(cleanName('Alden')).toBe('Alden');
    expect(cleanName('Mary Ann')).toBe('Mary Ann');
  });

  it('trims and collapses spaces', () => {
    expect(cleanName('  Mary   Ann  ')).toBe('Mary Ann');
    expect(cleanName('Mary\tAnn')).toBe('Mary Ann');
  });

  it('drops control characters', () => {
    expect(cleanName('Al\u0000den\u007f')).toBe('Alden');
  });

  it('cuts long names to the limit', () => {
    const name = cleanName('Bartholomew the Bold');
    expect(name).toBe('Bartholomew');
    expect(Array.from(cleanName('x'.repeat(30))!)).toHaveLength(MAX_NAME_LENGTH);
  });

  it('counts characters, not UTF-16 units', () => {
    expect(cleanName('🗡'.repeat(20))).toBe('🗡'.repeat(MAX_NAME_LENGTH));
  });

  it('is null when nothing is left', () => {
    expect(cleanName('')).toBeNull();
    expect(cleanName('   ')).toBeNull();
    expect(cleanName('\u0000\n')).toBeNull();
  });
});
