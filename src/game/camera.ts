// Pure camera rules for the map view.

interface Size {
  width: number;
  height: number;
}

// The largest whole-number zoom at which a map of `mapSize` tiles
// ({ width, height }) fits inside a canvas of `canvasSize` pixels, capped at
// maxZoom so small maps don't balloon. Whole numbers keep pixel art crisp.
// Never below 1 (a map too big to fit is shown at 1x).
export function getFitZoom(mapSize: Size, tileSize: number, canvasSize: Size, maxZoom: number): number {
  const fit = Math.min(
    Math.floor(canvasSize.width / (mapSize.width * tileSize)),
    Math.floor(canvasSize.height / (mapSize.height * tileSize)),
  );
  return Math.max(1, Math.min(fit, maxZoom));
}
