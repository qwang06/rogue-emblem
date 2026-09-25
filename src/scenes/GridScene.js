import Phaser from 'phaser';
import tilesetUrl from '../assets/kenney_tiny-battle/Tilemap/tilemap_packed.png';
import { gameStore } from '../bridge/gameStore.js';
import { toDamagePopupView, toUnitView, worldToScreen } from '../bridge/views.js';
import { createActionMenu, getSelectedAction, moveSelection } from '../game/actionMenu.js';
import { calculateDamage, getAttackRange, getAttackTargets } from '../game/combat.js';
import { createCursor, moveCursor } from '../game/cursor.js';
import { createGrid, getCell, gridToWorld, moveUnit, setTerrain, setUnit } from '../game/grid.js';
import { getMovePath, getMovementRange } from '../game/movement.js';
import { TERRAIN_FRAMES, TILESET_KEY, TILE_SIZE, UI_FRAMES, UNIT_FRAMES } from '../game/tileset.js';
import { Unit } from '../game/Unit.js';
import { playHitFlash } from './effects.js';

export const CANVAS_WIDTH = 640;
export const CANVAS_HEIGHT = 480;
const ZOOM = 2;
const MOVE_RANGE_COLOR = 0x3b82f6;
const MOVE_RANGE_ALPHA = 0.45;
const ATTACK_RANGE_COLOR = 0xef4444;
const ATTACK_RANGE_ALPHA = 0.45;
// Pause between each tile a unit steps through when it moves.
const MOVE_STEP_DELAY_MS = 80;
// How long a damage number stays on screen (the React HUD animates it).
const DAMAGE_POPUP_DURATION_MS = 700;

// Size the grid to fully cover the canvas at the current zoom, rounding up so
// there's no gap of background visible at the edges.
const GRID_WIDTH = Math.ceil(CANVAS_WIDTH / (TILE_SIZE * ZOOM));
const GRID_HEIGHT = Math.ceil(CANVAS_HEIGHT / (TILE_SIZE * ZOOM));

// A small demo layout so the grid has more than one terrain type and a
// player and an enemy unit to render. Real level data will replace this once maps are loaded from data.
function buildDemoGrid() {
  let grid = createGrid(GRID_WIDTH, GRID_HEIGHT, 'grass');

  for (let y = 2; y <= 4; y++) {
    for (let x = 5; x <= 7; x++) {
      grid = setTerrain(grid, x, y, 'water');
    }
  }

  grid = setUnit(grid, 1, 1, 'soldier');
  grid = setUnit(grid, 4, 4, 'enemy-soldier');

  return grid;
}

