import { existsSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { KEYSTONES } from '../game/warband/keystones.ts';

const dir = new URL('./keystones/', import.meta.url);

describe('keystone icons', () => {
  it('has an icon for every keystone, and none for a keystone that no longer exists', () => {
    const ids = KEYSTONES.map((keystone) => keystone.id);
    expect(ids.filter((id) => !existsSync(new URL(`${id}.png`, dir)))).toEqual([]);
    const files = readdirSync(dir).map((file) => file.replace(/\.png$/, ''));
    expect(files.filter((file) => !ids.includes(file))).toEqual([]);
  });
});
