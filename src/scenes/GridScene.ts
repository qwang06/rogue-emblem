import Phaser from 'phaser';
import { SPRITE_URLS } from '../assets/sprites.ts';
import terrainSheetUrl from '../assets/overworld.png';
import { gameCommands, type Command, type MenuField } from '../bridge/commands.ts';
import { getActiveContent } from '../data/customContent.ts';
import {
  BATTLE_STATE_DEFAULTS,
  gameStore,
  type BattlePhase,
  type BattleSetup,
  type BattleState,
  type DeploymentStep,
  type GameState,
} from '../bridge/gameStore.ts';
import {
  mergeTileAnchors,
  toCombatForecastView,
  toDamagePopupView,
  toDialogView,
  toExperienceGainView,
  toLevelUpView,
  toObjectiveView,
  toRunOverView,
  toPhaseBannerView,
  toCanvasFraction,
  toRosterEntryView,
  toTileAnchorView,
  toTurnView,
  toUnitDetailView,
  toUnitView,
  worldToScreen,
  type RunOverView,
} from '../bridge/views.ts';
import { createActionMenu, getSelectedAction, getUnitActions, moveSelection, selectIndex } from '../game/actionMenu.ts';
import { getCombatExperience, getCombatOutcome } from '../game/experience.ts';
import {
  findUsableStaff,
  getHealAmount,
  getHealTargets,
  getStaves,
  HEAL_EXPERIENCE,
  isWounded,
  type CarriedStaff,
  type Staff,
} from '../game/healing.ts';
import { calculateSkillDamage, findLearnedSkill, getLearnedSkills, getSkillActions } from '../game/skills.ts';
import { getAttackRange, getAttackTargets, getCombatForecast, getThreatRange, resolveCombat } from '../game/combat.ts';
import { getFitZoom } from '../game/camera.ts';
import { createCursor, moveCursor } from '../game/cursor.ts';
import {
  createBattleLevel,
  describeBattle,
  FIRST_STORY_CHAPTER,
  getNextBattle,
  runStage,
  type GameContent,
} from '../game/battleSetup.ts';
import { finishStage } from '../game/warband/run.ts';
import { clearSavedRun, saveRun } from '../data/runSave.ts';
import { randomSeed } from '../game/rng.ts';
import { getStructureTiles } from '../game/structures.ts';
import { getConsumables, getItemActions } from '../game/items.ts';
import { getWeaponActions, getWeaponReach, type Weapon, type WeaponAction } from '../game/weapons.ts';
import { planRushAction } from '../game/enemyAI.ts';
import { createAttackScorer } from '../game/aiScoring.ts';
import {
  canDeployUnit,
  canPlaceUnit,
  canStartBattle,
  getDeploymentActions,
  getDeploymentLimit,
  getFirstOpenTile,
  isDeploymentComplete,
  isPlaced,
  placeUnit,
} from '../game/deployment.ts';
import {
  findTileAt,
  findUnit,
  getCell,
  getDistance,
  gridToWorld,
  isSameTile,
  moveUnit,
  setUnit,
  worldToTile,
} from '../game/grid.ts';
import { getTeamUnitIds, isAllyOf, isHostileTo } from '../game/teams.ts';
import { advanceDialog, createDialog, DIALOG_CHARS_PER_SECOND, getCurrentLine } from '../game/dialog.ts';
import { getTriggeredDialog, turnTrigger } from '../game/dialogScript.ts';
import { DEFAULT_OBJECTIVE, describeObjective, type Objective } from '../game/objectives.ts';
import { getPathFacings } from '../game/facing.ts';
import { createKeyRepeat, updateKeyRepeat } from '../game/keyRepeat.ts';
import { getArrowPieces } from '../game/moveArrow.ts';
import { getQuarterFrameMap, getTileFrame, type Autotile } from '../game/autotile.ts';
import { getBuildingSprites, getFeatureSprites, getWallAutotile, type MapSprite } from '../game/mapArt.ts';
import { canMoveAlongPath, extendMovePath, getMovementRange } from '../game/movement.ts';
import { getDangerZone } from '../game/dangerZone.ts';
import { PAUSE_ACTIONS } from '../game/pauseMenu.ts';
import {
  createTurnState,
  getBattleOutcome,
  isDone,
  isPhaseOver,
  markDone,
  markMoved,
  nextPhase,
  unmarkMoved,
} from '../game/turns.ts';
import {
  ARROW_TILES,
  BUILDING_ART,
  BUILDING_PALETTES,
  CURSOR_ANIMATION,
  DEFAULT_BUILDING_PALETTE,
  FOREST_ART,
  MOUNTAIN_ART,
  STRUCTURE_SPRITES,
  TERRAIN_AUTOTILES,
  TERRAIN_BASE_TILE,
  TERRAIN_SHEET,
  TILE_SIZE,
  TREE_SPRITES,
  UNIT_ANIMATIONS,
  UNIT_SHEET,
  getUnitSprite,
  unitSheetKey,
} from '../game/tileset.ts';
import { POTION_COLORS, playHitFlash, playLunge, playPotionGlow, playStoneThrow } from './effects.ts';
import { addTreeShadow, addUnitShadow } from './unitShadow.ts';
import type { Menu } from '../game/actionMenu.ts';
import type { Dialog, DialogLine } from '../game/dialog.ts';
import type { DialogScripts } from '../game/dialogScript.ts';
import type { Grid, Point } from '../game/grid.ts';
import type { Direction, KeyRepeatState, Step } from '../game/keyRepeat.ts';
import type { MovementOptions, RangeTile } from '../game/movement.ts';
import type { CombatSide, Strike, TargetTile } from '../game/combat.ts';
import type { StructurePlacement, TreePlacement } from '../game/demoLevel.ts';
import type { Facing } from '../game/facing.ts';
import type { UnitAnimation } from '../game/tileset.ts';
import type { PopupKind } from '../bridge/views.ts';
import type { Skill } from '../game/skills.ts';
import type { BattleOutcome, Team, TurnState } from '../game/turns.ts';
import type { Unit } from '../game/Unit.ts';
import type { ItemAction } from '../game/items.ts';
import type { SkillAction } from '../game/skills.ts';
import type { RosterMenuEntry } from '../bridge/gameStore.ts';

// The canvas is sized by the page (see main.ts); maps are zoomed to fit it,
// up to MAX_ZOOM, and centered.
const MAX_ZOOM = 2;
const MOVE_RANGE_COLOR = 0x3b82f6;
const MOVE_RANGE_ALPHA = 0.45;
const ATTACK_RANGE_COLOR = 0xef4444;
const ATTACK_RANGE_ALPHA = 0.45;
const SKILL_RANGE_COLOR = 0xf97316;
const SKILL_RANGE_ALPHA = 0.45;
const HEAL_RANGE_COLOR = 0x22c55e;
const HEAL_RANGE_ALPHA = 0.45;
// The enemy danger zone: darker than an attack range, and fainter, since it
// sits under every other highlight.
const DANGER_ZONE_COLOR = 0x9f1239;
const DANGER_ZONE_ALPHA = 0.35;
const DEPLOYMENT_ZONE_COLOR = 0xfacc15;
const DEPLOYMENT_ZONE_ALPHA = 0.4;
// Deployment menu entries, by index, for re-opening it on a given one.
const PLACE_UNITS_INDEX = 0;
const START_INDEX = 1;
// How long a walking unit takes to glide from one tile to the next.
const MOVE_STEP_MS = 140;
// How long a damage number stays on screen (the React HUD animates it).
const DAMAGE_POPUP_DURATION_MS = 700;
// How long a missed strike holds before the next one (about a hit flash).
const MISS_PAUSE_MS = 420;
// Camera shake on a crit.
const CRIT_SHAKE_MS = 160;
const CRIT_SHAKE_INTENSITY = 0.006;
// How long the "Player Phase" / "Enemy Phase" banner holds the screen.
const PHASE_BANNER_DURATION_MS = 1200;
// Pauses in the enemy phase: on each enemy before it moves, and between enemies.
const ENEMY_FOCUS_DELAY_MS = 250;
const ENEMY_ACTION_DELAY_MS = 300;
// How long a player unit's XP bar shows after combat (the React HUD fills it).
const EXPERIENCE_BAR_MS = 1100;
// How long each level-up panel holds the screen.
const LEVEL_UP_MS = 2400;
// Tint for units that are done for the phase.
const DONE_TINT = 0x808080;

type Sprite = Phaser.GameObjects.Sprite;
type ActionKey = 'confirm' | 'confirmAlt' | 'cancel' | 'cancelAlt' | 'dangerZone';
type RangeMode = 'move' | 'attack' | 'skill' | 'heal';

// The unit whose menu or range is open, where it stands, and (after a move)
// where it came from.
interface ActiveUnit extends Point {
  unitId: string;
  unit: Unit;
  origin?: Point;
}

// Pointer input queued for the next update: tile hovers and clicks from
// Phaser, and commands from React.
type PointerInput = Command | ({ type: 'hover-tile' | 'click-tile' } & Point);

export class GridScene extends Phaser.Scene {
  // Battle state, all (re)set in create().
  grid!: Grid;
  units!: Map<string, Unit>;
  roster!: string[];
  // The roster units placed when the battle started, kept after they fall
  // (units drops them), so a Warband run can write the battle back.
  deployedUnits!: Map<string, Unit>;
  deploymentZone!: Point[];
  deploymentLimit!: number;
  dialogs!: DialogScripts;
  objective!: Objective;
  setup!: BattleSetup;
  // The game content this battle was built from (built-in data plus any uploads).
  content!: GameContent;
  nextBattle: BattleSetup | null = null;
  // True when the map is only being looked at (gameStore's screen is
  // 'preview'): see the Preview section.
  preview = false;
  // A unit picked in the preview, and the reach highlights drawn for it.
  previewUnitId: string | null = null;
  onObjectiveDone: (() => void) | null = null;
  // The unit the info screen shows while it's open: see the Unit info section.
  unitInfoUnit: Unit | null = null;
  infoKey!: Phaser.Input.Keyboard.Key;
  keys!: Phaser.Types.Input.Keyboard.CursorKeys;
  arrowRepeat!: KeyRepeatState;
  actionKeys!: Record<ActionKey, Phaser.Input.Keyboard.Key>;
  phase!: BattlePhase;
  actionMenu: Menu | null = null;
  weaponMenu: Menu<WeaponAction> | null = null;
  skillMenu: Menu<SkillAction> | null = null;
  itemMenu: Menu<ItemAction> | null = null;
  deploymentMenu: Menu | null = null;
  rosterMenu: Menu<RosterMenuEntry> | null = null;
  pauseMenu: Menu | null = null;
  placingUnitId: string | null = null;
  zoneTiles: Phaser.GameObjects.Rectangle[] | null = null;
  activeUnit: ActiveUnit | null = null;
  rangeMode: RangeMode | null = null;
  activeSkill: Skill | null = null;
  activeStaff: CarriedStaff | null = null;
  rangeTiles: Phaser.GameObjects.Rectangle[] | null = null;
  dangerZoneVisible = false;
  dangerZoneTiles: Phaser.GameObjects.Rectangle[] = [];
  inspectedEnemyId: string | null = null;
  inspectedTiles: Phaser.GameObjects.Rectangle[] = [];
  moveRange: RangeTile[] | null = null;
  movePath: readonly Point[] | null = null;
  arrowSprites: Sprite[] = [];
  inputLocked = false;
  turnState: TurnState | null = null;
  battleOutcome: BattleOutcome | null = null;
  nextBannerId = 1;
  hoveredUnit: Unit | null = null;
  nextPopupId = 1;
  nextProgressId = 1;
  dialog: Dialog | null = null;
  dialogLineStartedAt = 0;
  onDialogDone: (() => void) | null = null;
  cursorVisibleBeforeDialog = false;
  dialogLineId: number | null = null;
  nextDialogLineId = 1;
  pointerQueue: PointerInput[] = [];
  pointerTile: Point | null = null;
  cursor!: Point;
  cursorSprite!: Sprite;
  unitSprites!: Map<string, Sprite>;

