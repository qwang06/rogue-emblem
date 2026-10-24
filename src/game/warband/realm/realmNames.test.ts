import { describe, expect, it } from 'vitest';
import { createSeededRng } from '../../rng.ts';
import { nameRealm, nameSite } from './realmNames.ts';

describe('nameRealm', () => {
  it('names the realm "The <adjective> <noun>", the same for the same rng', () => {
    expect(nameRealm(createSeededRng(3))).toMatch(/^The \w+ \w+$/);
    expect(nameRealm(createSeededRng(3))).toBe(nameRealm(createSeededRng(3)));
  });
});

describe('nameSite', () => {
  it('names each kind of site in its own way', () => {
    const rng = createSeededRng(8);
    const none = new Set<string>();
    expect(nameSite('home', 'meadow', rng, none)).toMatch(/ Camp$/);
    expect(nameSite('fort', 'meadow', rng, none)).toMatch(/^Fort /);
    expect(nameSite('shrine', 'meadow', rng, none)).toMatch(/^Shrine of St\. /);
    expect(nameSite('battle', 'lake', rng, none)).toMatch(/mere$|^Lake | Marsh$/);
    expect(nameSite('battle', 'hills', rng, none)).toMatch(/ (Crag|Pass|Tor)$/);
  });

  it('never repeats a name already taken', () => {
    const rng = createSeededRng(1);
    const taken = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const name = nameSite('fort', 'meadow', rng, taken);
      expect(taken.has(name)).toBe(false);
      taken.add(name);
    }
  });
});
