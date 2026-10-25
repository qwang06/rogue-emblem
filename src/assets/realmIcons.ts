// The Warband overworld's art (see the tileset skill): an illustrated icon
// per kind of site, in src/assets/realm/sites/ (64x64, named by SiteKind),
// and the parchment map's ink symbols, in src/assets/realm/ink/ (32x32,
// named by InkStamp). Only the overworld screen shows these, so they stay
// out of SPRITE_URLS, which GridScene preloads.

const sites = import.meta.glob<string>('./realm/sites/*.png', { eager: true, import: 'default' });
const stamps = import.meta.glob<string>('./realm/ink/*.png', { eager: true, import: 'default' });

function byName(files: Record<string, string>, folder: string): Readonly<Record<string, string>> {
  return Object.freeze(
    Object.fromEntries(Object.entries(files).map(([path, url]) => [path.slice(folder.length, -'.png'.length), url])),
  );
}

export const SITE_ICON_URLS = byName(sites, './realm/sites/');
export const INK_STAMP_URLS = byName(stamps, './realm/ink/');
