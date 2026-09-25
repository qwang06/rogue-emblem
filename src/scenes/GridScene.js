import Phaser from 'phaser';
import tilesetUrl from '../assets/kenney_tiny-battle/Tilemap/tilemap_packed.png';
import { BATTLE_STATE_DEFAULTS, gameStore } from '../bridge/gameStore.js';
import { toDamagePopupView, toRosterEntryView, toUnitView, worldToScreen } from '../bridge/views.js';
import { createActionMenu, getSelectedAction, getUnitActions, moveSelection, selectIndex } from '../game/actionMenu.js';
import { calculateSkillDamage, findLearnedSkill, getLearnedSkills, getSkillActions } from '../game/skills.js';
import { calculateDamage, getAttackRange, getAttackTargets } from '../game/combat.js';
import { createCursor, moveCursor } from '../game/cursor.js';
import { createDemoLevel } from '../game/demoLevel.js';
import {
  canPlaceUnit,
  canStartBattle,
  getDeploymentActions,
  getFirstOpenTile,
  isPlaced,
  placeUnit,
} from '../game/deployment.js';
import { findUnit, getCell, gridToWorld, moveUnit, setUnit } from '../game/grid.js';
import { getArrowPieces } from '../game/moveArrow.js';
import { extendMovePath, getMovementRange } from '../game/movement.js';
import { PAUSE_ACTIONS } from '../game/pauseMenu.js';
import {
  ARROW_FRAMES,
  TERRAIN_FRAMES,
  TILESET_KEY,
  TILE_SIZE,
  UI_FRAMES,
  UNIT_FRAMES,
} from '../game/tileset.js';
import { playFireBurst, playGrenadeThrow, playHitFlash } from './effects.js';

export const CANVAS_WIDTH = 640;
export const CANVAS_HEIGHT = 480;
const ZOOM = 2;
const MOVE_RANGE_COLOR = 0x3b82f6;
const MOVE_RANGE_ALPHA = 0.45;
const ATTACK_RANGE_COLOR = 0xef4444;
const ATTACK_RANGE_ALPHA = 0.45;
const SKILL_RANGE_COLOR = 0xf97316;
const SKILL_RANGE_ALPHA = 0.45;
const DEPLOYMENT_ZONE_COLOR = 0xfacc15;
const DEPLOYMENT_ZONE_ALPHA = 0.4;
// Deployment menu entries, by index, for re-opening it on a given one.
const PLACE_UNITS_INDEX = 0;
const START_INDEX = 1;
// Pause between each tile a unit steps through when it moves.
const MOVE_STEP_DELAY_MS = 80;
// How long a damage number stays on screen (the React HUD animates it).
const DAMAGE_POPUP_DURATION_MS = 700;

