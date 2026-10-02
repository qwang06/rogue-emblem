// Pure layout of multi-tile structures (see STRUCTURE_SPRITES in tileset.js):
// which map tile each piece of a structure's image covers, and whether it
// draws over units.

// The tiles of `sprite` placed with its top-left tile at (x, y), in reading
// order, each as { x, y, frame, overUnits }: `frame` is the piece's frame on
// the image cut into one-tile frames, and `overUnits` is true for the top
// `roofRows` rows.
export function getStructureTiles(sprite, x, y) {
  const { width, height, roofRows = 0 } = sprite;
  const tiles = [];
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      tiles.push({ x: x + column, y: y + row, frame: row * width + column, overUnits: row < roofRows });
    }
  }
  return tiles;
}
