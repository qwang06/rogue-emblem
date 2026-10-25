import { existsSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SiteKind } from '../game/warband/realm/realm.ts';
import { INK_STAMPS } from '../game/warband/realm/realmInk.ts';

// Every kind, typed as a record so a new kind fails to compile until it's
// listed here.
const KINDS: Readonly<Record<SiteKind, true>> = {
  home: true,
  battle: true,
  village: true,
  fort: true,
  elite: true,
  town: true,
  shrine: true,
  event: true,
  hold: true,
};

function names(folder: URL): string[] {
  return readdirSync(folder).map((file) => file.replace(/\.png$/, ''));
}

describe('realm art', () => {
  it('has an icon for every kind of site, and none for a kind that no longer exists', () => {
    const dir = new URL('./realm/sites/', import.meta.url);
    const kinds = Object.keys(KINDS);
    expect(kinds.filter((kind) => !existsSync(new URL(`${kind}.png`, dir)))).toEqual([]);
    expect(names(dir).filter((file) => !kinds.includes(file))).toEqual([]);
  });

  it('has an image for every ink stamp, and none unused', () => {
    const dir = new URL('./realm/ink/', import.meta.url);
    expect(INK_STAMPS.filter((stamp) => !existsSync(new URL(`${stamp}.png`, dir)))).toEqual([]);
    expect(names(dir).filter((file) => !(INK_STAMPS as readonly string[]).includes(file))).toEqual([]);
  });
});
