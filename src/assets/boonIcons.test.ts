import { existsSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOONS } from '../game/warband/boons.ts';

const dir = new URL('./boons/', import.meta.url);

describe('boon icons', () => {
  it('has an icon for every boon, and none for a boon that no longer exists', () => {
    const ids = BOONS.map((boon) => boon.id);
    expect(ids.filter((id) => !existsSync(new URL(`${id}.png`, dir)))).toEqual([]);
    const files = readdirSync(dir).map((file) => file.replace(/\.png$/, ''));
    expect(files.filter((file) => !ids.includes(file))).toEqual([]);
  });
});
