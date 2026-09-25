// Config for the Kenney "Tiny Battle" tileset (src/assets/kenney_tiny-battle).
// Frame indices are placeholders picked from the sheet for the initial grid —
// swap them out as real terrain/unit art is chosen.

export const TILE_SIZE = 16;
export const TILESET_KEY = 'tiny-battle';
export const TILESET_COLUMNS = 18;
export const TILESET_ROWS = 11;

export const TERRAIN_FRAMES = {
  grass: 0,
  water: 37,
};

// Unit sprites keyed by team, so every unit on a side shares its faction color.
export const UNIT_FRAMES = {
  player: 124, // green soldier sprite
  enemy: 160, // red soldier sprite
};

export const UI_FRAMES = {
  cursor: 61,
};

// Column/row of a frame in the sheet, so non-Phaser code (e.g. the React UI
// cropping a sprite out of the sheet image) can locate it.
export function getFramePosition(frame, columns = TILESET_COLUMNS) {
  return { col: frame % columns, row: Math.floor(frame / columns) };
}
