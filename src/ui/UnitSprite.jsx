import { SPRITE_URLS } from '../assets/sprites.js';
import { TILE_SIZE } from '../game/tileset.js';

// A sprite image by texture key (see src/assets/sprites.js), drawn at the
// size of `scale` map tiles with crisp pixels. Used to show unit sprites in
// menus.
export function UnitSprite({ sprite, scale = 1 }) {
  const size = TILE_SIZE * scale;
  return <img className="unit-sprite" src={SPRITE_URLS[sprite]} width={size} height={size} alt="" />;
}
