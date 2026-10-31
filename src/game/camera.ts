// Pure camera rules for the map view.

import { getCellDimensions, type CellSize } from './grid.ts';

interface Size {
  width: number;
  height: number;
}

// The largest zoom, a whole number of `step`s, at which a map of `mapSize`
// tiles ({ width, height }) fits inside a canvas of `canvasSize` pixels,
// capped at maxZoom so small maps don't balloon. Steps keep pixel art
// crisp: with the default 1 every art pixel is a whole number of screen
// pixels; 0.5 suits art drawn at 2x (a 32px sheet on 64px tiles), whose
// pixels are still whole at half steps. Never below one step (a map too big
// to fit is shown at `step`).
export function getFitZoom(mapSize: Size, cell: CellSize, canvasSize: Size, maxZoom: number, step = 1): number {
  const { width, height } = getCellDimensions(cell);
  const fit = Math.min(canvasSize.width / (mapSize.width * width), canvasSize.height / (mapSize.height * height));
  // A hair of slack so a float like 2.9999999 still counts as 3 steps.
  const steps = Math.floor(fit / step + 1e-9);
  return Math.max(step, Math.min(steps * step, maxZoom));
}
