import { describe, expect, it } from 'vitest';
import { createSeededRng } from '../../rng.ts';
import { clearSpecks, createValueNoise, generateRealmLand, LAND_RULES, landAt, setLand } from './realmTerrain.ts';

describe('createValueNoise', () => {
  it('gives values from 0 to 1 that change smoothly between neighbors', () => {
    const noise = createValueNoise(20, 10, 5, createSeededRng(4));
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 20; x++) {
        expect(noise(x, y)).toBeGreaterThanOrEqual(0);
        expect(noise(x, y)).toBeLessThanOrEqual(1);
        expect(Math.abs(noise(x + 1, y) - noise(x, y))).toBeLessThan(0.5);
      }
    }
  });
});

describe('generateRealmLand', () => {
  it('is the same land for the same rng, with open country in the west', () => {
    const a = generateRealmLand(45, 18, createSeededRng(12));
    expect(generateRealmLand(45, 18, createSeededRng(12))).toEqual(a);
    for (let seed = 1; seed <= 10; seed++) {
      const land = generateRealmLand(45, 18, createSeededRng(seed));
      for (let y = 0; y < 18; y++) {
        for (let x = 0; x < LAND_RULES.openWest; x++) expect(landAt(land, x, y)).not.toBe('mountain');
      }
    }
  });

  it('gathers mountains toward the east', () => {
    let west = 0;
    let east = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const land = generateRealmLand(45, 18, createSeededRng(seed));
      land.cells.forEach((terrain, i) => {
        if (terrain !== 'mountain') return;
        if (i % land.width < land.width / 2) west++;
        else east++;
      });
    }
    expect(east).toBeGreaterThan(west);
  });
});

describe('clearSpecks', () => {
  it('turns patches smaller than the minimum back into grass', () => {
    const land = { width: 5, height: 2, cells: Array(10).fill('grass') };
    setLand(land, 0, 0, 'water');
    setLand(land, 3, 0, 'water');
    setLand(land, 4, 0, 'water');
    setLand(land, 4, 1, 'water');
    clearSpecks(land, 'water', 3);
    expect(landAt(land, 0, 0)).toBe('grass');
    expect(landAt(land, 4, 1)).toBe('water');
  });
});

describe('landAt and setLand', () => {
  it('ignore tiles off the map', () => {
    const land = { width: 2, height: 2, cells: Array(4).fill('grass') };
    setLand(land, 5, 5, 'water');
    expect(land.cells).toEqual(Array(4).fill('grass'));
    expect(landAt(land, -1, 0)).toBeUndefined();
  });
});
