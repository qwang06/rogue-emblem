// Texture key -> URL for every standalone sprite image. GridScene preloads
// them all under these keys; the React UI looks unit portraits up here.
// src/game/tileset.js names which key each unit, UI element, and arrow piece
// draws with.

import cursor from './cursor.png';
import pathDownLeft from './path/down-left.png';
import pathDownRight from './path/down-right.png';
import pathHeadDown from './path/head-down.png';
import pathHeadLeft from './path/head-left.png';
import pathHeadRight from './path/head-right.png';
import pathHeadUp from './path/head-up.png';
import pathLeftRight from './path/left-right.png';
import pathUpDown from './path/up-down.png';
import pathUpLeft from './path/up-left.png';
import pathUpRight from './path/up-right.png';
import warrior1 from './warrior-1.png';
import warrior2 from './warrior-2.png';

export const SPRITE_URLS = {
  'warrior-1': warrior1,
  'warrior-2': warrior2,
  cursor,
  'path-head-up': pathHeadUp,
  'path-head-left': pathHeadLeft,
  'path-head-right': pathHeadRight,
  'path-head-down': pathHeadDown,
  'path-left-right': pathLeftRight,
  'path-up-down': pathUpDown,
  'path-down-right': pathDownRight,
  'path-down-left': pathDownLeft,
  'path-up-right': pathUpRight,
  'path-up-left': pathUpLeft,
};
