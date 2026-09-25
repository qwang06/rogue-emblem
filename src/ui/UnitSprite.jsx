import tilesetUrl from '../assets/kenney_tiny-battle/Tilemap/tilemap_packed.png';
import { getFramePosition, TILESET_COLUMNS, TILESET_ROWS, TILE_SIZE } from '../game/tileset.js';

// One frame of the tileset, cropped out of the sheet image with CSS and
// scaled up with crisp pixels. Used to show unit sprites in menus.
export function UnitSprite({ frame, scale = 2 }) {
  const { col, row } = getFramePosition(frame);
  const size = TILE_SIZE * scale;

  return (
    <span
      className="unit-sprite"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${tilesetUrl})`,
        backgroundSize: `${TILESET_COLUMNS * size}px ${TILESET_ROWS * size}px`,
        backgroundPosition: `-${col * size}px -${row * size}px`,
      }}
    />
  );
}
