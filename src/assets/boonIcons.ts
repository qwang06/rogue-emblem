// Boon id -> URL of its icon in src/assets/boons/ (one 32x32 PNG per boon,
// named by boon id; see the tileset skill). Only the React UI shows these,
// so they stay out of SPRITE_URLS, which GridScene preloads.

const files = import.meta.glob<string>('./boons/*.png', { eager: true, import: 'default' });

export const BOON_ICON_URLS: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    Object.entries(files).map(([path, url]) => [path.slice('./boons/'.length, -'.png'.length), url]),
  ),
);
