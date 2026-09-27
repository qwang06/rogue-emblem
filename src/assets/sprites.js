// Texture key -> URL for every standalone sprite image. GridScene preloads
// them all under these keys; the React UI looks unit portraits up here.
// src/game/tileset.js names which key each unit draws with.

import warrior1 from './warrior-1.png';
import warrior2 from './warrior-2.png';

export const SPRITE_URLS = {
  'warrior-1': warrior1,
  'warrior-2': warrior2,
};
