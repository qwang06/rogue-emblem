// Texture key -> URL for every standalone sprite sheet. GridScene preloads
// them all under these keys; the React UI looks unit portraits up here.
// src/game/tileset.js names which key each unit draws with.

import soldier3 from './soldier-3.png';
import villager1 from './villager-1.png';

export const SPRITE_URLS = {
  'soldier-3': soldier3,
  'villager-1': villager1,
};
