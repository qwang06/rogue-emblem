import { SPRITE_URLS } from '../assets/sprites.js';
import { TILE_SIZE, UNIT_ANIMATIONS, UNIT_SHEET, unitSheetKey } from '../game/tileset.js';

// A unit's idle sheet by unit art name (UNIT_SPRITES in tileset.js), drawn at
// the size of `scale` map tiles with crisp pixels, cropped from the sheet's
// row for the direction units start out facing. Shows the first idle frame, or with `animated`
// loops the idle frames like units on the map. Used to show unit sprites in
// menus.
export function UnitSprite({ sprite, scale = 1, animated = false }) {
  const size = TILE_SIZE * scale;
  const { columns, rows, defaultFacing, frames } = UNIT_SHEET;
  const { frameMs } = UNIT_ANIMATIONS.idle;
  const row = rows[defaultFacing];
  const style = {
    width: size,
    height: size,
    backgroundImage: `url(${SPRITE_URLS[unitSheetKey(sprite, 'idle')]})`,
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