// Size the grid to fully cover the canvas at the current zoom, rounding up so
// there's no gap of background visible at the edges.
const GRID_WIDTH = Math.ceil(CANVAS_WIDTH / (TILE_SIZE * ZOOM));
const GRID_HEIGHT = Math.ceil(CANVAS_HEIGHT / (TILE_SIZE * ZOOM));

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
    // Every battle starts from a clean slate: clear anything a previous
    // battle left in the store, then enter the deployment phase.
    gameStore.setState({ ...BATTLE_STATE_DEFAULTS, phase: 'deployment' });

    const level = createDemoLevel(GRID_WIDTH, GRID_HEIGHT);
    this.grid = level.grid;
    this.units = level.units; // unitId -> Unit, player roster and enemies alike
    this.roster = level.roster; // player unitIds that can be deployed
    this.deploymentZone = level.deploymentZone;

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

    this.phase = 'deployment'; // 'deployment' | 'battle'
    this.actionMenu = null;
    this.skillMenu = null; // the active unit's skills, opened from the action menu
    this.deploymentMenu = null; // Place Units / Start
    this.rosterMenu = null; // units to pick from when placing
    this.pauseMenu = null; // Main Menu / Settings, opened with cancel on the bare map
    this.placingUnitId = null; // unit being placed while choosing its tile
    this.zoneTiles = null; // highlight rectangles for the deployment zone
    this.activeUnit = null; // { unitId, unit, x, y } the menu / range belongs to
    this.rangeMode = null; // 'move' | 'attack' | 'skill' while choosing a destination or target
    this.activeSkill = null; // the skill being aimed while rangeMode is 'skill'
    this.rangeTiles = null; // highlight rectangles for the current range
    this.moveRange = null; // [{ x, y, cost }] the active unit can end its move on
    this.movePath = null; // planned route [{ x, y }] from the active unit to the cursor
    this.arrowSprites = []; // arrow pieces drawn along movePath
    this.inputLocked = false; // input is ignored while a move or hit plays out
    this.hoveredUnit = null;
    this.nextPopupId = 1;
    this.updateHoveredUnit();
    this.startDeployment();
  }

  update() {
    const { JustDown } = Phaser.Input.Keyboard;
    const dx = Number(JustDown(this.keys.right)) - Number(JustDown(this.keys.left));
    const dy = Number(JustDown(this.keys.down)) - Number(JustDown(this.keys.up));
    const confirm = JustDown(this.actionKeys.confirm) || JustDown(this.actionKeys.confirmAlt);
    const cancel = JustDown(this.actionKeys.cancel) || JustDown(this.actionKeys.cancelAlt);

    if (this.inputLocked) return;

    if (this.pauseMenu) {
      this.updatePauseMenu(dy, confirm, cancel);
      return;
    }

    if (this.phase === 'deployment') {
      this.updateDeployment(dx, dy, confirm, cancel);
      return;
    }

    if (this.skillMenu) {
      this.updateSkillMenu(dy, confirm, cancel);
      return;
    }

    if (this.actionMenu) {
      this.updateActionMenu(dy, confirm, cancel);
      return;
    }

    if (this.rangeMode) {
      // Confirm acts on the tile under the cursor if it's valid (other
      // tiles are ignored); cancel backs out to the action menu.
      if (confirm) {
        if (this.rangeMode === 'move') this.tryMoveActiveUnit();
        else if (this.rangeMode === 'skill') this.tryUseSkill();
        else this.tryAttackWithActiveUnit();
        return;
      }
      if (cancel && this.rangeMode === 'skill') {
        // Back out of aiming to the skill menu the skill was picked from.
        this.hideRange();
        this.setCursor(this.activeUnit.x, this.activeUnit.y);
        this.openSkillMenu();
        return;
      }
      if (cancel) {
        this.hideRange();
        this.setCursor(this.activeUnit.x, this.activeUnit.y);
        this.openActionMenu();
        return;
      }
    } else if (confirm && this.hoveredUnit?.team === 'player') {
      const { unitId } = getCell(this.grid, this.cursor.x, this.cursor.y);
      this.activeUnit = { unitId, unit: this.hoveredUnit, x: this.cursor.x, y: this.cursor.y };
      this.openActionMenu();
      return;
    } else if (cancel) {
      // Nothing to back out of on the bare map, so cancel opens the pause menu.
      this.publishMenu('pauseMenu', createActionMenu(PAUSE_ACTIONS));
      return;
    }

    if (dx === 0 && dy === 0) return;

    this.setCursor(this.cursor.x + dx, this.cursor.y + dy);
    if (this.rangeMode === 'move') this.updateMovePath();
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
      if (action?.disabled) return;
      this.setActionMenu(null);
      if (action?.id === 'move') {
        this.setCursor(this.activeUnit.x, this.activeUnit.y);
        this.showMoveRange();
      } else if (action?.id === 'attack') {
        this.setCursor(this.activeUnit.x, this.activeUnit.y);
        this.showAttackRange();
      } else if (action?.id === 'skill') {
        this.openSkillMenu();
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
    this.publishMenu('actionMenu', menu);
  }

  // Opens the action menu for the active unit. Skill is only available
  // once the unit has learned a skill.
  openActionMenu() {
    const { unit } = this.activeUnit;
    const hasSkills = getLearnedSkills(unit.unitClass, unit.level).length > 0;
    this.setActionMenu(createActionMenu(getUnitActions({ hasSkills })));
  }

  openSkillMenu() {
    const { unit } = this.activeUnit;
    const skills = getLearnedSkills(unit.unitClass, unit.level);
    this.publishMenu('skillMenu', createActionMenu(getSkillActions(unit, skills)));
  }

  // While the skill menu is open it owns input: up/down move the
  // highlight, cancel goes back to the action menu, and confirm picks a
  // skill the unit can afford and shows its range to aim it.
  updateSkillMenu(dy, confirm, cancel) {
    if (cancel) {
      this.publishMenu('skillMenu', null);
      this.openActionMenu();
      return;
    }

    if (confirm) {
      const skill = getSelectedAction(this.skillMenu);
      if (!skill || skill.disabled) return;
      this.publishMenu('skillMenu', null);
      const { unit, x, y } = this.activeUnit;
      this.activeSkill = findLearnedSkill(unit.unitClass, unit.level, skill.id);
      this.setCursor(x, y);
      this.showRange('skill', getAttackRange(this.grid, { x, y }, this.activeSkill.range), SKILL_RANGE_COLOR, SKILL_RANGE_ALPHA);
      return;
    }

    if (dy !== 0) this.publishMenu('skillMenu', moveSelection(this.skillMenu, dy));
  }

  // Keeps a menu on the scene and mirrors it to the store field of the same
  // name (actionMenu, skillMenu, deploymentMenu, rosterMenu) for React to draw.
  publishMenu(key, menu) {
    if (menu === this[key]) return;
    this[key] = menu;
    gameStore.setState({ [key]: menu });
  }

  // While the pause menu is open it owns input: cancel closes it, Main Menu
  // leaves the battle for the title screen. Settings isn't built yet.
  updatePauseMenu(dy, confirm, cancel) {
    if (cancel) {
      this.publishMenu('pauseMenu', null);
      return;
    }

    if (confirm) {
      const action = getSelectedAction(this.pauseMenu);
      if (action?.id === 'main-menu') this.exitToTitle();
      else console.info(`Pause action selected: ${action?.id}`);
      return;
    }

    if (dy !== 0) this.publishMenu('pauseMenu', moveSelection(this.pauseMenu, dy));
  }

  // Clears the battle's UI state and switches to the title screen, which
  // makes main.js remove this scene. The next Play starts a fresh battle.
  exitToTitle() {
    this.inputLocked = true;
    gameStore.setState({ ...BATTLE_STATE_DEFAULTS, screen: 'title' });
  }

  // ---- Deployment phase -------------------------------------------------
  // Before the battle, the player picks units from the roster and places
  // them on the deployment zone. Three steps, each owning input in turn:
  //   'menu'    — Place Units / Start
  //   'roster'  — pick the unit to place
  //   'placing' — move the cursor and confirm a zone tile
  // The rules (valid tiles, when Start is allowed) live in
  // src/game/deployment.js; this only drives input and rendering.

  startDeployment() {
    this.phase = 'deployment';
    this.zoneTiles = this.drawTileHighlights(
      this.deploymentZone,
      DEPLOYMENT_ZONE_COLOR,
      DEPLOYMENT_ZONE_ALPHA,
    );
    // The cursor stays hidden while a deployment menu has input; it only
    // appears once there's a tile to choose.
    this.setCursorVisible(false);
    this.openDeploymentMenu(PLACE_UNITS_INDEX);
  }

  setDeploymentStep(step) {
    gameStore.setState({ deploymentStep: step });
  }

  updateDeployment(dx, dy, confirm, cancel) {
    if (this.deploymentMenu) {
      this.updateDeploymentMenu(dy, confirm);
      return;
    }

    if (this.rosterMenu) {
      this.updateRosterMenu(dy, confirm, cancel);
      return;
    }

    // Placing: the cursor roams the map; only valid zone tiles accept confirm.
    if (confirm) {
      this.tryPlaceUnit();
      return;
    }
    if (cancel) {
      this.placingUnitId = null;
      this.setCursorVisible(false);
      this.openRosterMenu();
      return;
    }
    if (dx !== 0 || dy !== 0) this.setCursor(this.cursor.x + dx, this.cursor.y + dy);
  }

  // Start is rebuilt each time so it enables once a unit has been placed.
  openDeploymentMenu(selectedIndex) {
    const actions = getDeploymentActions({ canStart: canStartBattle(this.grid, this.roster) });
    this.publishMenu('deploymentMenu', selectIndex(createActionMenu(actions), selectedIndex));
    this.setDeploymentStep('menu');
  }

  updateDeploymentMenu(dy, confirm) {
    if (confirm) {
      const action = getSelectedAction(this.deploymentMenu);
      if (action?.id === 'place-units') {
        this.publishMenu('deploymentMenu', null);
        this.openRosterMenu();
      } else if (action?.id === 'start' && !action.disabled) {
        this.startBattle();
      }
      return;
    }

    if (dy !== 0) this.publishMenu('deploymentMenu', moveSelection(this.deploymentMenu, dy));
  }

  openRosterMenu() {
    const entries = this.roster.map((id) => {
      const unit = this.units.get(id);
      return toRosterEntryView({
        id,
        unit,
        frame: UNIT_FRAMES[unit.team] ?? UNIT_FRAMES.player,
        placed: isPlaced(this.grid, id),
      });
    });
    this.publishMenu('rosterMenu', createActionMenu(entries));
    this.setDeploymentStep('roster');
  }

  updateRosterMenu(dy, confirm, cancel) {
    if (cancel) {
      this.publishMenu('rosterMenu', null);
      this.openDeploymentMenu(PLACE_UNITS_INDEX);
      return;
    }

    if (confirm) {
      const entry = getSelectedAction(this.rosterMenu);
      if (!entry) return;
      this.publishMenu('rosterMenu', null);
      this.beginPlacing(entry.id);
      return;
    }

    if (dy !== 0) this.publishMenu('rosterMenu', moveSelection(this.rosterMenu, dy));
  }

  // Starts the cursor where the unit already stands, or on the first open
  // zone tile if it hasn't been placed yet.
  beginPlacing(unitId) {
    this.placingUnitId = unitId;
    const tile =
      findUnit(this.grid, unitId) ??
      getFirstOpenTile(this.grid, this.deploymentZone) ??
      this.deploymentZone[0];
    this.setCursor(tile.x, tile.y);
    this.setCursorVisible(true);
    this.setDeploymentStep('placing');
  }

  tryPlaceUnit() {
    const unitId = this.placingUnitId;
    const { x, y } = this.cursor;
    if (!canPlaceUnit(this.grid, this.deploymentZone, unitId, x, y)) return;

    this.grid = placeUnit(this.grid, this.deploymentZone, unitId, x, y);
    const sprite = this.unitSprites.get(unitId);
    if (sprite) {
      const pos = gridToWorld(x, y, TILE_SIZE);
      sprite.setPosition(pos.x, pos.y);
    } else {
      this.addUnitSprite(unitId, x, y);
    }

    this.placingUnitId = null;
    this.setCursorVisible(false);
    this.openDeploymentMenu(START_INDEX);
  }

  // Ends deployment: clears the zone and hands input to the battle, with
  // the cursor on the first deployed unit.
  startBattle() {
    for (const tile of this.zoneTiles ?? []) tile.destroy();
    this.zoneTiles = null;
    this.publishMenu('deploymentMenu', null);
    this.phase = 'battle';
    gameStore.setState({ phase: 'battle', deploymentStep: null });

    const first = this.roster.map((id) => findUnit(this.grid, id)).find(Boolean);
    if (first) this.setCursor(first.x, first.y);
    this.setCursorVisible(true);
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

  // Highlights every tile the active unit can reach and starts the planned
  // route at the unit. The range itself comes from src/game/movement.js;
  // this only draws it.
  showMoveRange() {
    const { unit, x, y } = this.activeUnit;
    this.moveRange = getMovementRange(this.grid, { x, y }, unit.movement, this.movementOptions(unit));
    this.movePath = [{ x, y }];
    this.showRange('move', this.moveRange, MOVE_RANGE_COLOR, MOVE_RANGE_ALPHA);
  }

  // Follows the cursor with the planned route (extendMovePath keeps the
  // way the player traced it where it can) and redraws the arrow along it.
  updateMovePath() {
    const { unit } = this.activeUnit;
    const path = extendMovePath(
      this.grid,
      this.movePath,
      this.cursor,
      unit.movement,
      this.movementOptions(unit),
    );
    if (path === this.movePath) return;
    this.movePath = path;
    this.drawMoveArrow(path);
  }

  // Draws the arrow pieces from src/game/moveArrow.js above the range
  // highlight and below units.
  drawMoveArrow(path) {
    this.clearMoveArrow();
    this.arrowSprites = getArrowPieces(path).map(({ x, y, piece }) => {
      const pos = gridToWorld(x, y, TILE_SIZE);
      return this.add
        .sprite(pos.x, pos.y, TILESET_KEY, ARROW_FRAMES[piece])
        .setOrigin(0, 0)
        .setDepth(0.6);
    });
  }

  clearMoveArrow() {
    for (const sprite of this.arrowSprites) sprite.destroy();
    this.arrowSprites = [];
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
    this.rangeTiles = this.drawTileHighlights(tiles, color, alpha);
  }

  // Draws a translucent square over each tile, under units and the cursor.
  // Returns the rectangles so the caller can destroy them later.
  drawTileHighlights(tiles, color, alpha) {
    return tiles.map((tile) => {
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
    this.activeSkill = null;
    this.clearMoveArrow();
    this.moveRange = null;
    this.movePath = null;
  }

  // Moves the active unit to the tile under the cursor, if that tile is in
  // its range. It walks the planned route the arrow shows, tile by tile.
  tryMoveActiveUnit() {
    const { unitId, x, y } = this.activeUnit;
    const from = { x, y };
    const to = { x: this.cursor.x, y: this.cursor.y };
    const path = this.movePath;
    const end = path[path.length - 1];
    const inRange = this.moveRange.some((t) => t.x === to.x && t.y === to.y);
    if (!inRange || end.x !== to.x || end.y !== to.y) return;

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

  // Uses the aimed skill on the unit under the cursor, if it's a hostile
  // unit in the skill's range. Mana is spent and damage from
  // src/game/skills.js applied right away; then the skill's animation plays
  // (a grenade lobbed onto the target, bursting into fire) and a unit
  // brought to 0 health is removed once it finishes.
  tryUseSkill() {
    const { unit, unitId, x, y } = this.activeUnit;
    const skill = this.activeSkill;
    const target = getAttackTargets(this.grid, { x, y }, skill.range, this.isHostileTo(unit)).find(
      (t) => t.x === this.cursor.x && t.y === this.cursor.y,
    );
    if (!target) return;

    const defender = this.units.get(target.unitId);
    const damage = calculateSkillDamage(skill, defender);
    unit.spendMana(skill.manaCost);
    defender.takeDamage(damage);

    this.hideRange();
    this.inputLocked = true;
    const userSprite = this.unitSprites.get(unitId);
    const defenderSprite = this.unitSprites.get(target.unitId);
    const center = (sprite) => ({ x: sprite.x + TILE_SIZE / 2, y: sprite.y + TILE_SIZE / 2 });

    playGrenadeThrow(this, center(userSprite), center(defenderSprite), () => {
      // The HUD only shows the new health once the grenade lands.
      this.publishHoveredUnit();
      this.showDamagePopup(defenderSprite, damage);
      playFireBurst(this, defenderSprite, center(defenderSprite), () => {
        if (!defender.isAlive()) this.removeUnit(target);
        this.activeUnit = null;
        this.inputLocked = false;
        this.updateHoveredUnit();
      });
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

  // Looks up the unit (if any) under the visible cursor and, only on change,
  // publishes a snapshot to the game store for the React HUD to render.
  // GridScene doesn't know React exists — it only writes plain state.
  updateHoveredUnit() {
    const cell = this.cursorSprite.visible ? getCell(this.grid, this.cursor.x, this.cursor.y) : null;
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

  // A hidden cursor hovers nothing, so the unit panel clears with it.
  setCursorVisible(visible) {
    this.cursorSprite.setVisible(visible);
    this.updateHoveredUnit();
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

  // Draws a sprite per unit on the grid and keeps them in this.unitSprites
  // (unitId -> sprite) so later moves can find the sprite to reposition.
  // Units placed during deployment get theirs from addUnitSprite.
  renderUnits(grid) {
    this.unitSprites = new Map();
    for (const cell of grid.cells) {
      if (cell.unitId) this.addUnitSprite(cell.unitId, cell.x, cell.y);
    }
  }

  addUnitSprite(unitId, gridX, gridY) {
    const unit = this.units.get(unitId);
    const { x, y } = gridToWorld(gridX, gridY, TILE_SIZE);
    const sprite = this.add
      .sprite(x, y, TILESET_KEY, UNIT_FRAMES[unit.team] ?? UNIT_FRAMES.player)
      .setOrigin(0, 0)
      .setDepth(0.75)
      .setData('unit', unit);
    this.unitSprites.set(unitId, sprite);
  }
}
