import { useGameStore } from './useGameStore.ts';
import { isOnField } from './dock.tsx';

// How many tiles the mat's grid runs past the board on each side: more
// than any stage is wide.
const MAT_REACH = 64;

// The mat the board sits on and the frame round it: a faint grid of
// half tiles aligned to the board's own tiles, a double bronze hairline
// at a small margin with a dimmer third line further out, the battle's
// name and the board's size as a tab on the frame's top edge and the
// cursor's tile on its bottom edge. So the stage round a board smaller
// than it reads as a mat round a framed board rather than empty screen.
// GridScene publishes where the board shows (boardAnchor) whenever the
// camera moves; the canvas is clear, so the mat shows round the map.
export function BoardFrame() {
  const onField = useGameStore(isOnField);
  const anchor = useGameStore((state) => state.boardAnchor);
  const name = useGameStore((state) => state.battleName);
  const size = useGameStore((state) => state.boardSize);
  const tile = useGameStore((state) => state.hoveredTile);
  if (!onField || !anchor || !size) return null;

  const margin = 'var(--board-margin)';
  // A tile, as a fraction of the stage's width and height.
  const tileX = (anchor.right - anchor.left) / size.width;
  const tileY = (anchor.bottom - anchor.top) / size.height;
  // The board's rectangle within the mat (which starts MAT_REACH tiles
  // before it), cut out of the grid: the outer ring clockwise, the hole
  // counterclockwise.
  const near = (MAT_REACH / (2 * MAT_REACH)) * 100;
  const farX = ((MAT_REACH + size.width) / (2 * MAT_REACH)) * 100;
  const farY = ((MAT_REACH + size.height) / (2 * MAT_REACH)) * 100;
  const cutout =
    `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ` +
    `${near}% ${near}%, ${near}% ${farY}%, ${farX}% ${farY}%, ${farX}% ${near}%, ${near}% ${near}%)`;
  return (
    <>
      <div
        className="board-mat"
        aria-hidden="true"
        style={{
          left: `${(anchor.left - MAT_REACH * tileX) * 100}%`,
          top: `${(anchor.top - MAT_REACH * tileY) * 100}%`,
          width: `${2 * MAT_REACH * tileX * 100}%`,
          height: `${2 * MAT_REACH * tileY * 100}%`,
          ['--mat-cutout' as string]: cutout,
        }}
      />
      <div
        className="board-frame"
        aria-hidden="true"
        style={{
          left: `calc(${anchor.left * 100}% - ${margin})`,
          top: `calc(${anchor.top * 100}% - ${margin})`,
          width: `calc(${(anchor.right - anchor.left) * 100}% + 2 * ${margin})`,
          height: `calc(${(anchor.bottom - anchor.top) * 100}% + 2 * ${margin})`,
        }}
      >
        <span className="board-frame__label board-frame__label--name">
          {name}
          <span className="board-frame__size">
            {size.width} × {size.height}
          </span>
        </span>
        {tile && (
          <span className="board-frame__label board-frame__label--tile">
            Tile
            <span className="board-frame__size">
              {tile.x + 1}, {tile.y + 1}
            </span>
          </span>
        )}
      </div>
    </>
  );
}
