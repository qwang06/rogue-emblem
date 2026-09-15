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

export const UNIT_FRAMES = {
  placeholder: 124, // green soldier sprite
};

export const UI_FRAMES = {
  cursor: 61,
};
