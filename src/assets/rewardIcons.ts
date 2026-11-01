// Reward kind -> URL of its icon in src/assets/rewards/ (one 32x32 PNG per
// kind that isn't shown by its item or unit: a Draft, Rest, Relic, Gold,
// Lesson and Scroll; see the tileset skill). Only the reward screen shows
// these, so they stay out of SPRITE_URLS, which GridScene preloads.

const files = import.meta.glob<string>('./rewards/*.png', { eager: true, import: 'default' });

export const REWARD_ICON_URLS: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    Object.entries(files).map(([path, url]) => [path.slice('./rewards/'.length, -'.png'.length), url]),
  ),
);
