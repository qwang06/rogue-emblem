// Pure camera rules for the map view.

interface Size {
  width: number;
  height: number;
}

// The largest zoom, in steps of `step` (whole numbers by default), at which
// a map of `mapSize` tiles ({ width, height }) fits inside a canvas of
// `canvasSize` pixels, capped at maxZoom so small maps don't balloon. Coarse
// steps keep pixel art crisp. Never below 1 (a map too big to fit is shown
// at 1x).
export function getFitZoom(mapSize: Size, tileSize: number, canvasSize: Size, maxZoom: number, step = 1): number {
  const fit = Math.min(canvasSize.width / (mapSize.width * tileSize), canvasSize.height / (mapSize.height * tileSize));
  const stepped = Math.floor(fit / step) * step;
  return Math.max(1, Math.min(stepped, maxZoom));
}
