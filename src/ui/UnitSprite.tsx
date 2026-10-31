import type { CSSProperties } from 'react';
import { SPRITES, SPRITE_URLS } from '../assets/sprites.ts';
import { isSingleImageUnit, UNIT_ANIMATIONS, UNIT_SHEET, unitSheetKey } from '../game/tileset.ts';

// CSS px of a unit sprite at scale 1 in menus: the UI's own size, apart
// from the map's TILE_SIZE, so menus don't change when the map art does.
const UNIT_SPRITE_SIZE = 32;

// A unit's idle sheet by unit art name (UNIT_SPRITES in tileset.ts), drawn
// `scale` x UNIT_SPRITE_SIZE CSS px big with crisp pixels, cropped from the sheet's
// row for the direction units start out facing. Shows the first idle frame, or with `animated`
// loops the idle frames like units on the map. Used to show unit sprites in
// menus. Single-image art (isSingleImageUnit) shows its whole image, and with
// `animated` breathes like it does on the map (.unit-sprite--breathing).
export function UnitSprite({
  sprite,
  scale = 1,
  animated = false,
}: {
  sprite: string;
  scale?: number;
  animated?: boolean;
}) {
  const size = UNIT_SPRITE_SIZE * scale;
  if (isSingleImageUnit(sprite)) {
    const classes = ['unit-sprite'];
    if (SPRITES[sprite].smooth) classes.push('unit-sprite--smooth');
    if (animated) classes.push('unit-sprite--breathing');
    return (
      <span
        className={classes.join(' ')}
        style={{ width: size, height: size, backgroundImage: `url(${SPRITE_URLS[sprite]})`, backgroundSize: 'contain' }}
      />
    );
  }
  const { columns, rows, defaultFacing, frames } = UNIT_SHEET;
  const { frameMs } = UNIT_ANIMATIONS.idle;
  const row = rows[defaultFacing];
  const style: CSSProperties & Record<`--${string}`, string> = {
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