// Unit instances backing the demo grid's unitIds, keyed the same way as
// cell.unitId. Grid data stays plain/serializable; stats and behavior live
// on the Unit instances looked up from this registry.
function buildDemoUnits() {
  return new Map([
    [
      'soldier',
      new Unit({
        name: 'Soldier',
        health: 10,
        attack: 4,
        defense: 2,
        movement: 5,
        team: 'player',
      }),
    ],
    [
      'enemy-soldier',
      new Unit({
        name: 'Enemy Soldier',
        health: 10,
        attack: 4,
        defense: 2,
        movement: 5,
        team: 'enemy',
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
    this.activeUnit = null; // { unitId, unit, x, y } the menu / range belongs to
    this.rangeMode = null; // 'move' | 'attack' while choosing a destination or target
    this.rangeTiles = null; // highlight rectangles for the current range
    this.inputLocked = false; // input is ignored while a move or hit plays out
    this.hoveredUnit = null;
    this.nextPopupId = 1;
    this.updateHoveredUnit();
  }

  update() {
    const { JustDown } = Phaser.Input.Keyboard;
    const dx = Number(JustDown(this.keys.right)) - Number(JustDown(this.keys.left));
    const dy = Number(JustDown(this.keys.down)) - Number(JustDown(this.keys.up));
    const confirm = JustDown(this.actionKeys.confirm) || JustDown(this.actionKeys.confirmAlt);
    const cancel = JustDown(this.actionKeys.cancel) || JustDown(this.actionKeys.cancelAlt);

    if (this.inputLocked) return;

    if (this.actionMenu) {
      this.updateActionMenu(dy, confirm, cancel);
      return;
    }

    if (this.rangeMode) {
      // Confirm acts on the tile under the cursor if it's valid (other
      // tiles are ignored); cancel backs out to the action menu.
      if (confirm) {
        if (this.rangeMode === 'move') this.tryMoveActiveUnit();
        else this.tryAttackWithActiveUnit();
        return;
      }
      if (cancel) {
        this.hideRange();
        this.setCursor(this.activeUnit.x, this.activeUnit.y);
        this.setActionMenu(createActionMenu());
        return;
      }
    } else if (confirm && this.hoveredUnit?.team === 'player') {
      const { unitId } = getCell(this.grid, this.cursor.x, this.cursor.y);
      this.activeUnit = { unitId, unit: this.hoveredUnit, x: this.cursor.x, y: this.cursor.y };
      this.setActionMenu(createActionMenu());
      return;
    }

    if (dx === 0 && dy === 0) return;

    this.setCursor(this.cursor.x + dx, this.cursor.y + dy);
  }

  // While the action menu is open it owns input: up/down move the
  // highlight, confirm picks an action, cancel closes the menu.
  updateActionMenu(dy, confirm, cancel) {
    if (cancel) {
      this.setActionMenu(null);
      this.activeUnit = null;
      return;
    }

    if (confirm) {
      const action = getSelectedAction(this.actionMenu);
      this.setActionMenu(null);
      if (action?.id === 'move') {
        this.setCursor(this.activeUnit.x, this.activeUnit.y);
        this.showMoveRange();
      } else if (action?.id === 'attack') {
        this.setCursor(this.activeUnit.x, this.activeUnit.y);
        this.showAttackRange();
      } else {
        // Other actions aren't implemented yet — choosing one just closes the menu.
        console.info(`Action selected: ${action?.id}`);
        this.activeUnit = null;
      }
      return;
    }

    if (dy !== 0) this.setActionMenu(moveSelection(this.actionMenu, dy));
  }

  setActionMenu(menu) {
    if (menu === this.actionMenu) return;
    this.actionMenu = menu;
    gameStore.setState({ actionMenu: menu });
  }

  // Options for src/game/movement.js: allies can be walked through, anyone
  // else blocks.
  movementOptions(unit) {
    return {
      canPassThrough: (unitId) => this.units.get(unitId)?.team === unit.team,
    };
  }

  // Units on another team are fair game to attack.
  isHostileTo(unit) {
    return (unitId) => {
      const other = this.units.get(unitId);
      return Boolean(other) && other.team !== unit.team;
    };
  }

  // Highlights every tile the active unit can reach. The range itself comes
  // from src/game/movement.js; this only draws it.
  showMoveRange() {
    const { unit, x, y } = this.activeUnit;
    const range = getMovementRange(this.grid, { x, y }, unit.movement, this.movementOptions(unit));
    this.showRange('move', range, MOVE_RANGE_COLOR, MOVE_RANGE_ALPHA);
  }

  // Highlights every tile the active unit can strike, from
  // src/game/combat.js. Only tiles holding a hostile unit accept confirm.
  showAttackRange() {
    const { unit, x, y } = this.activeUnit;
    const range = getAttackRange(this.grid, { x, y }, unit.range);
    this.showRange('attack', range, ATTACK_RANGE_COLOR, ATTACK_RANGE_ALPHA);
  }

  showRange(mode, tiles, color, alpha) {
    this.rangeMode = mode;
    this.rangeTiles = tiles.map((tile) => {
      const pos = gridToWorld(tile.x, tile.y, TILE_SIZE);
      return this.add
        .rectangle(pos.x, pos.y, TILE_SIZE, TILE_SIZE, color, alpha)
        .setOrigin(0, 0)
        .setDepth(0.5);
    });
  }

  hideRange() {
    for (const tile of this.rangeTiles ?? []) tile.destroy();
    this.rangeTiles = null;
    this.rangeMode = null;
  }

  // Moves the active unit to the tile under the cursor, if that tile is in
  // its range. The route comes from getMovePath, so the unit walks there
  // tile by tile rather than jumping.
  tryMoveActiveUnit() {
    const { unitId, unit, x, y } = this.activeUnit;
    const from = { x, y };
    const to = { x: this.cursor.x, y: this.cursor.y };
    const path = getMovePath(this.grid, from, to, unit.movement, this.movementOptions(unit));
    if (!path) return;

    this.hideRange();
    this.inputLocked = true;
    this.walkSprite(this.unitSprites.get(unitId), path, () => {
      this.grid = moveUnit(this.grid, from, to);
      this.activeUnit = null;
      this.inputLocked = false;
      this.updateHoveredUnit();
    });
  }

  // Attacks the unit under the cursor, if it's a hostile unit in range.
  // Damage comes from src/game/combat.js and is applied right away so the
  // HUD shows the new health while the target's sprite flashes and a damage
  // number pops over it; a unit
  // brought to 0 health is removed once the flash finishes.
  tryAttackWithActiveUnit() {
    const { unit, x, y } = this.activeUnit;
    const target = getAttackTargets(this.grid, { x, y }, unit.range, this.isHostileTo(unit)).find(
      (t) => t.x === this.cursor.x && t.y === this.cursor.y,
    );
    if (!target) return;

    const defender = this.units.get(target.unitId);
    const damage = calculateDamage(unit, defender);
    defender.takeDamage(damage);
    this.publishHoveredUnit();

    this.hideRange();
    this.inputLocked = true;
    const defenderSprite = this.unitSprites.get(target.unitId);
    this.showDamagePopup(defenderSprite, damage);
    playHitFlash(this, defenderSprite, () => {
      if (!defender.isAlive()) this.removeUnit(target);
      this.activeUnit = null;
      this.inputLocked = false;
      this.updateHoveredUnit();
    });
  }

  // Publishes a damage number rising from the top center of a sprite for
  // the React HUD to draw, and takes it back down once it's run its course.
  showDamagePopup(sprite, amount) {
    const { worldView, zoom } = this.cameras.main;
    const { x, y } = worldToScreen(
      { x: sprite.x + sprite.displayWidth / 2, y: sprite.y },
      { x: worldView.x, y: worldView.y, zoom },
    );
    const popup = toDamagePopupView({
      id: this.nextPopupId++,
      amount,
      x,
      y,
      durationMs: DAMAGE_POPUP_DURATION_MS,
    });

    gameStore.setState((state) => ({ damagePopups: [...state.damagePopups, popup] }));
    this.time.delayedCall(DAMAGE_POPUP_DURATION_MS, () => {
      gameStore.setState((state) => ({
        damagePopups: state.damagePopups.filter((p) => p !== popup),
      }));
    });
  }

  // Takes a defeated unit off the board: grid cell, registry, and sprite.
  removeUnit({ x, y, unitId }) {
    this.grid = setUnit(this.grid, x, y, null);
    this.units.delete(unitId);
    this.unitSprites.get(unitId).destroy();
    this.unitSprites.delete(unitId);
  }

  // Steps a sprite through each tile of path (path[0] is where it already
  // is), pausing between steps, then calls onDone. No tweening yet — the
  // sprite snaps from tile to tile.
  walkSprite(sprite, path, onDone) {
    const steps = path.slice(1);
    if (steps.length === 0) {
      onDone();
      return;
    }

    let next = 0;
    this.time.addEvent({
      delay: MOVE_STEP_DELAY_MS,
      repeat: steps.length - 1,
      callback: () => {
        const { x, y } = gridToWorld(steps[next].x, steps[next].y, TILE_SIZE);
        sprite.setPosition(x, y);
        next += 1;
        if (next === steps.length) onDone();
      },
    });
  }

  setCursor(x, y) {
    this.cursor = moveCursor(this.grid, this.cursor, x - this.cursor.x, y - this.cursor.y);
    this.updateCursorSprite();
    this.updateHoveredUnit();
  }

  // Looks up the unit (if any) under the cursor and, only on change,
  // publishes a snapshot to the game store for the React HUD to render.
  // GridScene doesn't know React exists — it only writes plain state.
  updateHoveredUnit() {
    const cell = getCell(this.grid, this.cursor.x, this.cursor.y);
    const unit = cell?.unitId ? this.units.get(cell.unitId) : null;

    if (unit === this.hoveredUnit) return;

    this.hoveredUnit = unit;
    this.publishHoveredUnit();
  }

  // Publishes a fresh snapshot of the hovered unit — also needed when that
  // unit's stats change without the cursor moving (e.g. it takes damage).
  publishHoveredUnit() {
    gameStore.setState({ hoveredUnit: toUnitView(this.hoveredUnit) });
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

  // Draws a sprite per unit and keeps them in this.unitSprites (unitId ->
  // sprite) so later moves can find the sprite to reposition.
  renderUnits(grid) {
    this.unitSprites = new Map();
    for (const cell of grid.cells) {
      if (!cell.unitId) continue;
      const unit = this.units.get(cell.unitId);
      const { x, y } = gridToWorld(cell.x, cell.y, TILE_SIZE);
      const sprite = this.add
        .sprite(x, y, TILESET_KEY, UNIT_FRAMES[unit.team] ?? UNIT_FRAMES.player)
        .setOrigin(0, 0)
        .setDepth(0.75)
        .setData('unit', unit);
      this.unitSprites.set(cell.unitId, sprite);
    }
  }
}
