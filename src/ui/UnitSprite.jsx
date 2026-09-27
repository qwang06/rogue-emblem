import { SPRITE_URLS } from '../assets/sprites.js';
import { TILE_SIZE, UNIT_IDLE_ANIMATION } from '../game/tileset.js';

// A unit sprite by texture key (see src/assets/sprites.js), drawn at the size
// of `scale` map tiles with crisp pixels, cropped from the sheet's row for
// the direction units face. Shows the first idle frame, or with `animated`
// loops the idle frames like units on the map. Used to show unit sprites in
// menus.
export function UnitSprite({ sprite, scale = 1, animated = false }) {
  const size = TILE_SIZE * scale;
  const { columns, row, frames, frameMs } = UNIT_IDLE_ANIMATION;
  const style = {
    width: size,
    height: size,
    backgroundImage: `url(${SPRITE_URLS[sprite]})`,
    backgroundSize: `${columns * size}px auto`,
    backgroundPosition: `0 ${-row * size}px`,
  };
  if (animated) {
    // Slides the row left one frame per step (see .unit-sprite--animated).
    Object.assign(style, {
      '--unit-sprite-end': `${-frames * size}px`,
      animationDuration: `${frames * frameMs}ms`,
      animationTimingFunction: `steps(${frames})`,
    });
  }
  return <span className={animated ? 'unit-sprite unit-sprite--animated' : 'unit-sprite'} style={style} />;
}
