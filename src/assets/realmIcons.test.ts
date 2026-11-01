import { existsSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SiteKind } from '../game/warband/realm/realm.ts';
import { INK_STAMPS } from '../game/warband/realm/realmInk.ts';
import { getSiteIconUrl, SITE_ICON_URLS } from './realmIcons.ts';

// The seasons drawn with their own site icons (recolor-sites.js); the
// starship isn't one yet.
const SITE_ICON_SEASONS = ['autumn', 'winter', 'underworld'];

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
  return readdirSync(folder)
    .filter((file) => file.endsWith('.png'))
    .map((file) => file.replace(/\.png$/, ''));
}

describe('realm art', () => {
  it('has an icon for every kind of site, and none for a kind that no longer exists', () => {
    const dir = new URL('./realm/sites/', import.meta.url);
    const kinds = Object.keys(KINDS);
    expect(kinds.filter((kind) => !existsSync(new URL(`${kind}.png`, dir)))).toEqual([]);
    expect(names(dir).filter((file) => !kinds.includes(file))).toEqual([]);
  });

  it('has every kind of site in each season that has its own icons', () => {
    const kinds = Object.keys(KINDS).sort();
    for (const season of SITE_ICON_SEASONS) {
      expect(names(new URL(`./realm/sites/${season}/`, import.meta.url)).sort()).toEqual(kinds);
    }
  });

  it('draws a site in its season, or plain when the season has no icons', () => {
    expect(getSiteIconUrl('fort', 'winter')).toContain('sites/winter/fort');
    expect(getSiteIconUrl('fort', 'summer')).toBe(SITE_ICON_URLS.fort);
    expect(getSiteIconUrl('fort', 'starship')).toBe(SITE_ICON_URLS.fort);
  });

  it('has an image for every ink stamp, and none unused', () => {
    const dir = new URL('./realm/ink/', import.meta.url);
    expect(INK_STAMPS.filter((stamp) => !existsSync(new URL(`${stamp}.png`, dir)))).toEqual([]);
    expect(names(dir).filter((file) => !(INK_STAMPS as readonly string[]).includes(file))).toEqual([]);
  });
});
