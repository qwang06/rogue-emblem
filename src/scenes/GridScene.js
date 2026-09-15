import Phaser from 'phaser';
import tilesetUrl from '../assets/kenney_tiny-battle/Tilemap/tilemap_packed.png';
import { createGrid, gridToWorld, setTerrain, setUnit } from '../game/grid.js';
import { TERRAIN_FRAMES, TILESET_KEY, TILE_SIZE, UNIT_FRAMES } from '../game/tileset.js';

const GRID_WIDTH = 12;
const GRID_HEIGHT = 9;

// A small demo layout so the grid has more than one terrain type and a unit
// to render. Real level data will replace this once maps are loaded from data.
function buildDemoGrid() {
  let grid = createGrid(GRID_WIDTH, GRID_HEIGHT, 'grass');

  for (let y = 2; y <= 4; y++) {
    for (let x = 5; x <= 7; x++) {
      grid = setTerrain(grid, x, y, 'water');
    }
  }

  grid = setUnit(grid, 1, 1, 'placeholder');

  return grid;
}

export class GridScene extends Phaser.Scene {
  constructor() {
    super('Grid');
  }

  preload() {
    this.load.spritesheet(TILESET_KEY, tilesetUrl, {
      frameWidth: TILE_SIZE,
      frameHeight: TILE_SIZE,
    });
  }

  create() {
    const grid = buildDemoGrid();

    this.renderTerrain(grid);
    this.renderUnits(grid);

    const zoom = 4;
    this.cameras.main.setZoom(zoom);
    this.cameras.main.centerOn((grid.width * TILE_SIZE) / 2, (grid.height * TILE_SIZE) / 2);
  }

  renderTerrain(grid) {
    const data = [];
    for (const cell of grid.cells) {
      data[cell.y] = data[cell.y] ?? [];
      data[cell.y][cell.x] = TERRAIN_FRAMES[cell.terrain] ?? TERRAIN_FRAMES.grass;
    }

    const map = this.make.tilemap({ data, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tileset = map.addTilesetImage(TILESET_KEY, TILESET_KEY, TILE_SIZE, TILE_SIZE);
    map.createLayer(0, tileset, 0, 0);
  }

  renderUnits(grid) {
    for (const cell of grid.cells) {
      if (!cell.unitId) continue;
      const { x, y } = gridToWorld(cell.x, cell.y, TILE_SIZE);
      this.add
        .sprite(x, y, TILESET_KEY, UNIT_FRAMES[cell.unitId] ?? UNIT_FRAMES.placeholder)
        .setOrigin(0, 0);
    }
  }
}
