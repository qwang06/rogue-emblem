// Keystone id (src/game/warband/keystones.ts) -> URL of its icon in
// src/assets/keystones/ (one 32x32 PNG per keystone, named by keystone id;
// see the tileset skill): the keystone reward's cards and the camp's relic
// list show it. Only React shows them, so they stay out of SPRITE_URLS,
// which GridScene preloads.

const files = import.meta.glob<string>('./keystones/*.png', { eager: true, import: 'default' });

export const KEYSTONE_ICON_URLS: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    Object.entries(files).map(([path, url]) => [path.slice('./keystones/'.length, -'.png'.length), url]),
  ),
);
