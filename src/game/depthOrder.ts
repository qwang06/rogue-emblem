// Draw order between units and the tall map art they can stand behind
// (a mountain's peak, a tall building's top, a flag). Pure: given a row,
// it says at which Phaser depth to draw, so GridScene only applies it.
//
// Units and tall art share one narrow band of depths sorted by row (a
// y-sort): what stands further south is drawn in front. A unit's key is
// its row (fractional while it walks between rows); art rising out of
// cell (x, baseY) into the cells north of it sorts at baseY - 0.5, so it
// covers units north of its base, while a unit on the base cell or south
// of it, even a tall one poking up into the art, stays in front.
//
// The band sits over the range highlights (0.5) and intent arrows
// (0.65), above the unit outlines (0.74), and under the rank badges
// (0.76), the attacking unit (0.78) and roofs over units (0.8).

export const UNIT_DEPTH = 0.75;
// Depth between two rows: 100 rows fit under the rank badges.
const ROW_STEP = 1e-4;

// Depth of a unit whose sprite stands on `row` (fractional mid-move).
export function unitDepth(row: number): number {
  return UNIT_DEPTH + Math.max(0, row) * ROW_STEP;
}

// Depth of art that rises out of row `baseY` into the rows north of it:
// in front of every unit north of `baseY`, behind every unit on it or south.
export function tallArtDepth(baseY: number): number {
  return unitDepth(baseY - 0.5);
}
