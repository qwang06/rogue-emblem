import Phaser from 'phaser';
import tilesetUrl from '../assets/kenney_tiny-battle/Tilemap/tilemap_packed.png';
import { gameStore } from '../bridge/gameStore.js';
import { toUnitView } from '../bridge/views.js';
import { createActionMenu, getSelectedAction, moveSelection } from '../game/actionMenu.js';
import { createCursor, moveCursor } from '../game/cursor.js';
import { createGrid, getCell, gridToWorld, setTerrain, setUnit } from '../game/grid.js';
import { TERRAIN_FRAMES, TILESET_KEY, TILE_SIZE, UI_FRAMES, UNIT_FRAMES } from '../game/tileset.js';
import { Unit } from '../game/Unit.js';

export const CANVAS_WIDTH = 640;
export const CANVAS_HEIGHT = 480;
const ZOOM = 2;

// Size the grid to fully cover the canvas at the current zoom, rounding up so
// there's no gap of background visible at the edges.
const GRID_WIDTH = Math.ceil(CANVAS_WIDTH / (TILE_SIZE * ZOOM));
const GRID_HEIGHT = Math.ceil(CANVAS_HEIGHT / (TILE_SIZE * ZOOM));

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

// Unit instances backing the demo grid's unitIds, keyed the same way as
// cell.unitId. Grid data stays plain/serializable; stats and behavior live
// on the Unit instances looked up from this registry.
function buildDemoUnits() {
  return new Map([
    [
      'placeholder',
      new Unit({
        name: 'Soldier',
        health: 10,
        attack: 4,
        defense: 2,
        movement: 5,
        team: 'player',
      }),
    ],
  ]);
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
    this.grid = buildDemoGrid();
    this.units = buildDemoUnits();

    this.renderTerrain(this.grid);
    this.renderUnits(this.grid);
    this.createCursor();

    this.cameras.main.setZoom(ZOOM);
    this.cameras.main.centerOn(
      (this.grid.width * TILE_SIZE) / 2,
      (this.grid.height * TILE_SIZE) / 2,
    );

    this.keys = this.input.keyboard.createCursorKeys();
    this.actionKeys = this.input.keyboard.addKeys({
      confirm: Phaser.Input.Keyboard.KeyCodes.ENTER,
      confirmAlt: Phaser.Input.Keyboard.KeyCodes.Z,
      cancel: Phaser.Input.Keyboard.KeyCodes.ESC,
      cancelAlt: Phaser.Input.Keyboard.KeyCodes.X,
    });

    this.actionMenu = null;
    this.hoveredUnit = null;
    this.updateHoveredUnit();
  }

  update() {
    const { JustDown } = Phaser.Input.Keyboard;
    const dx = Number(JustDown(this.keys.right)) - Number(JustDown(this.keys.left));
    const dy = Number(JustDown(this.keys.down)) - Number(JustDown(this.keys.up));
    const confirm = JustDown(this.actionKeys.confirm) || JustDown(this.actionKeys.confirmAlt);
    const cancel = JustDown(this.actionKeys.cancel) || JustDown(this.actionKeys.cancelAlt);

    if (this.actionMenu) {
      this.updateActionMenu(dy, confirm, cancel);
      return;
    }

    if (confirm && this.hoveredUnit?.team === 'player') {
      this.setActionMenu(createActionMenu());
      return;
    }

    if (dx === 0 && dy === 0) return;

    this.cursor = moveCursor(this.grid, this.cursor, dx, dy);
    this.updateCursorSprite();
    this.updateHoveredUnit();
  }

  // While the action menu is open it owns input: up/down move the
  // highlight, confirm picks an action, cancel closes the menu.
  updateActionMenu(dy, confirm, cancel) {
    if (cancel) {
      this.setActionMenu(null);
      return;
    }

    if (confirm) {
      const action = getSelectedAction(this.actionMenu);
      // Actions aren't implemented yet — choosing one just closes the menu.
      console.info(`Action selected: ${action?.id}`);
      this.setActionMenu(null);
      return;
    }

    if (dy !== 0) this.setActionMenu(moveSelection(this.actionMenu, dy));
  }

  setActionMenu(menu) {
    if (menu === this.actionMenu) return;
    this.actionMenu = menu;
    gameStore.setState({ actionMenu: menu });
  }

  // Looks up the unit (if any) under the cursor and, only on change,
  // publishes a snapshot to the game store for the React HUD to render.
  // GridScene doesn't know React exists — it only writes plain state.
  updateHoveredUnit() {
    const cell = getCell(this.grid, this.cursor.x, this.cursor.y);
    const unit = cell?.unitId ? this.units.get(cell.unitId) : null;

    if (unit === this.hoveredUnit) return;

    this.hoveredUnit = unit;
    gameStore.setState({ hoveredUnit: toUnitView(unit) });
  }

  createCursor() {
    this.cursor = createCursor(0, 0);
    const { x, y } = gridToWorld(this.cursor.x, this.cursor.y, TILE_SIZE);
    this.cursorSprite = this.add
      .sprite(x, y, TILESET_KEY, UI_FRAMES.cursor)
      .setOrigin(0, 0)
      .setDepth(1);
  }

  updateCursorSprite() {
    const { x, y } = gridToWorld(this.cursor.x, this.cursor.y, TILE_SIZE);
    this.cursorSprite.setPosition(x, y);
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
      const unit = this.units.get(cell.unitId);
      const { x, y } = gridToWorld(cell.x, cell.y, TILE_SIZE);
      this.add
        .sprite(x, y, TILESET_KEY, UNIT_FRAMES[cell.unitId] ?? UNIT_FRAMES.placeholder)
        .setOrigin(0, 0)
        .setData('unit', unit);
    }
  }
}
