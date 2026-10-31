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

// The part of the world a camera at `zoom`, centered on `center`, shows on
// a canvas of `canvasSize` pixels, in world pixels.
export function getCameraView(
  center: { x: number; y: number },
  zoom: number,
  canvasSize: Size,
): { x: number; y: number; width: number; height: number } {
  const width = canvasSize.width / zoom;
  const height = canvasSize.height / zoom;
  return { x: center.x - width / 2, y: center.y - height / 2, width, height };
}

// How far past one canvas pixel per CSS pixel the game draws: the
// screen's devicePixelRatio, so a scaled display (125%, 150%, a Retina
// screen) gets every one of its pixels instead of a stretched canvas, but
// capped at MAX_PIXEL_RATIO to spare the GPU, and never below 1.
export const MAX_PIXEL_RATIO = 3;

// The canvas size, in canvas pixels, for a box `cssSize` CSS pixels big on
// a screen of `devicePixelRatio`, and the pixel ratio it's drawn at.
export function getRenderSize(
  cssSize: Size,
  devicePixelRatio: number,
): { width: number; height: number; pixelRatio: number } {
  const pixelRatio = Math.min(Math.max(devicePixelRatio || 1, 1), MAX_PIXEL_RATIO);
  return {
    width: Math.max(1, Math.round(cssSize.width * pixelRatio)),
    height: Math.max(1, Math.round(cssSize.height * pixelRatio)),
    pixelRatio,
  };
}
