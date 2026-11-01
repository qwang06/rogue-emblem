// The Warband overworld's art (see the tileset skill): an illustrated icon
// per kind of site, in src/assets/realm/sites/ (64x64, named by SiteKind),
// with seasonal copies in sites/<season>/ for a site that plays a region
// of that season (recolor-sites.js),
// and the parchment map's ink symbols, in src/assets/realm/ink/ (32x32,
// named by InkStamp). Only the overworld screen shows these, so they stay
// out of SPRITE_URLS, which GridScene preloads.

const sites = import.meta.glob<string>('./realm/sites/*.png', { eager: true, import: 'default' });
const seasonSites = import.meta.glob<string>('./realm/sites/*/*.png', { eager: true, import: 'default' });
const stamps = import.meta.glob<string>('./realm/ink/*.png', { eager: true, import: 'default' });

function byName(files: Record<string, string>, folder: string): Readonly<Record<string, string>> {
  return Object.freeze(
    Object.fromEntries(Object.entries(files).map(([path, url]) => [path.slice(folder.length, -'.png'.length), url])),
  );
}

export const SITE_ICON_URLS = byName(sites, './realm/sites/');
export const INK_STAMP_URLS = byName(stamps, './realm/ink/');

// The seasonal site icons: season -> kind -> url. A season without its own
// icons (summer, the starship) uses the plain ones.
const SEASON_SITE_ICON_URLS: Readonly<Record<string, Readonly<Record<string, string>>>> = Object.freeze(
  Object.entries(seasonSites).reduce<Record<string, Record<string, string>>>((bySeason, [file, url]) => {
    const [season, name] = file.slice('./realm/sites/'.length, -'.png'.length).split('/');
    (bySeason[season] ??= {})[name] = url;
    return bySeason;
  }, {}),
);

// The icon for a site of `kind` that plays a region of `season`.
export function getSiteIconUrl(kind: string, season: string): string {
  return SEASON_SITE_ICON_URLS[season]?.[kind] ?? SITE_ICON_URLS[kind];
}
