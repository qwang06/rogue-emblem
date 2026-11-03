import type { CSSProperties } from 'react';
import { SPRITE_URLS } from '../assets/sprites.ts';
import { getUnitSheet, TILE_SIZE, UNIT_SHEET } from '../game/tileset.ts';

// A unit's idle sheet by unit art name (UNIT_SPRITES in tileset.ts), drawn at
// the size of `scale` map tiles with crisp pixels, cropped from the sheet's
// row for the direction units start out facing. Shows the first idle frame, or with `animated`
// loops the idle frames like units on the map. Used to show unit sprites in
// menus.
export function UnitSprite({
  sprite,
  scale = 1,
  animated = false,
}: {
  sprite: string;
  scale?: number;
  animated?: boolean;
}) {
  const size = TILE_SIZE * scale;
  const { rows, defaultFacing } = UNIT_SHEET;
  // Idle frames are a tile wide; a taller one (the orc's 48px) is shown
  // from its top in the one-tile box, its feet cropped off below.
  const { key, frames, frameMs, frameHeight } = getUnitSheet(sprite, 'idle')!;
  const columns = frames;
  const row = rows[defaultFacing];
  const style: CSSProperties & Record<`--${string}`, string> = {
    width: size,
    height: size,
    backgroundImage: `url(${SPRITE_URLS[key]})`,
    backgroundSize: `${columns * size}px auto`,
    backgroundPosition: `0 ${-row * frameHeight * scale}px`,
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
