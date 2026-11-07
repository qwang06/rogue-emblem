import type { CSSProperties } from 'react';
import { TERRAIN_SHEET_URLS } from '../assets/sprites.ts';
import { getTerrainIconTiles } from '../game/terrainInfo.ts';
import type { Terrain } from '../game/grid.ts';
import { SEASON_TERRAIN_SHEETS, TILE_SIZE, type Season } from '../game/tileset.ts';
import { useGameStore } from './useGameStore.ts';

// One map tile of a terrain, as the map draws it in the current season
// (getTerrainIconTiles layered bottom to top, from the season's terrain
// sheet), at `scale` times a tile, with crisp pixels. The terrain card's
// icon.
export function TerrainTile({ terrain, scale = 1 }: { terrain: Terrain; scale?: number }) {
  const season = useGameStore((state) => state.season);
  return <div className="terrain-tile" style={terrainTileStyle(terrain, season, scale)} aria-hidden="true" />;
}

function terrainTileStyle(terrain: Terrain, season: Season, scale: number): CSSProperties {
  const size = TILE_SIZE * scale;
  const sheet = SEASON_TERRAIN_SHEETS[season];
  const url = `url(${TERRAIN_SHEET_URLS[sheet.key]})`;
  // CSS paints the first background on top, so the top layer goes first.
  const layers = [...getTerrainIconTiles(terrain)].reverse();
  return {
    width: size,
    height: size,
    backgroundImage: layers.map(() => url).join(', '),
    backgroundSize: layers.map(() => `${sheet.columns * size}px auto`).join(', '),
    backgroundPosition: layers.map(([column, row]) => `${-column * size}px ${-row * size}px`).join(', '),
  };
}
