// The general icon set in src/assets/icons/: 64 small fantasy icons (16px
// art doubled to 32x32), each file named for what it shows (sword, flask-round,
// rune-stone, ...; the tileset skill catalogs them). Icon name -> URL. Only
// React shows them, so they stay out of SPRITE_URLS, which GridScene
// preloads.

const files = import.meta.glob<string>('./icons/*.png', { eager: true, import: 'default' });

export const ICON_URLS: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    Object.entries(files).map(([path, url]) => [path.slice('./icons/'.length, -'.png'.length), url]),
  ),
);

// Relic id (src/game/warband/relics.ts) -> the icon it shows on the camp's
// relic list, a relic reward's card and the starting relic pick.
export const RELIC_ICONS: Readonly<Record<string, string>> = Object.freeze({
  'hawk-lens': 'eye',
  'gamblers-coin': 'coins',
  'feather-cloak': 'cloak',
  'duelists-gauntlet': 'gauntlet',
  'bulwark-crest': 'shield',
  'berserkers-brand': 'cursed-mask',
  'hunters-charm': 'dragon-fang',
  'winged-boots': 'boot',
  bloodpact: 'chalice',
  'mending-charm': 'amulet',
  'mana-spring': 'droplet',
  whetstone: 'rune-stone',
  'scholars-quill': 'book',
  'bounty-ledger': 'map',
  'phoenix-feather': 'fireball',
  'four-leaf-clover': 'clover',
  'field-kitchen': 'cauldron',
  'lone-wolf': 'crescent-moon',
});

// The URL of relic `relicId`'s icon, or null for a relic without one.
export function getRelicIconUrl(relicId: string): string | null {
  const icon = RELIC_ICONS[relicId];
  return (icon && ICON_URLS[icon]) || null;
}