  constructor() {
    super('Grid');
  }

  preload() {
    // Drives the loading screen's bar; the screen lifts at the end of create().
    this.load.on('progress', (progress: number) => gameStore.setState({ mapLoadProgress: progress }));
    // Spritesheets so sprites can draw single frames: the cursor and arrow
    // tiles of the terrain sheet (the tilemaps still use it whole), and each
    // unit sheet's animation frames.
    this.load.spritesheet(TERRAIN_SHEET.key, terrainSheetUrl, { frameWidth: TILE_SIZE, frameHeight: TILE_SIZE });
    for (const [key, url] of Object.entries(SPRITE_URLS)) {
      this.load.spritesheet(key, url, { frameWidth: TILE_SIZE, frameHeight: TILE_SIZE });
    }
  }

  // `setup` is the battle to run (gameStore's battleSetup, see
  // src/game/battleSetup.ts), the first story chapter if there's none.
  create(setup: BattleSetup = FIRST_STORY_CHAPTER) {
    // Every battle starts from a clean slate: clear anything a previous
    // battle left in the store.
    gameStore.setState({ ...BATTLE_STATE_DEFAULTS });

    this.setup = setup;
    this.nextBattle = null; // the BattleSetup a victory leads to, once won
    // Configs uploaded in the config editor replace the built-in ones.
    this.content = getActiveContent();
    const level = createBattleLevel(setup, this.content);
    this.grid = level.grid;
    this.units = level.units; // unitId -> Unit, player roster and enemies alike
    this.roster = level.roster; // player unitIds that can be deployed
    this.deployedUnits = new Map(); // filled in when the battle starts
    this.deploymentZone = level.deploymentZone;
    // How many roster units can be placed: the level's max, capped by roster and zone size.
    this.deploymentLimit = getDeploymentLimit(level.roster, level.deploymentZone, level.maxDeployed);
    this.dialogs = level.dialogs; // the level's conversations by trigger (src/game/dialogScript.ts)
    this.objective = level.objective ?? DEFAULT_OBJECTIVE; // what wins the battle (src/game/objectives.ts)

    const palette = BUILDING_PALETTES[level.palette ?? DEFAULT_BUILDING_PALETTE];
    this.renderTerrain(this.grid, { ...TERRAIN_AUTOTILES, wall: getWallAutotile(palette) });
    this.renderMapSprites([
      ...getFeatureSprites(this.grid, FOREST_ART, MOUNTAIN_ART),
      ...getBuildingSprites(level.buildings ?? [], palette, BUILDING_ART),
    ]);
    this.renderDecorations(level.decorations ?? []);
    this.renderStructures(level.structures ?? []);
    this.renderUnits(this.grid);
    this.createCursor();

    this.fitCamera();
    // The scale manager outlives this scene, so stop listening when it goes.
    this.scale.on(Phaser.Scale.Events.RESIZE, this.fitCamera, this);
    const stopFitting = () => this.scale.off(Phaser.Scale.Events.RESIZE, this.fitCamera, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, stopFitting);
    this.events.once(Phaser.Scenes.Events.DESTROY, stopFitting);

    this.keys = this.input.keyboard!.createCursorKeys();
    this.arrowRepeat = createKeyRepeat(); // held arrow keys step the cursor / menus again (src/game/keyRepeat.ts)
    this.actionKeys = this.input.keyboard!.addKeys({
      confirm: Phaser.Input.Keyboard.KeyCodes.ENTER,
      confirmAlt: Phaser.Input.Keyboard.KeyCodes.Z,
      cancel: Phaser.Input.Keyboard.KeyCodes.ESC,
      cancelAlt: Phaser.Input.Keyboard.KeyCodes.X,
      dangerZone: Phaser.Input.Keyboard.KeyCodes.D,
    }) as Record<ActionKey, Phaser.Input.Keyboard.Key>;
    this.createPointerInput();
    this.infoKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.I); // opens the unit info screen

