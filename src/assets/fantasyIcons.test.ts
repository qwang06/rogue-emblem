import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RELICS } from '../game/warband/relics.ts';
import { RELIC_ICONS } from './fantasyIcons.ts';

const dir = new URL('./icons/', import.meta.url);

describe('relic icons', () => {
  it('gives every relic an icon from the set, each relic its own', () => {
    const ids = RELICS.map((relic) => relic.id);
    expect(ids.filter((id) => !RELIC_ICONS[id])).toEqual([]);
    expect(Object.keys(RELIC_ICONS).filter((id) => !ids.includes(id))).toEqual([]);
    const icons = Object.values(RELIC_ICONS);
    expect(icons.filter((icon) => !existsSync(new URL(`${icon}.png`, dir)))).toEqual([]);
    expect(new Set(icons).size).toBe(icons.length);
  });
});
