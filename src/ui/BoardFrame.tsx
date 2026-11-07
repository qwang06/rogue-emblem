import { useGameStore } from './useGameStore.ts';
import { isOnField } from './dock.tsx';

// A thin bronze frame drawn round the board at a small margin, with the
// battle's name and the board's size on its top edge and the cursor's tile
// on the other, so the stage round a board smaller than it reads as a mat
// round a framed board rather than empty screen. GridScene publishes where
// the board shows (boardAnchor) whenever the camera moves.
export function BoardFrame() {
  const onField = useGameStore(isOnField);
  const anchor = useGameStore((state) => state.boardAnchor);
  const name = useGameStore((state) => state.battleName);
  const size = useGameStore((state) => state.boardSize);
  const tile = useGameStore((state) => state.hoveredTile);
  if (!onField || !anchor || !size) return null;

  const margin = 'var(--board-margin)';
  return (
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
      <span className="board-frame__label board-frame__label--tile">{tile ? `${tile.x + 1}, ${tile.y + 1}` : ''}</span>
    </div>
  );
}