    this.phase = 'deployment'; // 'deployment' | 'battle'
    this.actionMenu = null;
    this.weaponMenu = null; // the active unit's weapons, opened by choosing Attack
    this.skillMenu = null; // the active unit's skills, opened from the action menu
    this.itemMenu = null; // the active unit's items, opened from the action menu
    this.deploymentMenu = null; // Place Units / Start
    this.rosterMenu = null; // units to pick from when placing
    this.pauseMenu = null; // End Turn / Main Menu / Settings, opened with cancel on the bare map
    this.placingUnitId = null; // unit being placed while choosing its tile
    this.zoneTiles = null; // highlight rectangles for the deployment zone
    this.activeUnit = null; // { unitId, unit, x, y } the menu / range belongs to
    this.rangeMode = null; // 'move' | 'attack' | 'skill' | 'heal' while choosing a destination or target
    this.activeSkill = null; // the skill being aimed while rangeMode is 'skill'
    this.activeStaff = null; // the staff being aimed while rangeMode is 'heal'
    this.rangeTiles = null; // highlight rectangles for the current range
    this.dangerZoneVisible = false; // whether every enemy's reach is shaded (toggled with D or the header button)
    this.dangerZoneTiles = []; // highlight rectangles for the danger zone
    this.inspectedEnemyId = null; // an enemy picked on the bare map to show just its reach
    this.inspectedTiles = []; // highlight rectangles for that enemy's reach
    this.moveRange = null; // [{ x, y, cost }] the active unit can end its move on
    this.movePath = null; // planned route [{ x, y }] from the active unit to the cursor
    this.arrowSprites = []; // arrow pieces drawn along movePath
    this.inputLocked = false; // input is ignored while a move, hit, banner, or the enemy phase plays out
    this.turnState = null; // from src/game/turns.ts once the battle starts
    this.battleOutcome = null; // 'victory' | 'defeat' once the battle is decided
    this.nextBannerId = 1;
    this.hoveredUnit = null;
    this.nextPopupId = 1;
    this.nextProgressId = 1; // changes per XP bar / level-up panel so React restarts their animations
    this.dialog = null; // from src/game/dialog.ts while a conversation is showing
    this.dialogLineStartedAt = 0; // scene time the current line started typing
    this.onDialogDone = null;
    this.cursorVisibleBeforeDialog = false; // restored when the dialog closes
    this.dialogLineId = null; // changes per line so the dialog box restarts its typing
    this.nextDialogLineId = 1;
    this.onObjectiveDone = null; // set while the Objective screen is up
    this.unitInfoUnit = null; // set while the unit info screen is up
    this.previewUnitId = null;
    this.preview = gameStore.getState().screen === 'preview';
    if (this.preview) {
      this.startPreview();
      gameStore.setState({ mapLoadProgress: 1, mapReady: true });
      return;
    }
    this.updateHoveredUnit();
    // Levels with units to place open on deployment; others (e.g. training,
    // where everyone starts on the map) go straight to the battle. Either
    // waits for the level's opening dialog, if it has one, and then the
    // Objective screen.
    const begin = () => {
      if (this.deploymentZone.length > 0) this.startDeployment();
      else this.startBattle();
    };
    this.playTriggeredDialog('opening', () => this.showObjective(begin));
    gameStore.setState({ mapLoadProgress: 1, mapReady: true });
  }

  // Zooms the map to fit the canvas (up to MAX_ZOOM) and centers it. Runs
  // on create and whenever the page resizes the canvas.
  fitCamera() {
    const camera = this.cameras.main;
    camera.setZoom(getFitZoom(this.grid, TILE_SIZE, this.scale.gameSize, MAX_ZOOM));
    camera.centerOn((this.grid.width * TILE_SIZE) / 2, (this.grid.height * TILE_SIZE) / 2);
    // The camera's visible area only updates when it next renders, so move
    // an open unit menu to the refitted map then.
    this.events.once(Phaser.Scenes.Events.RENDER, () => {
      if (this.activeUnit) this.publishMenuAnchor();
      if (this.rangeMode === 'attack') this.updateCombatForecast();
    });
  }

  override update(_time: number, delta: number) {
    const { JustDown } = Phaser.Input.Keyboard;
    const { dx, dy } = this.readArrowKeys(delta);
    const pointer = this.drainPointerInput();
    const confirm = JustDown(this.actionKeys.confirm) || JustDown(this.actionKeys.confirmAlt) || pointer.confirm;
    const cancel = JustDown(this.actionKeys.cancel) || JustDown(this.actionKeys.cancelAlt) || pointer.cancel;
    const info = JustDown(this.infoKey);
    // Only shading, so it toggles even while the enemy phase plays out.
    if (JustDown(this.actionKeys.dangerZone)) this.toggleDangerZone();

    if (this.inputLocked) return;

    if (this.preview) {
      if (this.updateUnitInfo(info, confirm, cancel)) return;
      this.updatePreview(dx, dy, confirm, cancel);
      return;
    }

    // Before the outcome: a victory or defeat conversation plays out before
    // the result is shown.
    if (this.dialog) {
      this.updateDialog(confirm, cancel);
      return;
    }

    if (this.onObjectiveDone) {
      if (confirm || cancel) this.hideObjective();
      return;
    }

    if (this.battleOutcome) {
      if (confirm) this.leaveBattle();
      return;
    }

    if (this.updateUnitInfo(info, confirm, cancel)) return;

    if (this.pauseMenu) {
      this.updatePauseMenu(dy, confirm, cancel);
      return;
    }

    if (this.phase === 'deployment') {
      this.updateDeployment(dx, dy, confirm, cancel);
      return;
    }

    if (this.weaponMenu) {
      this.updateWeaponMenu(dy, confirm, cancel);
      return;
    }

    if (this.skillMenu) {
      this.updateSkillMenu(dy, confirm, cancel);
      return;
    }

    if (this.itemMenu) {
      this.updateItemMenu(dy, confirm, cancel);
      return;
    }

    if (this.actionMenu) {
      this.updateActionMenu(dy, confirm, cancel);
      return;
    }

    if (this.rangeMode) {
      // Confirm acts on the tile under the cursor if it's valid (other
      // tiles are ignored); cancel backs out a step: from moving it lets go
      // of the unit, from aiming it goes back to the menu the aim came from.
      if (confirm) {
        if (this.rangeMode === 'move') this.tryMoveActiveUnit();
        else if (this.rangeMode === 'skill') this.tryUseSkill();
        else if (this.rangeMode === 'heal') this.tryHeal();
        else this.tryAttackWithActiveUnit();
        return;
      }
      if (cancel && this.rangeMode === 'move') {
        this.hideRange();
        this.setCursor(this.activeUnit!.x, this.activeUnit!.y);
        this.activeUnit = null;
        return;
      }
      if (cancel && this.rangeMode === 'attack') {
        // Back out of aiming to the weapon menu the weapon was picked from.
        this.hideRange();
        this.setCursor(this.activeUnit!.x, this.activeUnit!.y);
        this.openWeaponMenu();
        return;
      }
      if (cancel && this.rangeMode === 'skill') {
        // Back out of aiming to the skill menu the skill was picked from.
        this.hideRange();
        this.setCursor(this.activeUnit!.x, this.activeUnit!.y);
        this.openSkillMenu();
        return;
      }
      if (cancel) {
        this.hideRange();
        this.setCursor(this.activeUnit!.x, this.activeUnit!.y);
        this.openActionMenu();
        return;
      }
    } else if (confirm && this.hoveredUnit?.team === 'player') {
      // Units that are done for the phase can't be picked again.
      const unitId = getCell(this.grid, this.cursor.x, this.cursor.y)!.unitId!;
      if (isDone(this.turnState!, unitId)) return;
      this.hideEnemyReach();
      // Selecting a unit goes straight to choosing where it moves; the
      // action menu opens once it has (confirming its own tile stays put).
      this.activeUnit = { unitId, unit: this.hoveredUnit, x: this.cursor.x, y: this.cursor.y };
      this.showMoveRange();
      return;
    } else if (confirm && this.hoveredUnit) {
      this.toggleEnemyReach(getCell(this.grid, this.cursor.x, this.cursor.y)!.unitId!);
      return;
    } else if (cancel && this.inspectedEnemyId) {
      this.hideEnemyReach();
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

  // This frame's arrow-key step as { dx, dy }: one tile or menu entry when
  // a key is pressed, repeating while it's held (src/game/keyRepeat.ts).
  readArrowKeys(delta: number): Step {
    const { JustDown } = Phaser.Input.Keyboard;
    const isDown: Partial<Record<Direction, boolean>> = {};
    const justPressed: Partial<Record<Direction, boolean>> = {};
    for (const key of ['up', 'down', 'left', 'right'] as const) {
      isDown[key] = this.keys[key].isDown;
      justPressed[key] = JustDown(this.keys[key]);
    }
    const { state, step } = updateKeyRepeat(this.arrowRepeat, { isDown, justPressed }, delta);
    this.arrowRepeat = state;
    return step ?? { dx: 0, dy: 0 };
  }

  // While the action menu is open it owns input: up/down move the
  // highlight, confirm picks an action, and cancel takes the move back and
  // returns to choosing where the unit moves.
  updateActionMenu(dy: number, confirm: boolean, cancel: boolean) {
    if (cancel) {
      this.setActionMenu(null);
      this.undoMove();
      this.showMoveRange();
      return;
    }

    if (confirm) {
      const action = getSelectedAction(this.actionMenu!);
      if (action?.disabled) return;
      this.setActionMenu(null);
      if (action?.id === 'attack') {
        this.openWeaponMenu();
      } else if (action?.id === 'heal') {
        this.showHealRange();
      } else if (action?.id === 'skill') {
        this.openSkillMenu();
      } else if (action?.id === 'item') {
        this.openItemMenu();
      } else if (action?.id === 'wait') {
        const { unitId } = this.activeUnit!;
        this.activeUnit = null;
        this.finishPlayerAction(unitId);
      }
      return;
    }

    if (dy !== 0) this.setActionMenu(moveSelection(this.actionMenu!, dy));
  }

  setActionMenu(menu: Menu | null) {
    this.publishMenu('actionMenu', menu);
  }

  // Opens the action menu for the active unit, once it has moved. Attack is
  // only available while it has a weapon it can wield, Skill once it has
  // learned a skill, and Item while it carries any consumables. A unit
  // with a staff also gets Heal, available while a wounded ally is in its
  // reach.
  openActionMenu() {
    const { unit } = this.activeUnit!;
    const hasWeapons = unit.wieldableWeapons.length > 0;
    const hasSkills = getLearnedSkills(unit.unitClass, unit.level).length > 0;
    const hasItems = getConsumables(unit.items).length > 0;
    const canHeal = getStaves(unit.items).length > 0 ? this.findHealingStaff() !== null : undefined;
    this.publishMenuAnchor();
    this.setActionMenu(createActionMenu(getUnitActions({ hasSkills, hasItems, hasWeapons, canHeal })));
  }

  // The wounded allies the active unit's staff reaches from where it stands.
  getHealTargetsFor(staff: Staff) {
    const { unit, unitId, x, y } = this.activeUnit!;
    const canHeal = (otherId: string) => {
      const other = this.units.get(otherId);
      return otherId !== unitId && other?.team === unit.team && isWounded(other);
    };
    return getHealTargets(this.grid, { x, y }, staff, canHeal);
  }

  // The first staff the active unit carries with a wounded ally in reach.
  findHealingStaff() {
    const { unit } = this.activeUnit!;
    return findUsableStaff(unit.items, (staff) => this.getHealTargetsFor(staff).length > 0);
  }

  // After choosing Heal: shows the staff's reach in green to pick the ally.
  showHealRange() {
    const { x, y } = this.activeUnit!;
    const carried = this.findHealingStaff()!;
    const { staff } = carried;
    this.setCursor(x, y);
    this.showRange(
      'heal',
      getAttackRange(this.grid, { x, y }, staff.maxRange, staff.minRange),
      HEAL_RANGE_COLOR,
      HEAL_RANGE_ALPHA,
    );
    this.activeStaff = carried;
  }

  // Opens the weapon menu after Attack: every weapon the active unit can
  // wield, equipped first, greyed out when nothing hostile is in its range
  // from where the unit stands.
  openWeaponMenu() {
    const { unit, x, y } = this.activeUnit!;
    const hasTarget = (weapon: Weapon) => this.getWeaponTargets(unit, { x, y }, weapon).length > 0;
    this.publishMenuAnchor();
    this.publishMenu('weaponMenu', createActionMenu(getWeaponActions(unit.items, unit.weaponTypes, hasTarget)));
  }

  // While the weapon menu is open it owns input: up/down move the
  // highlight, cancel goes back to the action menu, and confirm equips a
  // weapon with something in range and shows that range to aim it (the
  // forecast then uses it).
  updateWeaponMenu(dy: number, confirm: boolean, cancel: boolean) {
    if (cancel) {
      this.publishMenu('weaponMenu', null);
      this.openActionMenu();
      return;
    }

    if (confirm) {
      const action = getSelectedAction(this.weaponMenu!);
      if (!action || action.disabled) return;
      this.publishMenu('weaponMenu', null);
      const { unit, x, y } = this.activeUnit!;
      unit.equip(action.index);
      this.setCursor(x, y);
      this.showAttackRange();
      return;
    }

    if (dy !== 0) this.publishMenu('weaponMenu', moveSelection(this.weaponMenu!, dy));
  }

  openSkillMenu() {
    const { unit } = this.activeUnit!;
    const skills = getLearnedSkills(unit.unitClass, unit.level);
    this.publishMenuAnchor();
    this.publishMenu('skillMenu', createActionMenu(getSkillActions(unit, skills)));
  }

  // While the skill menu is open it owns input: up/down move the
  // highlight, cancel goes back to the action menu, and confirm picks a
  // skill the unit can afford and shows its range to aim it.
  updateSkillMenu(dy: number, confirm: boolean, cancel: boolean) {
    if (cancel) {
      this.publishMenu('skillMenu', null);
      this.openActionMenu();
      return;
    }

    if (confirm) {
      const skill = getSelectedAction(this.skillMenu!);
      if (!skill || skill.disabled) return;
      this.publishMenu('skillMenu', null);
      const { unit, x, y } = this.activeUnit!;
      this.activeSkill = findLearnedSkill(unit.unitClass, unit.level, skill.id);
      this.setCursor(x, y);
      this.showRange(
        'skill',
        getAttackRange(this.grid, { x, y }, this.activeSkill!.range),
        SKILL_RANGE_COLOR,
        SKILL_RANGE_ALPHA,
      );
      return;
    }

    if (dy !== 0) this.publishMenu('skillMenu', moveSelection(this.skillMenu!, dy));
  }

  openItemMenu() {
    const { unit } = this.activeUnit!;
    this.publishMenuAnchor();
    this.publishMenu('itemMenu', createActionMenu(getItemActions(unit, unit.items)));
  }

  // While the item menu is open it owns input: up/down move the highlight,
  // cancel goes back to the action menu, and confirm uses an item that
  // would restore something. Items are used on the unit itself, so there's
  // no range to aim.
  updateItemMenu(dy: number, confirm: boolean, cancel: boolean) {
    if (cancel) {
      this.publishMenu('itemMenu', null);
      this.openActionMenu();
      return;
    }

    if (confirm) {
      const item = getSelectedAction(this.itemMenu!);
      if (!item || item.disabled) return;
      this.publishMenu('itemMenu', null);
      this.useItem(item.id);
      return;
    }

    if (dy !== 0) this.publishMenu('itemMenu', moveSelection(this.itemMenu!, dy));
  }

  // Publishes where the active unit's tile shows on the canvas, so React
  // opens its menus (action, skill, item) beside it.
  publishMenuAnchor() {
    const { x, y } = this.activeUnit!;
    gameStore.setState({ menuAnchor: this.getTileAnchor({ x, y }) });
  }

  // Where a map tile shows on the canvas right now (see toTileAnchorView).
  getTileAnchor(tile: Point) {
    const { worldView, zoom } = this.cameras.main;
    const camera = { x: worldView.x, y: worldView.y, zoom };
    return toTileAnchorView(tile, TILE_SIZE, camera, this.scale.gameSize);
  }

  // Keeps a menu on the scene and mirrors it to the store field of the same
  // name (actionMenu, skillMenu, itemMenu, deploymentMenu, rosterMenu) for
  // React to draw.
  publishMenu<K extends MenuField>(key: K, menu: BattleState[K]) {
    const menus = this as unknown as Pick<BattleState, MenuField>;
    if (menu === menus[key]) return;
    menus[key] = menu;
    gameStore.setState({ [key]: menu } as Partial<GameState>);
  }

  // While the pause menu is open it owns input: cancel closes it, End Turn
  // hands over to the enemy phase, Main Menu leaves the battle for the
  // title screen. Settings isn't built yet.
  updatePauseMenu(dy: number, confirm: boolean, cancel: boolean) {
    if (cancel) {
      this.publishMenu('pauseMenu', null);
      return;
    }

    if (confirm) {
      const action = getSelectedAction(this.pauseMenu!);
      if (action?.id === 'end-turn') this.endPlayerPhase();
      else if (action?.id === 'main-menu') this.exitToTitle();
      else console.info(`Pause action selected: ${action?.id}`);
      return;
    }

    if (dy !== 0) this.publishMenu('pauseMenu', moveSelection(this.pauseMenu!, dy));
  }

  // After the result: on to the next battle if the victory leads to one,
  // else back to the title. Moving on swaps in the next setup, which makes
  // main.ts restart this scene with it; create() (re)sets every piece of
  // battle state.
  leaveBattle() {
    if (!this.nextBattle) {
      this.exitToTitle();
      return;
    }
    this.inputLocked = true;
    gameStore.setState({ ...BATTLE_STATE_DEFAULTS, battleSetup: this.nextBattle });
  }

  // Clears the battle's UI state and switches to the title screen, which
  // makes main.ts remove this scene. The next battle starts fresh.
  exitToTitle() {
    this.inputLocked = true;
    gameStore.setState({ ...BATTLE_STATE_DEFAULTS, screen: 'title', battleSetup: null });
  }

  // ---- Objective --------------------------------------------------------
  // Before the battle (after the opening dialog) React shows what wins and
  // loses it; confirm or cancel dismisses it and the level carries on.

  showObjective(onDone: () => void) {
    this.onObjectiveDone = onDone;
    gameStore.setState({
      objective: toObjectiveView(describeBattle(this.setup, this.content), describeObjective(this.objective)),
    });
  }

  hideObjective() {
    const onDone = this.onObjectiveDone;
    this.onObjectiveDone = null;
    gameStore.setState({ objective: null });
    onDone?.();
  }

  // ---- Unit info --------------------------------------------------------
  // Pressing I with the cursor on a unit, whenever the cursor is free to
  // roam, opens React's full stat sheet for it (src/ui/UnitInfoScreen.tsx).
  // It owns input while open, and I, confirm or cancel closes it.

  // Returns true when the unit info screen took this frame's input.
  updateUnitInfo(info: boolean, confirm: boolean, cancel: boolean): boolean {
    if (this.unitInfoUnit) {
      if (info || confirm || cancel) this.hideUnitInfo();
      return true;
    }
    if (info && this.hoveredUnit && this.canRoamCursor()) {
      this.showUnitInfo(this.hoveredUnit);
      return true;
    }
    return false;
  }

  showUnitInfo(unit: Unit) {
    this.unitInfoUnit = unit;
    gameStore.setState({ unitInfo: toUnitDetailView(unit) });
  }

  hideUnitInfo() {
    this.unitInfoUnit = null;
    gameStore.setState({ unitInfo: null });
  }

  // ---- Preview ----------------------------------------------------------
  // The config editor shows a map as it would play (screen 'preview'):
  // terrain, buildings, enemies and the deployment zone, but no dialog,
  // Objective screen, deployment or turns. The cursor roams so the unit
  // panel can show whoever it's over; confirm on a unit shows how far it
  // reaches (or hides that again), and cancel hides it, or else leaves for
  // the title, which sends the editor back to the page the preview came from.

  startPreview() {
    this.drawTileHighlights(this.deploymentZone, DEPLOYMENT_ZONE_COLOR, DEPLOYMENT_ZONE_ALPHA);
    const [start] = this.deploymentZone;
    if (start) this.setCursor(start.x, start.y);
    this.updateHoveredUnit();
  }

  updatePreview(dx: number, dy: number, confirm: boolean, cancel: boolean) {
    if (cancel) {
      if (this.previewUnitId) this.hidePreviewReach();
      else this.exitToTitle();
      return;
    }
    if (confirm) {
      const unitId = getCell(this.grid, this.cursor.x, this.cursor.y)?.unitId ?? null;
      const picked = this.previewUnitId;
      this.hidePreviewReach();
      if (unitId && unitId !== picked) {
        this.previewUnitId = unitId;
        this.rangeTiles = this.drawUnitReach(this.units.get(unitId)!, this.cursor).tiles;
      }
      return;
    }
    if (dx !== 0 || dy !== 0) this.setCursor(this.cursor.x + dx, this.cursor.y + dy);
  }

  hidePreviewReach() {
    for (const tile of this.rangeTiles ?? []) tile.destroy();
    this.rangeTiles = null;
    this.previewUnitId = null;
  }

  // ---- Dialog -----------------------------------------------------------
  // A conversation in the dialog box (drawn by React) owns input while it
  // shows: confirm finishes typing the line, or moves to the next one;
  // cancel skips the rest. The rules live in src/game/dialog.ts. The cursor
  // hides while it shows and comes back as it was; `onDone` runs once the
  // dialog closes.

  playDialog(lines: readonly DialogLine[], onDone: () => void) {
    this.onDialogDone = onDone;
    this.cursorVisibleBeforeDialog = this.cursorSprite.visible;
    this.setCursorVisible(false);
    this.showDialog(createDialog(lines));
  }

  // Plays the level's conversation for `trigger` ('opening', 'victory',
  // 'defeat', 'turn N') if it has one, then runs `onDone` — right away when
  // there's nothing to say.
  playTriggeredDialog(trigger: string, onDone: () => void) {
    const lines = getTriggeredDialog(this.dialogs, trigger);
    if (lines) this.playDialog(lines, onDone);
    else onDone();
  }

  showDialog(dialog: Dialog) {
    if (dialog.index !== this.dialog?.index) {
      this.dialogLineStartedAt = this.time.now;
      this.dialogLineId = this.nextDialogLineId++;
    }
    this.dialog = dialog;
    const { unitClass } = getCurrentLine(dialog);
    const view = toDialogView({
      id: this.dialogLineId!,
      dialog,
      sprite: unitClass ? getUnitSprite(unitClass) : null,
      charsPerSecond: DIALOG_CHARS_PER_SECOND,
    });
    gameStore.setState({ dialog: view });
  }

  updateDialog(confirm: boolean, cancel: boolean) {
    if (cancel) {
      this.endDialog();
      return;
    }
    if (!confirm) return;
    const next = advanceDialog(this.dialog!, this.time.now - this.dialogLineStartedAt);
    if (next) this.showDialog(next);
    else this.endDialog();
  }

  endDialog() {
    this.dialog = null;
    gameStore.setState({ dialog: null });
    this.setCursorVisible(this.cursorVisibleBeforeDialog);
    const onDone = this.onDialogDone;
    this.onDialogDone = null;
    onDone?.();
  }

  // ---- Deployment phase -------------------------------------------------
  // Before the battle, the player picks units from the roster and places
  // them on the deployment zone. Three steps, each owning input in turn:
  //   'menu'    — Place Units / Start
  //   'roster'  — pick the unit to place
  //   'placing' — move the cursor and confirm a zone tile
  // The rules (valid tiles, when Start is allowed) live in
  // src/game/deployment.ts; this only drives input and rendering.

  startDeployment() {
    this.phase = 'deployment';
    gameStore.setState({ phase: 'deployment', deploymentLimit: this.deploymentLimit });
    this.zoneTiles = this.drawTileHighlights(this.deploymentZone, DEPLOYMENT_ZONE_COLOR, DEPLOYMENT_ZONE_ALPHA);
    // The cursor stays hidden while a deployment menu has input; it only
    // appears once there's a tile to choose.
    this.setCursorVisible(false);
    this.openDeploymentMenu(PLACE_UNITS_INDEX);
  }

  setDeploymentStep(step: DeploymentStep | null) {
    gameStore.setState({ deploymentStep: step });
  }

  updateDeployment(dx: number, dy: number, confirm: boolean, cancel: boolean) {
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
  openDeploymentMenu(selectedIndex: number) {
    const actions = getDeploymentActions({ canStart: canStartBattle(this.grid, this.roster) });
    this.publishMenu('deploymentMenu', selectIndex(createActionMenu(actions), selectedIndex));
    this.setDeploymentStep('menu');
  }

  updateDeploymentMenu(dy: number, confirm: boolean) {
    if (confirm) {
      const action = getSelectedAction(this.deploymentMenu!);
      if (action?.id === 'place-units') {
        this.publishMenu('deploymentMenu', null);
        this.openRosterMenu();
      } else if (action?.id === 'start' && !action.disabled) {
        this.startBattle();
      }
      return;
    }

    if (dy !== 0) this.publishMenu('deploymentMenu', moveSelection(this.deploymentMenu!, dy));
  }

  openRosterMenu() {
    const entries = this.roster.map((id) => {
      const unit = this.units.get(id)!;
      return toRosterEntryView({
        id,
        unit,
        sprite: getUnitSprite(unit.unitClass),
        placed: isPlaced(this.grid, id),
        disabled: !canDeployUnit(this.grid, this.roster, this.deploymentLimit, id),
      });
    });
    this.publishMenu('rosterMenu', createActionMenu(entries));
    this.setDeploymentStep('roster');
  }

  updateRosterMenu(dy: number, confirm: boolean, cancel: boolean) {
    if (cancel) {
      this.publishMenu('rosterMenu', null);
      this.openDeploymentMenu(PLACE_UNITS_INDEX);
      return;
    }

    if (confirm) {
      const entry = getSelectedAction(this.rosterMenu!);
      // Every slot is taken: only units already on the map can be moved.
      if (!entry || entry.disabled) return;
      this.publishMenu('rosterMenu', null);
      this.beginPlacing(entry.id);
      return;
    }

    if (dy !== 0) this.publishMenu('rosterMenu', moveSelection(this.rosterMenu!, dy));
  }

  // Starts the cursor where the unit already stands, or on the first open
  // zone tile if it hasn't been placed yet.
  beginPlacing(unitId: string) {
    this.placingUnitId = unitId;
    const tile =
      findUnit(this.grid, unitId) ?? getFirstOpenTile(this.grid, this.deploymentZone) ?? this.deploymentZone[0];
    this.setCursor(tile.x, tile.y);
    this.setCursorVisible(true);
    this.setDeploymentStep('placing');
  }

  tryPlaceUnit() {
    const unitId = this.placingUnitId!;
    const { x, y } = this.cursor;
    if (!canPlaceUnit(this.grid, this.deploymentZone, unitId, x, y)) return;

    this.grid = placeUnit(this.grid, this.deploymentZone, unitId, x, y);
    this.refreshDangerZone();
    const sprite = this.unitSprites.get(unitId);
    if (sprite) {
      const pos = gridToWorld(x, y, TILE_SIZE);
      sprite.setPosition(pos.x, pos.y);
    } else {
      this.addUnitSprite(unitId, x, y);
    }

    this.placingUnitId = null;
    this.setCursorVisible(false);
    // Only jump to Start once every slot is filled; until then, stay on
    // Place Units so the next unit is one confirm away.
    const complete = isDeploymentComplete(this.grid, this.roster, this.deploymentLimit);
    this.openDeploymentMenu(complete ? START_INDEX : PLACE_UNITS_INDEX);
  }

  // Ends deployment: clears the zone, drops roster units left off the map
  // (they sit this battle out), and starts turn 1.
  startBattle() {
    for (const tile of this.zoneTiles ?? []) tile.destroy();
    this.zoneTiles = null;
    this.publishMenu('deploymentMenu', null);
    this.phase = 'battle';
    gameStore.setState({ phase: 'battle', deploymentStep: null, deploymentLimit: null });

    for (const unitId of this.roster) {
      if (isPlaced(this.grid, unitId)) this.deployedUnits.set(unitId, this.units.get(unitId)!);
      else this.units.delete(unitId);
    }

    this.setCursorVisible(true);
    this.startPhase(createTurnState());
  }

  // ---- Turns ------------------------------------------------------------
  // The battle alternates a player phase and an enemy phase (rules in
  // src/game/turns.ts). In the player phase each unit may move, then act
  // (attack, skill, or wait); acting finishes it and greys it out. Once all
  // are finished the enemy phase runs on its own, each enemy acting in turn
  // with the plan from src/game/enemyAI.ts. After every action the battle
  // checks for victory or defeat.

  // Announces the phase with a banner (input locked meanwhile), then either
  // hands input to the player or runs the enemies.
  startPhase(turnState: TurnState) {
    this.turnState = turnState;
    this.hideEnemyReach();
    for (const sprite of this.unitSprites.values()) sprite.clearTint();
    gameStore.setState({ turn: toTurnView(turnState) });

    this.inputLocked = true;
    this.showPhaseBanner(turnState, () => {
      if (turnState.team === 'enemy') {
        this.runEnemyPhase();
        return;
      }
      // Hand the cursor back to the player on their first unit, after the
      // turn's conversation if the level has one.
      const first = findUnit(this.grid, this.teamUnitIds('player')[0]);
      if (first) this.setCursor(first.x, first.y);
      this.inputLocked = false;
      this.playTriggeredDialog(turnTrigger(turnState.turn), () => {});
    });
  }

  showPhaseBanner(turnState: TurnState, onDone: () => void) {
    const banner = toPhaseBannerView({
      id: this.nextBannerId++,
      turnState,
      durationMs: PHASE_BANNER_DURATION_MS,
    });
    gameStore.setState({ phaseBanner: banner });
    this.time.delayedCall(PHASE_BANNER_DURATION_MS, () => {
      gameStore.setState({ phaseBanner: null });
      onDone();
    });
  }

  // Marks a unit done for the phase and greys out its sprite.
  finishUnit(unitId: string) {
    this.turnState = markDone(this.turnState!, unitId);
    this.unitSprites.get(unitId)?.setTint(DONE_TINT);
    this.refreshDangerZone();
  }

  // Called once a player unit's action has fully played out: finishes the
  // unit, then ends the battle or the phase if that action decided it.
  finishPlayerAction(unitId: string) {
    this.finishUnit(unitId);
    this.inputLocked = false;
    this.updateHoveredUnit();
    if (this.checkOutcome()) return;
    if (isPhaseOver(this.turnState!, this.teamUnitIds('player'))) {
      this.startPhase(nextPhase(this.turnState!));
    }
  }

  // Ends the player phase early from the pause menu: any units that haven't
  // acted simply forfeit their action, and the enemy phase begins.
  endPlayerPhase() {
    this.publishMenu('pauseMenu', null);
    this.startPhase(nextPhase(this.turnState!));
  }

  teamUnitIds(team: Team): string[] {
    return getTeamUnitIds(this.units, team);
  }

  // Ends the battle if one side has been wiped out, publishing the result
  // for React; confirm then returns to the title. Returns whether it ended.
  // The level's [victory] or [defeat] conversation plays before the result.
  checkOutcome() {
    const outcome = getBattleOutcome(this.units.values());
    if (!outcome) return false;
    this.battleOutcome = outcome;
    this.inputLocked = false;
    this.setCursorVisible(false);
    // Completing the objective moves on to the next chapter or stage.
    let runOver: RunOverView | null = null;
    if (this.setup.mode === 'warband' && this.setup.run) {
      // A run writes the battle back to its roster and saves the next
      // stage, or forgets the run once the warband has fallen.
      const finished = finishStage(this.setup.run, { units: this.deployedUnits }, outcome);
      if (finished.over) {
        clearSavedRun();
        runOver = toRunOverView(finished.run);
      } else {
        saveRun(finished.run);
      }
      this.nextBattle = finished.over ? null : runStage(finished.run);
    } else {
      this.nextBattle = outcome === 'victory' ? getNextBattle(this.setup, randomSeed()) : null;
    }
    const nextBattle = this.nextBattle && describeBattle(this.nextBattle, this.content);
    this.playTriggeredDialog(outcome, () => gameStore.setState({ battleOutcome: outcome, nextBattle, runOver }));
    return true;
  }

  // Each enemy (in registry order) plans and carries out its action, one
  // after another, then the player phase begins.
  runEnemyPhase() {
    const queue = this.teamUnitIds('enemy');
    const next = () => {
      if (this.checkOutcome()) return;
      const unitId = queue.shift();
      if (!unitId) {
        this.startPhase(nextPhase(this.turnState!));
        return;
      }
      this.takeEnemyAction(unitId, () => this.time.delayedCall(ENEMY_ACTION_DELAY_MS, next));
    };
    next();
  }

  // Puts the cursor on the enemy, walks it along its planned route, and
  // attacks the planned target from the end of it.
  takeEnemyAction(unitId: string, onDone: () => void) {
    const unit = this.units.get(unitId)!;
    const from = findUnit(this.grid, unitId)!;
    const scoreTarget = createAttackScorer(unit, (id) => this.units.get(id)!);
    const { path, target } = planRushAction(
      this.grid,
      from,
      unit,
      this.isHostileTo(unit),
      this.movementOptions(unit),
      scoreTarget,
    );
    const to = path[path.length - 1];
    const finish = () => {
      this.finishUnit(unitId);
      onDone();
    };

    this.setCursor(from.x, from.y);
    this.time.delayedCall(ENEMY_FOCUS_DELAY_MS, () => {
      this.walkSprite(this.unitSprites.get(unitId)!, path, () => {
        this.grid = moveUnit(this.grid, from, to);
        this.setCursor(to.x, to.y);
        if (target) this.resolveAttack(unitId, target, finish);
        else finish();
      });
    });
  }

  // Options for src/game/movement.ts: allies can be walked through, anyone
  // else blocks.
  movementOptions(unit: Unit): MovementOptions {
    return {
      canPassThrough: (unitId: string) => isAllyOf(this.units, unit.team, unitId),
    };
  }

  // Units on another team are fair game to attack.
  isHostileTo(unit: Unit) {
    return (unitId: string) => isHostileTo(this.units, unit.team, unitId);
  }

  // Highlights every tile the active unit can reach in blue, and the tiles
  // it could attack from there in red around them, and starts the planned
  // route at the unit. The ranges come from src/game/movement.ts and
  // src/game/combat.ts; this only draws them.
  showMoveRange() {
    const { unit, x, y } = this.activeUnit!;
    const { moveRange, tiles } = this.drawUnitReach(unit, { x, y });
    this.moveRange = moveRange;
    this.movePath = [{ x, y }];
    this.rangeMode = 'move';
    this.rangeTiles = tiles;
  }

  // Draws where `unit` standing at `from` can move (blue) and what it could
  // attack from there (red). Returns the move range and the highlights.
  drawUnitReach(unit: Unit, from: Point) {
    const moveRange = getMovementRange(this.grid, from, unit.movement, this.movementOptions(unit));
    const tiles = this.drawTileHighlights(moveRange, MOVE_RANGE_COLOR, MOVE_RANGE_ALPHA);
    const reach = getWeaponReach(unit.wieldableWeapons.map(({ weapon }) => weapon));
    if (reach) {
      const threat = getThreatRange(this.grid, moveRange, reach.maxRange, reach.minRange);
      tiles.push(...this.drawTileHighlights(threat, ATTACK_RANGE_COLOR, ATTACK_RANGE_ALPHA));
    }
    return { moveRange, tiles };
  }

  // Follows the cursor with the planned route (extendMovePath keeps the
  // way the player traced it where it can) and redraws the arrow along it.
  updateMovePath() {
    const { unit } = this.activeUnit!;
    const path = extendMovePath(this.grid, this.movePath!, this.cursor, unit.movement, this.movementOptions(unit));
    if (path === this.movePath) return;
    this.movePath = path;
    this.drawMoveArrow(path);
  }

  // Draws the arrow pieces from src/game/moveArrow.ts above the range
  // highlight and below units.
  drawMoveArrow(path: readonly Point[]) {
    this.clearMoveArrow();
    this.arrowSprites = getArrowPieces(path).map(({ x, y, piece }) => {
      const pos = gridToWorld(x, y, TILE_SIZE);
      const frame = getTileFrame(ARROW_TILES[piece], TERRAIN_SHEET.columns);
      return this.add.sprite(pos.x, pos.y, TERRAIN_SHEET.key, frame).setOrigin(0, 0).setDepth(0.6);
    });
  }

  clearMoveArrow() {
    for (const sprite of this.arrowSprites) sprite.destroy();
    this.arrowSprites = [];
  }

  // Highlights every tile the active unit's equipped weapon can strike,
  // from src/game/combat.ts, and puts the cursor on the first hostile unit
  // in range so its combat forecast shows straight away. Only tiles holding
  // a hostile unit accept confirm.
  showAttackRange() {
    const { unit, x, y } = this.activeUnit!;
    const weapon = unit.weapon!;
    const range = getAttackRange(this.grid, { x, y }, weapon.maxRange, weapon.minRange);
    this.showRange('attack', range, ATTACK_RANGE_COLOR, ATTACK_RANGE_ALPHA);
    const [first] = this.getWeaponTargets(unit, { x, y }, weapon);
    if (first) this.setCursor(first.x, first.y);
    else this.updateCombatForecast();
  }

  // The hostile units `weapon` reaches from `from`, as [{ x, y, unitId }].
  getWeaponTargets(unit: Unit, from: Point, weapon: Weapon) {
    return getAttackTargets(this.grid, from, weapon.maxRange, this.isHostileTo(unit), weapon.minRange);
  }

  // The hostile unit under the cursor that the active unit can attack with
  // its equipped weapon from where it stands, as { x, y, unitId }, or null.
  getAttackTargetUnderCursor() {
    const { unit, x, y } = this.activeUnit!;
    if (!unit.weapon) return null;
    const targets = this.getWeaponTargets(unit, { x, y }, unit.weapon);
    return findTileAt(targets, this.cursor);
  }

  // While aiming an attack, publishes the combat forecast
  // (getCombatForecast in src/game/combat.ts) against the target under the
  // cursor, anchored beside both units for React's CombatForecast to draw;
  // clears it whenever there's no target to forecast.
  updateCombatForecast() {
    const target = this.rangeMode === 'attack' ? this.getAttackTargetUnderCursor() : null;
    if (!target) {
      gameStore.setState({ combatForecast: null });
      return;
    }
    const { unit, x, y } = this.activeUnit!;
    const defender = this.units.get(target.unitId)!;
    const distance = getDistance({ x, y }, target);
    const forecast = getCombatForecast(unit, defender, { distance });
    const anchor = mergeTileAnchors(this.getTileAnchor({ x, y }), this.getTileAnchor(target));
    gameStore.setState({ combatForecast: toCombatForecastView({ forecast, attacker: unit, defender, anchor }) });
  }

  showRange(mode: RangeMode, tiles: readonly Point[], color: number, alpha: number) {
    this.rangeMode = mode;
    this.rangeTiles = this.drawTileHighlights(tiles, color, alpha);
  }

  // Draws a translucent square over each tile, under units and the cursor.
  // Returns the rectangles so the caller can destroy them later.
  drawTileHighlights(tiles: readonly Point[], color: number, alpha: number) {
    return tiles.map((tile) => {
      const pos = gridToWorld(tile.x, tile.y, TILE_SIZE);
      return this.add.rectangle(pos.x, pos.y, TILE_SIZE, TILE_SIZE, color, alpha).setOrigin(0, 0).setDepth(0.5);
    });
  }

  hideRange() {
    for (const tile of this.rangeTiles ?? []) tile.destroy();
    this.rangeTiles = null;
    this.rangeMode = null;
    this.activeSkill = null;
    this.activeStaff = null;
    this.updateCombatForecast();
    this.clearMoveArrow();
    this.moveRange = null;
    this.movePath = null;
  }

  // ---- Danger zone ------------------------------------------------------
  // Shades every tile some enemy could strike next phase
  // (src/game/dangerZone.ts), under every other highlight, while toggled
  // on. It's redrawn whenever a unit finishes acting, falls, or is placed,
  // since any of those can change who reaches where. Separately, picking
  // an enemy on the bare map shows just that enemy's reach.

  toggleDangerZone() {
    if (this.preview || this.battleOutcome) return;
    this.dangerZoneVisible = !this.dangerZoneVisible;
    gameStore.setState({ dangerZoneVisible: this.dangerZoneVisible });
    this.refreshDangerZone();
  }

  refreshDangerZone() {
    for (const tile of this.dangerZoneTiles) tile.destroy();
    this.dangerZoneTiles = [];
    if (!this.dangerZoneVisible) return;

    const sources = this.teamUnitIds('enemy').flatMap((unitId) => {
      const unit = this.units.get(unitId)!;
      const origin = findUnit(this.grid, unitId);
      if (!origin) return [];
      const ranges = unit.wieldableWeapons.map(({ weapon }) => weapon);
      return [{ origin, movement: unit.movement, ranges, options: this.movementOptions(unit) }];
    });
    this.dangerZoneTiles = this.drawTileHighlights(
      getDangerZone(this.grid, sources),
      DANGER_ZONE_COLOR,
      DANGER_ZONE_ALPHA,
    );
    for (const tile of this.dangerZoneTiles) tile.setDepth(0.45);
  }

  // Shows where the enemy `unitId` can move and strike, or hides it again
  // if it's the one already shown.
  toggleEnemyReach(unitId: string) {
    const picked = this.inspectedEnemyId;
    this.hideEnemyReach();
    if (unitId === picked) return;
    this.inspectedEnemyId = unitId;
    this.inspectedTiles = this.drawUnitReach(this.units.get(unitId)!, this.cursor).tiles;
  }

  hideEnemyReach() {
    for (const tile of this.inspectedTiles) tile.destroy();
    this.inspectedTiles = [];
    this.inspectedEnemyId = null;
  }

  // Moves the active unit to the tile under the cursor, if that tile is in
  // its range. It walks the planned route the arrow shows, tile by tile;
  // confirming the unit's own tile keeps it there. Either way the action
  // menu opens next.
  tryMoveActiveUnit() {
    const { unitId, x, y } = this.activeUnit!;
    const from = { x, y };
    const to = { x: this.cursor.x, y: this.cursor.y };
    const path = this.movePath!;
    if (!canMoveAlongPath(this.moveRange!, path, to)) return;

    this.hideRange();
    this.inputLocked = true;
    this.walkSprite(this.unitSprites.get(unitId)!, path, () => {
      this.grid = moveUnit(this.grid, from, to);
      this.turnState = markMoved(this.turnState!, unitId);
      // Remember where it came from so cancelling the menu can undo the move.
      this.activeUnit = { ...this.activeUnit!, x: to.x, y: to.y, origin: from };
      this.inputLocked = false;
      this.setCursor(to.x, to.y);
      // Straight on to the rest of the unit's action, with Move now used up.
      this.openActionMenu();
    });
  }

  // Puts the active unit back where it stood before its move this phase
  // and gives it the move back.
  undoMove() {
    const { unitId, unit, x, y, origin } = this.activeUnit!;
    this.grid = moveUnit(this.grid, { x, y }, origin!);
    this.turnState = unmarkMoved(this.turnState!, unitId);
    const pos = gridToWorld(origin!.x, origin!.y, TILE_SIZE);
    this.unitSprites.get(unitId)!.setPosition(pos.x, pos.y);
    this.activeUnit = { unitId, unit, x: origin!.x, y: origin!.y };
    this.setCursor(origin!.x, origin!.y);
  }

  // Attacks the unit under the cursor, if it's a hostile unit in range.
  tryAttackWithActiveUnit() {
    const { unitId } = this.activeUnit!;
    const target = this.getAttackTargetUnderCursor();
    if (!target) return;

    this.hideRange();
    this.activeUnit = null;
    this.resolveAttack(unitId, target, () => this.finishPlayerAction(unitId));
  }

  // One unit attacks another ({ x, y, unitId } target), for either side.
  // The exchange — the attack, the defender's counter if the attacker is
  // in its range, and a follow-up strike for whoever doubles, each rolled
  // to hit and crit — comes from resolveCombat in src/game/combat.ts and is
  // played strike by strike: each strike spends a use of the striker's
  // weapon ("Broke!" pops up over it if that wears it out), and each hit's
  // damage is applied right away so
  // the HUD shows the new health while the struck sprite flashes and a
  // damage number pops over it (a crit also shakes the camera); a miss just
  // shows "Miss" for a moment. A unit brought to 0 health is removed once
  // its flash finishes, which ends the exchange. Then the player unit in
  // the fight, if it survived, gains XP (see showExperienceGain). Input
  // stays locked until onDone.
  resolveAttack(attackerId: string, target: TargetTile, onDone: () => void) {
    const attacker = this.units.get(attackerId)!;
    const defender = this.units.get(target.unitId)!;
    const attackerTile = findUnit(this.grid, attackerId)!;
    const distance = getDistance(attackerTile, target);
    const { strikes } = resolveCombat(attacker, defender, { distance });
    const sides = {
      attacker: { unit: attacker, tile: { ...attackerTile, unitId: attackerId } },
      defender: { unit: defender, tile: target },
    };

    this.inputLocked = true;
    const playStrike = (index: number) => {
      const strike = strikes[index];
      if (!strike) {
        this.updateHoveredUnit();
        this.awardCombatExperience(sides, strikes, onDone);
        return;
      }
      // Every strike wears the striker's weapon, hit or miss.
      const striker = sides[strike.by];
      if (striker.unit.spendWeaponUse().broke) {
        this.showDamagePopup(this.unitSprites.get(striker.tile.unitId)!, 0, 'broke');
      }
      const struck = sides[strike.target];
      const sprite = this.unitSprites.get(struck.tile.unitId)!;
      if (!strike.hit) {
        this.showDamagePopup(sprite, 0, 'miss');
        this.time.delayedCall(MISS_PAUSE_MS, () => playStrike(index + 1));
        return;
      }
      struck.unit.takeDamage(strike.damage);
      this.publishHoveredUnit();
      this.showDamagePopup(sprite, strike.damage, strike.crit ? 'crit' : 'damage');
      if (strike.crit) this.cameras.main.shake(CRIT_SHAKE_MS, CRIT_SHAKE_INTENSITY);
      playHitFlash(this, sprite, () => {
        if (!struck.unit.isAlive()) this.removeUnit(struck.tile);
        playStrike(index + 1);
      });
    };
    playStrike(0);
  }

  // After an exchange from resolveAttack, gives the player unit in it (only
  // player units gain XP) the XP its outcome earned (src/game/
  // experience.ts), unless it died; then onDone.
  awardCombatExperience(sides: Record<CombatSide, { unit: Unit }>, strikes: readonly Strike[], onDone: () => void) {
    const side = (['attacker', 'defender'] as const).find((s) => sides[s].unit.team === 'player');
    const unit = side && sides[side].unit;
    if (!unit?.isAlive()) {
      onDone();
      return;
    }
    const opponent = sides[side === 'attacker' ? 'defender' : 'attacker'].unit;
    const amount = getCombatExperience(unit.level, opponent.level, getCombatOutcome(strikes, side!));
    this.showExperienceGain(unit, amount, onDone);
  }

  // Gives the unit `amount` XP (Unit.gainExperience rolls any level ups)
  // and shows it: React's XP bar fills for EXPERIENCE_BAR_MS, then one
  // level-up panel per level gained holds for LEVEL_UP_MS each. Calls
  // onDone straight away when there's no XP to give.
  showExperienceGain(unit: Unit, amount: number, onDone: () => void) {
    if (amount <= 0) {
      onDone();
      return;
    }
    const from = { level: unit.level, experience: unit.experience };
    const result = unit.gainExperience(amount);
    const experienceGain = toExperienceGainView({
      id: this.nextProgressId++,
      name: unit.name,
      from,
      result,
      durationMs: EXPERIENCE_BAR_MS,
    });
    gameStore.setState({ experienceGain });

    const showLevelUp = (index: number) => {
      const levelUp = result.levelUps[index];
      if (!levelUp) {
        gameStore.setState({ levelUp: null });
        this.publishHoveredUnit();
        onDone();
        return;
      }
      const view = toLevelUpView({ id: this.nextProgressId++, name: unit.name, levelUp, durationMs: LEVEL_UP_MS });
      gameStore.setState({ levelUp: view });
      this.time.delayedCall(LEVEL_UP_MS, () => showLevelUp(index + 1));
    };
    this.time.delayedCall(EXPERIENCE_BAR_MS, () => {
      gameStore.setState({ experienceGain: null });
      showLevelUp(0);
    });
  }

  // Uses the aimed skill on the unit under the cursor, if it's a hostile
  // unit in the skill's range. Mana is spent and damage from
  // src/game/skills.ts applied right away; then the skill's animation plays
  // (see playSkillAnimation) and a unit brought to 0 health is removed once
  // it finishes.
  tryUseSkill() {
    const { unit, unitId, x, y } = this.activeUnit!;
    const skill = this.activeSkill!;
    const targets = getAttackTargets(this.grid, { x, y }, skill.range, this.isHostileTo(unit));
    const target = findTileAt(targets, this.cursor);
    if (!target) return;

    const defender = this.units.get(target.unitId)!;
    const damage = calculateSkillDamage(skill!, unit, defender);
    unit.spendMana(skill.manaCost);
    defender.takeDamage(damage);

    this.hideRange();
    this.inputLocked = true;
    const userSprite = this.unitSprites.get(unitId)!;
    const defenderSprite = this.unitSprites.get(target.unitId)!;

    // The HUD only shows the new health once the skill lands.
    const onImpact = () => {
      this.publishHoveredUnit();
      this.showDamagePopup(defenderSprite, damage);
    };
    this.playSkillAnimation(skill.animation, userSprite, defenderSprite, onImpact, () => {
      if (!defender.isAlive()) this.removeUnit(target);
      this.activeUnit = null;
      // A skill earns XP like a single strike that always lands.
      const strikes: Strike[] = [
        { by: 'attacker', target: 'defender', damage, hit: true, crit: false, lethal: !defender.isAlive() },
      ];
      const amount = getCombatExperience(unit.level, defender.level, getCombatOutcome(strikes, 'attacker'));
      this.showExperienceGain(unit, amount, () => this.finishPlayerAction(unitId));
    });
  }

  // Heals the wounded ally under the cursor with the staff being aimed, if
  // it's one: the ally regains the staff's power plus the healer's magic
  // (capped at its missing health) and glows like a health potion, the
  // staff spends a use, and the healer earns HEAL_EXPERIENCE.
  tryHeal() {
    const { unit, unitId } = this.activeUnit!;
    const { staff, index } = this.activeStaff!;
    const target = findTileAt(this.getHealTargetsFor(staff), this.cursor);
    if (!target) return;

    const patient = this.units.get(target.unitId)!;
    const amount = getHealAmount(unit, staff, patient);
    patient.heal(amount);
    unit.spendStaffUse(index);

    this.hideRange();
    this.inputLocked = true;
    this.publishHoveredUnit();
    const sprite = this.unitSprites.get(target.unitId)!;
    const center = { x: sprite.x + TILE_SIZE / 2, y: sprite.y + TILE_SIZE / 2 };
    this.showDamagePopup(sprite, amount, 'health');
    playPotionGlow(this, sprite, center, POTION_COLORS.health, () => {
      this.activeUnit = null;
      this.showExperienceGain(unit, HEAL_EXPERIENCE, () => this.finishPlayerAction(unitId));
    });
  }

  // Plays a skill's `animation` from the user's sprite onto the target's,
  // calling onImpact when it lands and onDone when it's over:
  //   'stone' — a stone lobbed onto the target, which flashes
  //   'strike' — the user lunges at the target, which flashes and shakes
  //              the camera like a crit
  playSkillAnimation(
    animation: string,
    userSprite: Sprite,
    targetSprite: Sprite,
    onImpact: () => void,
    onDone: () => void,
  ) {
    const center = (sprite: Sprite) => ({ x: sprite.x + TILE_SIZE / 2, y: sprite.y + TILE_SIZE / 2 });
    if (animation === 'stone') {
      playStoneThrow(this, center(userSprite), center(targetSprite), () => {
        onImpact();
        playHitFlash(this, targetSprite, onDone);
      });
      return;
    }
    // Done once the target's flash and the user's return have both ended —
    // exactly once, since onDone ends the unit's action.
    let flashed = false;
    let returned = false;
    let done = false;
    const finish = () => {
      if (done || !flashed || !returned) return;
      done = true;
      onDone();
    };
    playLunge(
      this,
      userSprite,
      center(targetSprite),
      () => {
        onImpact();
        this.cameras.main.shake(CRIT_SHAKE_MS, CRIT_SHAKE_INTENSITY);
        playHitFlash(this, targetSprite, () => {
          flashed = true;
          finish();
        });
      },
      () => {
        returned = true;
        finish();
      },
    );
  }

  // The active unit uses one of its items on itself. The effect (from
  // Unit.useItem and src/game/items.ts) applies right away; the unit glows
  // in the potion's color while a "+N HP" / "+N MP" popup rises over it,
  // and using an item ends its action.
  useItem(itemId: string) {
    const { unit, unitId } = this.activeUnit!;
    const { item, amount } = unit.useItem(itemId);
    this.publishHoveredUnit();

    this.inputLocked = true;
    const sprite = this.unitSprites.get(unitId)!;
    const center = { x: sprite.x + TILE_SIZE / 2, y: sprite.y + TILE_SIZE / 2 };
    this.showDamagePopup(sprite, amount, item.stat);
    playPotionGlow(this, sprite, center, POTION_COLORS[item.stat], () => {
      this.activeUnit = null;
      this.finishPlayerAction(unitId);
    });
  }

  // Publishes a number rising from the top center of a sprite for the
  // React HUD to draw — damage by default, or a recovery when `kind` is
  // 'health' / 'mana' — and takes it back down once it's run its course.
  showDamagePopup(sprite: Sprite, amount: number, kind: PopupKind = 'damage') {
    const { worldView, zoom } = this.cameras.main;
    const { x, y } = toCanvasFraction(
      worldToScreen({ x: sprite.x + sprite.displayWidth / 2, y: sprite.y }, { x: worldView.x, y: worldView.y, zoom }),
      this.scale.gameSize,
    );
    const popup = toDamagePopupView({
      id: this.nextPopupId++,
      amount,
      kind,
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
  removeUnit({ x, y, unitId }: TargetTile) {
    if (unitId === this.inspectedEnemyId) this.hideEnemyReach();
    this.grid = setUnit(this.grid, x, y, null);
    this.units.delete(unitId);
    this.unitSprites.get(unitId)!.destroy();
    this.unitSprites.delete(unitId);
    this.refreshDangerZone();
  }

  // Walks a sprite through each tile of path (path[0] is where it already
  // is), gliding at a steady speed from tile to tile, then calls onDone. It
  // plays its move animation facing each step's direction as it takes it,
  // then idles facing the last one.
  walkSprite(sprite: Sprite, path: readonly Point[], onDone: () => void) {
    const steps = path.slice(1);
    if (steps.length === 0) {
      onDone();
      return;
    }

    const art = sprite.getData('art');
    const facings = getPathFacings(path, sprite.getData('facing'));
    this.tweens.chain({
      targets: sprite,
      tweens: steps.map((step, i) => ({
        ...gridToWorld(step.x, step.y, TILE_SIZE),
        duration: MOVE_STEP_MS,
        ease: 'Linear',
        onStart: () => sprite.play(this.unitAnimation(art, 'move', facings[i]), true),
      })),
      onComplete: () => {
        const facing = facings[facings.length - 1];
        sprite.setData('facing', facing).play(this.unitAnimation(art, 'idle', facing));
        onDone();
      },
    });
  }

  // ---- Mouse -------------------------------------------------------------
  // The mouse feeds the same confirm / cancel the keyboard does, so every
  // input step above works with either. Pointer events on the map (from
  // Phaser) and commands from the React menus (via src/bridge/commands.ts)
  // are queued as they arrive and applied at the start of update(), where
  // they respect inputLocked like keys do:
  //   - moving over the map moves the cursor while it's free to roam
  //   - left click on the map moves the cursor there and confirms
  //   - hovering / clicking a menu entry highlights / picks it
  //   - right click anywhere on the stage cancels (sent by React)

  createPointerInput() {
    this.pointerQueue = [];
    this.pointerTile = null; // last tile the pointer was over, so only tile changes move the cursor

    const toTile = (pointer: Phaser.Input.Pointer) => worldToTile(this.grid, pointer.worldX, pointer.worldY, TILE_SIZE);
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const tile = toTile(pointer);
      if (!tile || (this.pointerTile && isSameTile(tile, this.pointerTile))) return;
      this.pointerTile = tile;
      this.pointerQueue.push({ type: 'hover-tile', ...tile });
    });
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const tile = toTile(pointer);
      if (tile && pointer.button === 0) this.pointerQueue.push({ type: 'click-tile', ...tile });
    });

    const unsubscribe = gameCommands.subscribe((command) => this.pointerQueue.push(command));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);
    this.events.once(Phaser.Scenes.Events.DESTROY, unsubscribe);
  }

  // Applies queued pointer input (cursor moves, menu highlights) and returns
  // the confirm / cancel it amounts to. Input that arrives while locked is
  // dropped, as a key press would be.
  drainPointerInput() {
    const queue = this.pointerQueue;
    this.pointerQueue = [];
    const result = { confirm: false, cancel: false };
    // Leaving for the title works even mid-animation or during the enemy
    // phase; removing the scene stops whatever was playing out.
    if (queue.some((command) => command.type === 'main-menu')) {
      this.exitToTitle();
      return result;
    }
    if (queue.some((command) => command.type === 'toggle-danger-zone')) this.toggleDangerZone();
    if (this.inputLocked) return result;

    for (const command of queue) {
      switch (command.type) {
        case 'hover-tile':
          if (this.canRoamCursor()) this.pointCursorAt(command.x, command.y);
          break;
        case 'click-tile':
          if (this.battleOutcome) {
            result.confirm = true;
          } else if (this.canRoamCursor()) {
            this.pointCursorAt(command.x, command.y);
            result.confirm = true;
          }
          break;
        case 'hover-menu':
        case 'select-menu':
          // Only a menu that's open can be pointed at.
          if (!this[command.menu]) break;
          this.publishMenu(command.menu, selectIndex(this[command.menu]!, command.index));
          if (command.type === 'select-menu') result.confirm = true;
          break;
        case 'confirm':
          result.confirm = true;
          break;
        case 'cancel':
          result.cancel = true;
          break;
      }
    }
    return result;
  }

  // The cursor follows the pointer only when no menu has input: on the bare
  // map, while choosing a destination or target, and while placing a unit.
  canRoamCursor() {
    return (
      this.cursorSprite.visible &&
      !this.battleOutcome &&
      !this.dialog &&
      !this.unitInfoUnit &&
      !this.pauseMenu &&
      !this.deploymentMenu &&
      !this.rosterMenu &&
      !this.actionMenu &&
      !this.weaponMenu &&
      !this.skillMenu &&
      !this.itemMenu
    );
  }

  pointCursorAt(x: number, y: number) {
    if (x === this.cursor.x && y === this.cursor.y) return;
    this.setCursor(x, y);
    if (this.rangeMode === 'move') this.updateMovePath();
  }

  setCursor(x: number, y: number) {
    this.cursor = moveCursor(this.grid, this.cursor, x - this.cursor.x, y - this.cursor.y);
    this.updateCursorSprite();
    this.updateHoveredUnit();
    if (this.rangeMode === 'attack') this.updateCombatForecast();
  }

  // Looks up the unit (if any) under the visible cursor and, only on change,
  // publishes a snapshot to the game store for the React HUD to render.
  // GridScene doesn't know React exists — it only writes plain state.
  updateHoveredUnit() {
    const cell = this.cursorSprite.visible ? getCell(this.grid, this.cursor.x, this.cursor.y) : null;
    const unit = (cell?.unitId ? this.units.get(cell.unitId) : null) ?? null;

    if (unit === this.hoveredUnit) return;

    this.hoveredUnit = unit;
    this.publishHoveredUnit();
  }

  // Publishes a fresh snapshot of the hovered unit — also needed when that
  // unit's stats change without the cursor moving (e.g. it takes damage) —
  // plus where its tile shows, so the unit panel can stay clear of it.
  publishHoveredUnit() {
    gameStore.setState({
      hoveredUnit: toUnitView(this.hoveredUnit),
      hoveredAnchor: this.hoveredUnit ? this.getTileAnchor(this.cursor) : null,
    });
  }

  createCursor() {
    this.cursor = createCursor(0, 0);
    const { x, y } = gridToWorld(this.cursor.x, this.cursor.y, TILE_SIZE);
    const { key, columns } = TERRAIN_SHEET;
    const frames = CURSOR_ANIMATION.tiles.map((tile) => ({ key, frame: getTileFrame(tile, columns) }));
    // Animations are global to the game, so a restarted scene reuses it.
    if (!this.anims.exists(CURSOR_ANIMATION.key)) {
      this.anims.create({
        key: CURSOR_ANIMATION.key,
        frames,
        frameRate: 1000 / CURSOR_ANIMATION.frameMs,
        repeat: -1,
      });
    }
    this.cursorSprite = this.add
      .sprite(x, y, key, frames[0].frame)
      .setOrigin(0, 0)
      .setDepth(1)
      .play(CURSOR_ANIMATION.key);
  }

  // A hidden cursor hovers nothing, so the unit panel clears with it.
  setCursorVisible(visible: boolean) {
    this.cursorSprite.setVisible(visible);
    this.updateHoveredUnit();
  }

  updateCursorSprite() {
    const { x, y } = gridToWorld(this.cursor.x, this.cursor.y, TILE_SIZE);
    this.cursorSprite.setPosition(x, y);
  }

  // A sprite (by texture key) covering the map tile whose top-left corner is
  // (x, y), stretched to the tile whatever the image's own size.
  addTileSprite(x: number, y: number, key: string) {
    return this.add.sprite(x, y, key).setOrigin(0, 0).setDisplaySize(TILE_SIZE, TILE_SIZE);
  }

  // Terrain is plain grass under every cell, with each autotiled terrain
  // (`autotiles`, see src/game/autotile.ts) drawn over it as its own layer of
  // half-size tiles, four per cell. Animated sets step through their copies
  // on a timer.
  renderTerrain(grid: Grid, autotiles: Record<string, Autotile>) {
    const { key, columns } = TERRAIN_SHEET;
    const grassFrame = getTileFrame(TERRAIN_BASE_TILE, columns);
    const grass = Array.from({ length: grid.height }, () => Array(grid.width).fill(grassFrame));
    const grassMap = this.make.tilemap({ data: grass, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    grassMap.createLayer(0, grassMap.addTilesetImage(key, key, TILE_SIZE, TILE_SIZE)!, 0, 0);

    const half = TILE_SIZE / 2;
    for (const [terrain, autotile] of Object.entries(autotiles)) {
      const frameCount = autotile.animation?.frames ?? 1;
      // One quarter-frame map per animation frame: frames[i][y][x].
      const frames = Array.from({ length: frameCount }, (_, i) =>
        getQuarterFrameMap(grid, terrain, autotile, columns, i),
      );

      const map = this.make.tilemap({ data: frames[0], tileWidth: half, tileHeight: half });
      const layer = map.createLayer(0, map.addTilesetImage(key, key, half, half)!, 0, 0)!;
      if (frameCount < 2) continue;
      let current = 0;
      this.time.addEvent({
        delay: autotile.animation!.frameMs,
        loop: true,
        callback: () => {
          current = (current + 1) % frameCount;
          layer.forEachTile((tile) => {
            if (tile.index >= 0) tile.index = frames[current][tile.y][tile.x];
          });
        },
      });
    }
  }

  // One-tile overlays from the terrain sheet (forests, mountains, buildings;
  // see src/game/mapArt.ts): ground art and caps under units, at the trees'
  // depth (caps just above, so a peak covers the forest it pokes into), and
  // roofs over units like the gate's.
  renderMapSprites(sprites: readonly MapSprite[]) {
    const depths = { ground: 0.4, cap: 0.45, roof: 0.8 };
    for (const { x, y, tile, layer } of sprites) {
      const pos = gridToWorld(x, y, TILE_SIZE);
      this.add
        .image(pos.x, pos.y, TERRAIN_SHEET.key, getTileFrame(tile, TERRAIN_SHEET.columns))
        .setOrigin(0, 0)
        .setDepth(depths[layer]);
    }
  }

  // Trees ({ x, y, tree } from the level) over the grass, below range highlights
  // and units.
  renderDecorations(decorations: readonly TreePlacement[]) {
    for (const { x, y, tree } of decorations) {
      const pos = gridToWorld(x, y, TILE_SIZE);
      addTreeShadow(this, pos.x, pos.y);
      this.addTileSprite(pos.x, pos.y, TREE_SPRITES[tree]).setDepth(0.4);
    }
  }

  // Multi-tile structures ({ x, y, structure } from the level, by top-left
  // tile), drawn a tile at a time: roof tiles over units (0.75) so a unit
  // under the roof passes behind it, but under the cursor (1); the rest at
  // the trees' depth, under units.
  renderStructures(structures: readonly StructurePlacement[]) {
    for (const { x, y, structure } of structures) {
      const sprite = STRUCTURE_SPRITES[structure];
      for (const tile of getStructureTiles(sprite, x, y)) {
        const pos = gridToWorld(tile.x, tile.y, TILE_SIZE);
        this.add
          .image(pos.x, pos.y, sprite.key, tile.frame)
          .setOrigin(0, 0)
          .setDepth(tile.overUnits ? 0.8 : 0.4);
      }
    }
  }

  // Draws a sprite per unit on the grid and keeps them in this.unitSprites
  // (unitId -> sprite) so later moves can find the sprite to reposition.
  // Units placed during deployment get theirs from addUnitSprite.
  renderUnits(grid: Grid) {
    this.unitSprites = new Map();
    for (const cell of grid.cells) {
      if (cell.unitId) this.addUnitSprite(cell.unitId, cell.x, cell.y);
    }
  }

  addUnitSprite(unitId: string, gridX: number, gridY: number) {
    const unit = this.units.get(unitId)!;
    const { x, y } = gridToWorld(gridX, gridY, TILE_SIZE);
    const art = getUnitSprite(unit.unitClass);
    const sprite = this.addTileSprite(x, y, unitSheetKey(art, 'idle'))
      .setDepth(0.75)
      .setData('unit', unit)
      .setData('art', art)
      .setData('facing', UNIT_SHEET.defaultFacing)
      .play(this.unitAnimation(art, 'idle', UNIT_SHEET.defaultFacing));
    addUnitShadow(this, sprite);
    this.unitSprites.set(unitId, sprite);
  }

  // The looping animation (a UNIT_ANIMATIONS name) for a unit's art facing
  // `facing`, created on first use. Animations are global to the game, so a
  // restarted scene reuses them.
  unitAnimation(art: string, animation: UnitAnimation, facing: Facing) {
    const key = unitSheetKey(art, animation);
    const animKey = `${key}-${facing}`;
    if (!this.anims.exists(animKey)) {
      const { columns, rows, frames } = UNIT_SHEET;
      const { frameMs } = UNIT_ANIMATIONS[animation];
      const row = rows[facing];
      this.anims.create({
        key: animKey,
        frames: Array.from({ length: frames }, (_, column) => ({ key, frame: getTileFrame([column, row], columns) })),
        frameRate: 1000 / frameMs,
        repeat: -1,
      });
    }
    return animKey;
  }
}
