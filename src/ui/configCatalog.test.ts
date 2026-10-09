import { existsSync, globSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { REGION_CONFIGS } from '../data/regions.ts';
import { WEAPONS } from '../game/weapons.ts';
import { getConfigCatalog, plural } from './configCatalog.ts';

const entries = () => getConfigCatalog().flatMap((group) => group.entries);

describe('getConfigCatalog', () => {
  it('gives every group and entry a unique id', () => {
    const groupIds = getConfigCatalog().map((group) => group.id);
    expect(new Set(groupIds).size).toBe(groupIds.length);
    const entryIds = entries().map((entry) => entry.id);
    expect(new Set(entryIds).size).toBe(entryIds.length);
  });

  it('has no empty groups', () => {
    for (const group of getConfigCatalog()) expect(group.entries.length).toBeGreaterThan(0);
  });

  it('lists the configs the editor will cover', () => {
    expect(entries().map((entry) => entry.id)).toEqual(
      expect.arrayContaining(['dialogs', 'regions', 'unit-stats', 'unit-growths', 'unit-caps', 'weapons']),
    );
  });

  it('points every entry at files that exist', () => {
    for (const entry of entries()) {
      expect(entry.sources.length).toBeGreaterThan(0);
      for (const source of entry.sources) {
        const found = source.includes('*') ? globSync(source).length > 0 : existsSync(source);
        expect(found, `${entry.id}: ${source}`).toBe(true);
      }
    }
  });

  it('summarizes from the live data', () => {
    const byId = Object.fromEntries(entries().map((entry) => [entry.id, entry]));
    expect(byId['regions'].summary).toBe(plural(REGION_CONFIGS.length, 'region'));
    expect(byId.weapons.summary).toBe(plural(WEAPONS.length, 'weapon'));
  });
});

describe('plural', () => {
  it('picks the singular for one and the plural otherwise', () => {
    expect(plural(1, 'map')).toBe('1 map');
    expect(plural(0, 'map')).toBe('0 maps');
    expect(plural(2, 'class', 'classes')).toBe('2 classes');
  });
});
