import Phaser from 'phaser';
import { SPRITES } from '../assets/sprites.ts';
import terrainSheetUrl from '../assets/overworld.png';
import { gameCommands, type Command, type MenuField } from '../bridge/commands.ts';
import { changeAutoSpeed, cycleAutoSpeed } from '../game/autoSpeed.ts';
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
  toRewardMenuActions,
  toRewardAction,
  toBoonActions,
  toRelicViews,
  toTeamView,
  toRunOverView,
  toStageClearView,
  toPhaseBannerView,
  toCanvasFraction,
  toRosterEntryView,
  toTileAnchorView,
  toTurnView,
  toUnitDetailView,
  toUnitView,
  worldToScreen,
  type RewardAction,
  type RunOverView,
  type StageClearView,
} from '../bridge/views.ts';
import {
  createActionMenu,
  getDefaultActionIndex,
  getSelectedAction,
  getUnitActions,
  moveSelection,
  selectIndex,
} from '../game/actionMenu.ts';
import {
  findUsableStaff,
  getHealTargets,
  getStaves,
  isWounded,
  type CarriedStaff,
  type Staff,
} from '../game/healing.ts';
import { findUnitSkill, getSkillActions, getSkillForecast, getUnitSkills, isHealingSkill } from '../game/skills.ts';
import { getAttackRange, getAttackTargets, getCombatForecast, getThreatRange } from '../game/combat.ts';
import { getCameraView, getFitZoom } from '../game/camera.ts';
import { getFramingClumps } from '../game/battlefieldFraming.ts';
import { createCursor, moveCursor } from '../game/cursor.ts';
import {
  createBattleLevel,
  describeBattle,
  FIRST_STORY_CHAPTER,
  getBattleDiceSeed,
  getNextBattle,
  runStage,
  type GameContent,
} from '../game/battleSetup.ts';
import type { PendingReward, RunState } from '../game/warband/run.ts';
import {
  getRerollCost,
  getSkipGold,
  getPendingRewardOffer,
  type Reward,
  type RewardLevelUp,
} from '../game/warband/rewards.ts';
import { getBoonOffer } from '../game/warband/levelUpPicks.ts';
import { toBoonPickView } from '../bridge/boonPickView.ts';
import {
  applyRunCommand,
  finishBattleWithEvents,
  getRewardOffers,
  getRecruitOffers,
  RunCommandError,
  type RunCommand,
  type RunCommandResult,
  countWarbandKills,
} from '../game/warband/runCommands.ts';
import { clearSavedRun, saveRun } from '../data/runSave.ts';
import { getClearGold, getRunSite, isInTown, isRealmRun, isSiteDone } from '../game/warband/travel.ts';
import { enterRun } from '../bridge/warbandFlow.ts';
import { loadMeta, saveMeta } from '../data/metaSave.ts';
import { addPlayTime, EMPTY_CHRONICLE } from '../game/warband/chronicle.ts';
import { recordRun } from '../game/warband/meta.ts';
import { getRunHeat } from '../game/warband/heat.ts';
import { summarizeRun } from '../game/warband/runSummary.ts';
import { toRunSummaryView, type RunSummaryView } from '../bridge/runSummaryView.ts';
import { pickBoonOffer, pickReward, planCamp } from '../game/warband/runPolicy.ts';
import { planPlayerDeployment, planPlayerTurn } from '../game/battle/playerAI.ts';
import { getCampActions } from '../game/warband/camp.ts';
import {
  cancelMerchant,
  confirmMerchant,
  moveMerchantCursor,
  openMerchantScreen,
  pointMerchantCursor,
  type MerchantScreenState,
} from '../game/warband/merchantScreen.ts';
import { toMerchantScreenView } from '../bridge/merchantView.ts';
import {
  cancelPromotion,
  confirmPromotion,
  isPromotionScreenDone,
  movePromotionCursor,
  openPromotionScreen,
  pointPromotionCursor,
  type PromotionScreenState,
} from '../game/warband/promotionScreen.ts';
import { toPromotionScreenView } from '../bridge/promotionView.ts';
import {
  cancelMentor,
  confirmMentor,
  moveMentorCursor,
  openMentorScreen,
  pointMentorCursor,
  type MentorScreenState,
} from '../game/warband/mentorScreen.ts';
import { toMentorScreenView } from '../bridge/mentorView.ts';
import {
  cancelRoster,
  confirmRoster,
  moveRosterCursor,
  openRosterScreen,
  pointRosterCursor,
  type RosterScreenState,
} from '../game/warband/rosterScreen.ts';
import { toRosterScreenView } from '../bridge/rosterView.ts';
import { randomSeed } from '../game/rng.ts';
import { getStructureTiles } from '../game/structures.ts';
import { getConsumables, getItemActions } from '../game/items.ts';
import { getWeaponActions, getWeaponReach, type Weapon, type WeaponAction } from '../game/weapons.ts';
import { getPhaseMovement } from '../game/enemyAI.ts';
import {
  canDeployUnitAt,
  canPickToDeploy,
  canStartBattle,
  getDeploymentActions,
  getFirstOpenTile,
  isDeploymentComplete,
  isPlaced,
} from '../game/deployment.ts';
import { findTileAt, findUnit, getCell, getDistance, gridToWorld, isSameTile, worldToTile } from '../game/grid.ts';
import { areAllied, getTeamUnitIds, isAllyOf, isHostileTo } from '../game/teams.ts';
import { advanceDialog, createDialog, DIALOG_CHARS_PER_SECOND, getCurrentLine } from '../game/dialog.ts';
import { getTriggeredDialog, turnTrigger } from '../game/dialogScript.ts';
import { describeObjective, getObjectiveStatus, type Objective } from '../game/objectives.ts';
import { getFacingToward, getPathFacings, getStartFacing } from '../game/facing.ts';
import {
  getPropPlacement,
  getStandingDepth,
  getStandingPosition,
  STANDING_DEPTH_HAIR,
  STANDING_OVERHANG,
} from '../game/sideView.ts';
import {
  BACKDROP_COLUMN,
  BACKDROP_HEIGHT,
  BATTLEFIELD_LOOKS,
  getBackdropSeed,
  getBackdropStyle,
  getFloorFlecks,
  getPaintingCamera,
  getPaintingPlacement,
  getSilhouette,
  type BackdropStyle,
} from '../game/backdrop.ts';
import type { BattlefieldKind } from '../game/battlefields.ts';
import { BATTLEFIELD_PAINTINGS, battlefieldPaintingKey } from '../assets/battlefieldArt.ts';
import { createKeyRepeat, updateKeyRepeat } from '../game/keyRepeat.ts';
import { getArrowPieces } from '../game/moveArrow.ts';
import { getQuarterFrameMap, getTileFrame, type Autotile } from '../game/autotile.ts';
import { getWangFrameMap } from '../game/wangTiles.ts';
import {
  getBuildingSprites,
  getCrossingSprites,
  getHazardSprites,
  getFeatureSprites,
  getObstacleSprites,
  getWallAutotile,
  type MapSprite,
} from '../game/mapArt.ts';
import { canMoveAlongPath, extendMovePath, getMovementRange } from '../game/movement.ts';
import { pickAttackPlan } from '../game/attackMove.ts';
import { getDangerZone } from '../game/dangerZone.ts';
import { getPauseActions } from '../game/pauseMenu.ts';
import { planNextTurn } from '../game/battle/ai.ts';
import { getEnemyIntents, getIntentThreats, type EnemyIntent } from '../game/battle/intents.ts';
import { getPushDirection, getPushResult } from '../game/push.ts';
import { toIntentTagView, toPushTagView } from '../bridge/mapTagView.ts';
import {
  findEvent,
  getSkillTargets,
  type BattleCommand,
  type BattleEvent,
  type BattleEventOf,
} from '../game/battle/commands.ts';
import {
  createHistory,
  dispatch,
  getCurrentState,
  rewindTo,
  undoLastAction,
  type BattleHistory,
} from '../game/battle/history.ts';
import { createBattleState, getRunBattleResult, type BattleState as Battle } from '../game/battle/state.ts';
import { isDone } from '../game/turns.ts';
import {
  ARROW_TILES,
  BRIDGE_ART,
  BUILDING_ART,
  BUILDING_PALETTES,
  CURSOR_ANIMATION,
  DEFAULT_BUILDING_PALETTE,
  FORD_ART,
  SPIKES_ART,
  FOREST_ART,
  GATE_ART,
  MAP_PROPS_SHEET,
  MOUNTAIN_ART,
  OBSTACLE_ART,
  SOFT_UNIT_SHADOW,
  STRUCTURE_SPRITES,
  TERRAIN_SHEET,
  WANG_SETS,
  WANG_SHEET,
  CELL,
  GRID_PX,
  TILE_SIZE,
  TREE_SPRITES,
  UNIT_ANIMATIONS,
  UNIT_OUTLINE,
  UNIT_SHEET,
  getUnitSprite,
  getUnitTextureKey,
  isSingleImageUnit,
  unitSheetKey,
} from '../game/tileset.ts';
import {
  POTION_COLORS,
  playDeathBurst,
  playHitFlash,
  playHitStop,
  playLunge,
  playPotionGlow,
  playStoneThrow,
} from './effects.ts';
import { CRIT_SHAKE, getLungeDistance, getStrikeJuice, type Shake } from './hitJuice.ts';
import { addObstacleShadow, addTreeShadow, addUnitShadow } from './unitShadow.ts';
import { addUnitOutline } from './unitOutline.ts';
import { addUnitRig, faceRigToward, playRigAction, setRigMotion } from './unitRig.ts';
import { addRankBadge } from './rankBadge.ts';
import type { Menu } from '../game/actionMenu.ts';
import type { Dialog, DialogLine } from '../game/dialog.ts';
import type { DialogScripts } from '../game/dialogScript.ts';
import type { Grid, Point } from '../game/grid.ts';
import type { Direction, KeyRepeatState, Step } from '../game/keyRepeat.ts';
import type { MovementOptions, RangeTile } from '../game/movement.ts';
import type { TargetTile } from '../game/combat.ts';
import type { StructurePlacement, TreePlacement } from '../game/demoLevel.ts';
import type { Facing } from '../game/facing.ts';
import type { UnitAnimation } from '../game/tileset.ts';
import type { PopupKind } from '../bridge/views.ts';
import { isSameBossBar, toBossBarView, toBossIntroView } from '../bridge/bossView.ts';
import type { Skill } from '../game/skills.ts';
import type { BattleOutcome, Team, TurnState } from '../game/turns.ts';
import type { Unit } from '../game/Unit.ts';
import type { ItemAction, RestoreStat } from '../game/items.ts';
import type { SkillAction } from '../game/skills.ts';
import type { RosterMenuEntry } from '../bridge/gameStore.ts';

// The canvas is sized by the page (see main.ts); maps are zoomed to fit it,
// up to MAX_ZOOM, and centered. Zoom goes in steps of ZOOM_STEP, so a
// pixel of the 32px art (drawn at GRID_PX) stays a whole number of screen
// pixels; the cap is a tile 96 screen pixels big.
const ZOOM_STEP = 1 / GRID_PX;
const MAX_ZOOM = 3 / GRID_PX;
// How dark a battlefield's floor grid is (see renderFloorGrid).
const FLOOR_GRID_ALPHA = 0.08;
// The framing clumps' shade: near the camera and out of the light, so dark
// and cool, and their depth, over everything standing but under the cursor.
const FRAMING_TINT = 0x56664a;
const FRAMING_DEPTH = 0.85;
// The darkening toward a battlefield's screen edges (Phaser's vignette:
// radius and strength), drawing the eye in to the fight.
const VIGNETTE = { radius: 0.85, strength: 0.35 };
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
// Enemy intents: the route an enemy will walk (thin, faint) and the arrow
// onto the unit it'll strike, over the highlights and the move arrow but
// under units.
const INTENT_COLOR = 0xdc2626;
const INTENT_ROUTE_ALPHA = 0.5;
const INTENT_ARROW_ALPHA = 0.9;
const INTENT_DEPTH = 0.65;
// Where an aimed Shove would leave its target.
const PUSH_PREVIEW_COLOR = 0x3858b0;
const PUSH_PREVIEW_ALPHA = 0.5;
// A shoved unit's slide onto its new tile, and the nudge of one that's
// stopped (in px).
const PUSH_SLIDE_MS = 160;
const PUSH_BUMP_PX = 6 * GRID_PX;
const DEPLOYMENT_ZONE_COLOR = 0xfacc15;
const DEPLOYMENT_ZONE_ALPHA = 0.4;
// A seize objective's tile: a gold outline over a faint fill that pulses,
// over the buildings' ground art but under the range highlights.
const SEIZE_TILE_COLOR = 0xfbbf24;
const SEIZE_TILE_ALPHA = 0.3;
const SEIZE_TILE_PULSE_MS = 700;
// The tile a boss's war horn marked for its next arrival (see bosses.ts):
// a red outline over a faint fill that pulses faster than a seize tile's.
const INCOMING_TILE_COLOR = 0xef4444;
const INCOMING_TILE_ALPHA = 0.35;
const INCOMING_TILE_PULSE_MS = 450;
// How long a boss's name card holds the screen as its stage opens.
const BOSS_INTRO_DURATION_MS = 3200;
// How long a boss's rage holds before the battle goes on.
const ENRAGE_PAUSE_MS = 600;
// Deployment menu entries, by index, for re-opening it on a given one.
const PLACE_UNITS_INDEX = 0;
const START_INDEX = 1;
// How long a walking unit takes to glide from one tile to the next.
const MOVE_STEP_MS = 140;
// How long a damage number stays on screen (the React HUD animates it).
const DAMAGE_POPUP_DURATION_MS = 700;
// How long a missed strike holds before the next one (about a hit flash).
const MISS_PAUSE_MS = 420;
// How long the "Player Phase" / "Enemy Phase" banner holds the screen.
const PHASE_BANNER_DURATION_MS = 1200;
// Pauses in the enemy phase: on each enemy before it moves, and between enemies.
const ENEMY_FOCUS_DELAY_MS = 250;
const ENEMY_ACTION_DELAY_MS = 300;
// How long auto play waits between its steps (a unit's action, a menu
// pick, moving past a screen), so it can be followed.
const AUTO_STEP_MS = 450;
// How long a player unit's XP bar shows after combat (the React HUD fills it).
const EXPERIENCE_BAR_MS = 1100;
// How long each level-up panel holds the screen.
const LEVEL_UP_MS = 2400;
// How long the reward pick a won stage opens on ignores confirm.
const REWARD_PICK_GRACE_MS = 500;
// How long a boon pick waits before taking confirm: its level-up effect.
const BOON_PICK_GRACE_MS = 700;
// Tint for units that are done for the phase.
const DONE_TINT = 0x808080;

type Sprite = Phaser.GameObjects.Sprite;
type ActionKey = 'confirm' | 'confirmAlt' | 'cancel' | 'cancelAlt' | 'dangerZone' | 'autoPlay';
type RangeMode = 'move' | 'attack' | 'skill' | 'heal';

// The unit whose menu or range is open, where it stands, and (after a move)
// where it came from and how many commands the battle had before it.
interface ActiveUnitState extends Point {
  unitId: string;
  origin?: Point;
  movedAt?: number;
}

// The same, with the unit as the battle now has it.
interface ActiveUnit extends ActiveUnitState {
  unit: Unit;
}

// Pointer input queued for the next update: tile hovers and clicks from
// Phaser, and commands from React.
type PointerInput = Command | ({ type: 'hover-tile' | 'click-tile' } & Point);

export class GridScene extends Phaser.Scene {
  // The battle: where it started and every command since (see
  // src/game/battle/), (re)set in create().
  history!: BattleHistory;
  // The battle as the map shows it. It trails the battle while a command's
  // events play out, so units fall and lose health as the animations get
  // there (with `shownStats` for the health and mana mid-exchange), and
  // catches up once they're done (syncShown).
  shown!: Battle;
  shownStats = new Map<string, { health?: number; mana?: number }>();
  dialogs!: DialogScripts;
  setup!: BattleSetup;
  // When the run's play clock last started (Date.now()), see takePlayTime.
  playClockFrom = 0;
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
  rewardMenu: Menu<RewardAction> | null = null;
  // After a won Warband stage: the run as it stands (the battle written
  // back, the clear's gold paid) and the rewards it offers to pick from.
  rewardOffer: { run: RunState; stage: number; rewards: readonly Reward[]; rerolls: number } | null = null;
  // The guest's recruitment, or a Recruit reward's draft (`draft`).
  recruitOffer: { run: RunState; stage: number; recruits: readonly Reward[]; draft: boolean } | null = null;
  // While the run owes level-up boon picks (see levelUpPicks.ts): the run
  // as it stands. They come before the recruit and reward picks.
  boonRun: RunState | null = null;
  // After the reward is taken: the run as it then stands, while the camp
  // menu (Manage Roster / Next Stage) or the roster screen is up.
  campRun: RunState | null = null;
  campMenu: Menu | null = null;
  // A won realm stage with nothing to pick: the run, for confirm on the
  // result to open its camp.
  campAfterOutcome: RunState | null = null;
  rosterScreen: RosterScreenState | null = null;
  merchantScreen: MerchantScreenState | null = null;
  promotionScreen: PromotionScreenState | null = null;
  mentorScreen: MentorScreenState | null = null;
  pauseMenu: Menu | null = null;
  placingUnitId: string | null = null;
  zoneTiles: Phaser.GameObjects.Rectangle[] | null = null;
  activeUnitState: ActiveUnitState | null = null;
  rangeMode: RangeMode | null = null;
  activeSkill: Skill | null = null;
  activeStaff: CarriedStaff | null = null;
  attackFromMove = false;
  rangeTiles: Phaser.GameObjects.Rectangle[] | null = null;
  dangerZoneVisible = false;
  dangerZoneTiles: Phaser.GameObjects.Rectangle[] = [];
  intentGraphics: Phaser.GameObjects.Graphics | null = null;
  pushPreviewTiles: Phaser.GameObjects.Rectangle[] = [];
  autoElapsed = 0;
  pendingAutoCommands: BattleCommand[] = [];
  inspectedEnemyId: string | null = null;
  inspectedTiles: Phaser.GameObjects.Rectangle[] = [];
  moveRange: RangeTile[] | null = null;
  movePath: readonly Point[] | null = null;
  arrowSprites: Sprite[] = [];
  inputLocked = false;
  battleOutcome: BattleOutcome | null = null;
  nextBannerId = 1;
  rewardPickOpensAt = 0;
  skippableWait: { timer: Phaser.Time.TimerEvent; onDone: () => void } | null = null;
  hoveredUnit: Unit | null = null;
  hoveredUnitId: string | null = null;
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
  // The marker on the tile a boss's horn marked, and that tile as "x,y".
  incomingMarker: Phaser.GameObjects.Rectangle | null = null;
  incomingMarkerKey: string | null = null;
  // A battlefield's kind, its painting (if it has one) and the out-of-focus
  // clumps framing it, which fitCamera fits to the screen.
  battlefieldKind: BattlefieldKind | null = null;
  battlefieldPainting: Phaser.GameObjects.Image | null = null;
  framingClumps: Phaser.GameObjects.Image[] = [];

  constructor() {
    super('Grid');
  }

  // The battle as it stands, ahead of the map while events play out.
  get battle(): Battle {
    return getCurrentState(this.history);
  }

  // The map's view of the battle (see `shown`).
  get grid(): Grid {
    return this.shown.grid;
  }

  get units(): ReadonlyMap<string, Unit> {
    return this.shown.units;
  }

  get roster(): readonly string[] {
    return this.shown.roster;
  }

  get deploymentZone(): readonly Point[] {
    return this.shown.deploymentZone;
  }

  get deploymentLimit(): number {
    return this.shown.deploymentLimit;
  }

  get objective(): Objective {
    return this.shown.objective;
  }

  get turnState(): TurnState | null {
    return this.shown.turnState;
  }

  // The active unit as the battle now has it: commands replace units
  // rather than change them, so it's looked up afresh each time.
  get activeUnit(): ActiveUnit | null {
    const state = this.activeUnitState;
    return state && { ...state, unit: this.units.get(state.unitId)! };
  }

  set activeUnit(active: ActiveUnitState | null) {
    this.activeUnitState = active && {
      unitId: active.unitId,
      x: active.x,
      y: active.y,
      origin: active.origin,
      movedAt: active.movedAt,
    };
  }

  // Gives the battle a command and records it, returning what happened.
  // The map doesn't show it until syncShown.
  dispatch(command: BattleCommand): readonly BattleEvent[] {
    const { history, events } = dispatch(this.history, command);
    this.history = history;
    if (this.pendingAutoCommands[0] === command) {
      this.pendingAutoCommands.shift();
      this.publishAutoCommandQueue();
    }
    return events;
  }

  queueAutoCommands(commands: readonly BattleCommand[]) {
    this.pendingAutoCommands = [...commands];
    this.publishAutoCommandQueue();
  }

  publishAutoCommandQueue() {
    gameStore.setState({
      autoCommandQueue: this.pendingAutoCommands.map((command) => {
        const actor = 'unitId' in command ? (this.battle.units.get(command.unitId)?.name ?? command.unitId) : null;
        switch (command.type) {
          case 'place':
          case 'move':
            return `${actor}: ${command.type === 'place' ? 'Place' : 'Move'} to ${command.to.x + 1}, ${command.to.y + 1}`;
          case 'attack':
          case 'skill':
          case 'heal':
            return `${actor}: ${command.type === 'skill' ? command.skillId : command.type} at ${command.target.x + 1}, ${command.target.y + 1}`;
          case 'equip':
            return `${actor}: Equip slot ${command.index + 1}`;
          case 'item':
            return `${actor}: Use ${command.itemId}`;
          case 'wait':
            return `${actor}: Wait`;
          case 'start-battle':
            return 'Start battle';
          case 'end-phase':
            return 'End phase';
        }
      }),
    });
  }

  // Catches the map's view up with the battle.
  syncShown() {
    this.shown = this.battle;
    this.shownStats.clear();
    this.publishBossBar();
    this.refreshIncomingMarker();
  }

  preload() {
    // Drives the loading screen's bar; the screen lifts at the end of create().
    this.load.on('progress', (progress: number) => gameStore.setState({ mapLoadProgress: progress }));
    // Spritesheets so sprites can draw single frames: the cursor and arrow
    // tiles of the terrain sheet (the tilemaps still use it whole), and each
    // unit sheet's animation frames. Each is cut at its own frame size and
    // drawn one tile big (addTileSprite, addTileImage).
    const { tileSize } = TERRAIN_SHEET;
    this.load.spritesheet(TERRAIN_SHEET.key, terrainSheetUrl, { frameWidth: tileSize, frameHeight: tileSize });
    for (const [key, { url, frame }] of Object.entries(SPRITES)) {
      this.load.spritesheet(key, url, { frameWidth: frame, frameHeight: frame });
    }
    const paintings = Object.keys(BATTLEFIELD_PAINTINGS) as BattlefieldKind[];
    for (const kind of paintings) this.load.image(battlefieldPaintingKey(kind), BATTLEFIELD_PAINTINGS[kind]!.url);
    // Painted art is filtered smoothly when scaled; the rest stays crisp
    // (the game's pixelArt default).
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      for (const [key, { smooth }] of Object.entries(SPRITES)) {
        if (smooth) this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
      }
      for (const kind of paintings) {
        this.textures.get(battlefieldPaintingKey(kind)).setFilter(Phaser.Textures.FilterMode.LINEAR);
      }
    });
  }

  // `setup` is the battle to run (gameStore's battleSetup, see
  // src/game/battleSetup.ts), the first story chapter if there's none.
  create(setup: BattleSetup = FIRST_STORY_CHAPTER) {
    // Every battle starts from a clean slate: clear anything a previous
    // battle left in the store.
    gameStore.setState({ ...BATTLE_STATE_DEFAULTS });

    this.setup = setup;
    this.playClockFrom = Date.now(); // the run's play time is counted from here (takePlayTime)
    this.nextBattle = null; // the BattleSetup a victory leads to, once won
    this.rewardOffer = null; // the run and its reward picks after a won Warband stage
    this.recruitOffer = null;
    this.boonRun = null; // the run while it owes level-up boon picks
    this.rewardMenu = null; // the reward screen's menu while it's up
    this.campRun = null; // the run between a won Warband stage's reward and the next stage
    this.campMenu = null; // the camp's menu (getCampActions) while it's up
    this.campAfterOutcome = null; // a won realm stage's run when its result leads straight to camp
    this.rosterScreen = null; // the roster screen's state while it's open
    this.merchantScreen = null; // the merchant screen's state while it's open
    this.promotionScreen = null; // the promotion screen's state while it's open
    this.mentorScreen = null; // the mentor screen's state while it's open
    // Configs uploaded in the config editor replace the built-in ones.
    this.content = getActiveContent();
    const level = createBattleLevel(setup, this.content);
    // The grid, every unit (player roster and enemies alike), the deployment
    // zone and limit, and the objective, with the battle's rolls seeded from
    // the run for a Warband stage, else fresh.
    this.history = createHistory(createBattleState(level, getBattleDiceSeed(setup) ?? randomSeed()));
    this.shown = this.battle;
    this.shownStats = new Map();
    this.incomingMarker = null; // the last battle's marker went with its scene
    this.incomingMarkerKey = null;
    this.dialogs = level.dialogs; // the level's conversations by trigger (src/game/dialogScript.ts)

    const paletteName = level.palette ?? DEFAULT_BUILDING_PALETTE;
    const palette = BUILDING_PALETTES[paletteName];
    // A battlefield is its field's painted (or code-drawn) look with its
    // obstacles standing on it; any other map is drawn from its terrain.
    this.battlefieldKind = level.battlefield ?? null;
    this.battlefieldPainting = null;
    this.framingClumps = [];
    // A battlefield darkens toward the screen's edges (WebGL only).
    const cameraFX = this.cameras.main.postFX;
    cameraFX?.clear();
    if (level.battlefield) cameraFX?.addVignette(0.5, 0.5, VIGNETTE.radius, VIGNETTE.strength);
    if (level.battlefield) {
      this.renderBattlefield(level.battlefield, getBackdropSeed(this.grid));
      for (const { x, y } of level.obstacles ?? []) {
        const pos = getStandingPosition(x, y);
        addObstacleShadow(this, pos.x, pos.y);
      }
    } else {
      this.renderBackdrop(getBackdropStyle(level.biome), getBackdropSeed(this.grid));
      this.renderTerrain(this.grid, { wall: getWallAutotile(palette) });
    }
    this.renderMapSprites([
      ...getCrossingSprites(this.grid, BRIDGE_ART, GATE_ART[paletteName], FORD_ART, MAP_PROPS_SHEET),
      ...getHazardSprites(this.grid, SPIKES_ART, MAP_PROPS_SHEET),
    ]);
    this.renderStandingProps(
      level.battlefield
        ? getObstacleSprites(level.obstacles ?? [], OBSTACLE_ART)
        : [
            ...getFeatureSprites(this.grid, FOREST_ART, MOUNTAIN_ART),
            ...getBuildingSprites(level.buildings ?? [], palette, BUILDING_ART),
          ],
    );
    this.renderDecorations(level.decorations ?? []);
    this.renderStructures(level.structures ?? []);
    this.renderObjectiveTile();
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
      autoPlay: Phaser.Input.Keyboard.KeyCodes.A,
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
    this.activeUnit = null; // { unitId, x, y } the menu / range belongs to (unit looked up)
    this.rangeMode = null; // 'move' | 'attack' | 'skill' | 'heal' while choosing a destination or target
    this.activeSkill = null; // the skill being aimed while rangeMode is 'skill'
    this.activeStaff = null; // the staff being aimed while rangeMode is 'heal'
    this.attackFromMove = false; // aiming an attack picked straight from the move range
    this.rangeTiles = null; // highlight rectangles for the current range
    this.dangerZoneVisible = false; // whether every enemy's reach is shaded (toggled with D or the header button)
    this.dangerZoneTiles = []; // highlight rectangles for the danger zone
    this.intentGraphics = null; // the enemies' intent lines, drawn during the player phase
    this.pushPreviewTiles = []; // where an aimed Shove would leave its target
    this.autoElapsed = 0; // ms since auto play's last step (see updateAutoPlay)
    this.pendingAutoCommands = [];
    this.inspectedEnemyId = null; // an enemy picked on the bare map to show just its reach
    this.inspectedTiles = []; // highlight rectangles for that enemy's reach
    this.moveRange = null; // [{ x, y, cost }] the active unit can end its move on
    this.movePath = null; // planned route [{ x, y }] from the active unit to the cursor
    this.arrowSprites = []; // arrow pieces drawn along movePath
    this.inputLocked = false; // input is ignored while a move, hit, banner, or the enemy phase plays out
    this.battleOutcome = null; // 'victory' | 'defeat' once the battle is decided
    this.nextBannerId = 1;
    this.rewardPickOpensAt = 0; // scene time a won stage's reward pick, or a boon pick, starts taking confirm
    this.skippableWait = null; // the banner, XP bar or level up confirm can cut short (waitSkippably), or null
    this.hoveredUnit = null;
    this.hoveredUnitId = null;
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
    this.applyAutoSpeed();
    if (this.preview) {
      this.startPreview();
      gameStore.setState({ mapLoadProgress: 1, mapReady: true });
      return;
    }
    // A run saved before its last reward pick reopens on the reward screen,
    // over the next stage's map; taking it goes to camp, and marching on
    // from there starts that stage afresh.
    const savedRun = setup.mode === 'warband' ? setup.run : undefined;
    const pendingReward = savedRun ? getPendingRewardOffer(savedRun) : null;
    if (savedRun && getBoonOffer(savedRun)) {
      this.resumeBoonPicks(savedRun);
      gameStore.setState({ mapLoadProgress: 1, mapReady: true });
      return;
    }
    if (savedRun && (savedRun.pendingRecruitment || savedRun.pendingDraft !== undefined)) {
      this.resumeRecruitment(savedRun);
      gameStore.setState({ mapLoadProgress: 1, mapReady: true });
      return;
    }
    if (savedRun && pendingReward) {
      this.resumeRewardPick(savedRun, pendingReward);
      gameStore.setState({ mapLoadProgress: 1, mapReady: true });
      return;
    }
    // A run arriving in a town (see warband/travel.ts) opens its camp over
    // the town, with the merchant and a free rest.
    if (savedRun && isInTown(savedRun) && !isSiteDone(savedRun)) {
      this.setCursorVisible(false);
      this.openCamp(savedRun);
      gameStore.setState({ mapLoadProgress: 1, mapReady: true });
      return;
    }
    this.updateHoveredUnit();
    this.publishBossBar();
    // Levels with units to place open on deployment, with the objective on
    // its menu; others (e.g. training, where everyone starts on the map)
    // show the Objective screen and go straight to the battle. Either waits
    // for the level's opening dialog, if it has one, and a boss stage's
    // name card after it.
    this.playTriggeredDialog('opening', () =>
      this.showBossIntro(() => {
        if (this.deploymentZone.length > 0) this.startDeployment();
        else this.showObjective(() => this.startBattle());
      }),
    );
    gameStore.setState({ mapLoadProgress: 1, mapReady: true });
  }

  // Zooms the map to fit the canvas (up to MAX_ZOOM) and centers it; a
  // painted battlefield is framed by its painting instead
  // (getPaintingCamera). Runs on create and whenever the page resizes the
  // canvas.
  fitCamera() {
    const camera = this.cameras.main;
    const painting = this.battlefieldPainting;
    if (painting) {
      const canvas = this.scale.gameSize;
      const floor = {
        x: 0,
        y: -STANDING_OVERHANG,
        width: this.grid.width * CELL.width,
        height: this.grid.height * CELL.height + STANDING_OVERHANG,
      };
      const fit = Math.min(canvas.width / floor.width, canvas.height / floor.height);
      const at = { x: painting.x, y: painting.y, width: painting.displayWidth, height: painting.displayHeight };
      const { zoom, center } = getPaintingCamera(at, floor, canvas, fit);
      camera.setZoom(zoom);
      camera.centerOn(center.x, center.y);
      this.afterCameraFit();
      return;
    }
    // The backdrop stands above the floor (with room for the top row's
    // heads), so frame it too.
    const rows = this.grid.height + BACKDROP_HEIGHT / CELL.height;
    // The canvas has pixelRatio canvas pixels per CSS pixel (see main.ts), so
    // the cap grows with it to keep the map the same size on screen, and the
    // steps stay whole canvas pixels.
    const pixelRatio = 1 / this.scale.zoom;
    const zoom = getFitZoom(
      { width: this.grid.width, height: rows },
      CELL,
      this.scale.gameSize,
      MAX_ZOOM * pixelRatio,
      ZOOM_STEP,
    );
    const center = {
      x: (this.grid.width * CELL.width) / 2,
      y: (this.grid.height * CELL.height - BACKDROP_HEIGHT) / 2,
    };
    camera.setZoom(zoom);
    camera.centerOn(center.x, center.y);
    if (this.battlefieldKind) this.frameBattlefield(getCameraView(center, zoom, this.scale.gameSize));
    this.afterCameraFit();
  }

  // After the camera moves: what's placed by screen position follows it.
  afterCameraFit() {
    // The camera's visible area only updates when it next renders, so move
    // an open unit menu to the refitted map then.
    this.events.once(Phaser.Scenes.Events.RENDER, () => {
      if (this.activeUnit) this.publishMenuAnchor();
      if (this.rangeMode === 'attack' || this.rangeMode === 'skill') this.updateCombatForecast();
      if (this.rangeMode === 'skill') this.updatePushPreview();
      this.refreshIntents();
    });
  }

  // Fits a code-drawn battlefield to the camera's `view`: the
  // out-of-focus clumps (getFramingClumps) redrawn in its bottom corners,
  // over everything on the floor but the cursor. (A painting has its own
  // foreground painted in.)
  frameBattlefield(view: { x: number; y: number; width: number; height: number }) {
    const kind = this.battlefieldKind!;
    const floor = { width: this.grid.width * CELL.width, height: this.grid.height * CELL.height };
    for (const clump of this.framingClumps) clump.destroy();
    this.framingClumps = getFramingClumps(kind, view, floor).map(({ kind: obstacle, x, y, size, flip }) => {
      const { sheet, tile } = OBSTACLE_ART[obstacle];
      const image = this.add
        .image(x, y, sheet.key, getTileFrame(tile, sheet.columns))
        .setOrigin(0, 0)
        .setDisplaySize(size, size)
        .setFlipX(flip)
        .setTint(FRAMING_TINT)
        .setDepth(FRAMING_DEPTH);
      image.preFX?.addBlur(0, 1, 1, Math.max(1, size / 120));
      return image;
    });
  }

  override update(_time: number, delta: number) {
    this.sortUnitSprites();
    const { JustDown } = Phaser.Input.Keyboard;
    const { dx, dy } = this.readArrowKeys(delta);
    const pointer = this.drainPointerInput();
    const confirm = JustDown(this.actionKeys.confirm) || JustDown(this.actionKeys.confirmAlt) || pointer.confirm;
    const cancel = JustDown(this.actionKeys.cancel) || JustDown(this.actionKeys.cancelAlt) || pointer.cancel;
    const info = JustDown(this.infoKey);
    // Only shading, so it toggles even while the enemy phase plays out.
    if (JustDown(this.actionKeys.dangerZone)) this.toggleDangerZone();
    if (JustDown(this.actionKeys.autoPlay)) this.toggleAutoPlay();

    // Confirm cuts a banner, XP bar or level up short, even mid-animation.
    if (confirm && this.skipWait()) return;
    if (this.inputLocked) return;
    if (this.updateAutoPlay(delta)) return;

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

    if (this.rosterScreen) {
      this.updateRosterScreen(dx, dy, confirm, cancel);
      return;
    }

    if (this.merchantScreen) {
      this.updateMerchantScreen(dx, dy, confirm, cancel);
      return;
    }

    if (this.promotionScreen) {
      this.updatePromotionScreen(dy, confirm, cancel);
      return;
    }

    if (this.mentorScreen) {
      this.updateMentorScreen(dx, dy, confirm, cancel);
      return;
    }

    if (this.campMenu) {
      this.updateCampMenu(dy, confirm);
      return;
    }

    if (this.rewardMenu) {
      // The cards sit side by side, so either arrow axis moves the pick.
      this.updateRewardMenu(dx || dy, confirm && this.time.now >= this.rewardPickOpensAt);
      return;
    }

    if (this.battleOutcome) {
      if (confirm) this.openStagePick();
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
      if (cancel && this.rangeMode === 'attack' && this.attackFromMove) {
        // An attack picked straight from the move range backs out all the
        // way to choosing where to move, taking its equip back with the move.
        this.attackFromMove = false;
        this.hideRange();
        this.undoMove();
        this.showMoveRange();
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
      this.activeUnit = { unitId, x: this.cursor.x, y: this.cursor.y };
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
      const canUndo = undoLastAction(this.history) !== null;
      this.publishMenu('pauseMenu', createActionMenu(getPauseActions({ canUndo })));
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
        this.finishPlayerAction(this.dispatch({ type: 'wait', unitId }));
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
    const hasSkills = getUnitSkills(unit).length > 0;
    const hasItems = getConsumables(unit.items).length > 0;
    const canHeal = getStaves(unit.items).length > 0 ? this.findHealingStaff() !== null : undefined;
    const actions = getUnitActions({ hasSkills, hasItems, hasWeapons, canHeal });
    const { x, y } = this.activeUnit!;
    const hasTarget = unit.wieldableWeapons.some(
      ({ weapon }) => this.getWeaponTargets(unit, { x, y }, weapon).length > 0,
    );
    this.publishMenuAnchor();
    this.setActionMenu(selectIndex(createActionMenu(actions), getDefaultActionIndex(actions, { hasTarget })));
  }

  // The wounded allies the active unit's staff reaches from where it stands.
  getHealTargetsFor(staff: Staff) {
    const { unit, unitId, x, y } = this.activeUnit!;
    const canHeal = (otherId: string) => {
      const other = this.units.get(otherId);
      return otherId !== unitId && other !== undefined && areAllied(other.team, unit.team) && isWounded(other);
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
      const { unitId, x, y } = this.activeUnit!;
      this.dispatch({ type: 'equip', unitId, index: action.index });
      this.syncShown();
      this.setCursor(x, y);
      this.showAttackRange();
      return;
    }

    if (dy !== 0) this.publishMenu('weaponMenu', moveSelection(this.weaponMenu!, dy));
  }

  openSkillMenu() {
    const { unit } = this.activeUnit!;
    const skills = getUnitSkills(unit);
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
      const { unit, unitId, x, y } = this.activeUnit!;
      this.activeSkill = findUnitSkill(unit, skill.id);
      // A healing skill's reach shows in green, like a staff's.
      const healing = isHealingSkill(this.activeSkill!);
      this.showRange(
        'skill',
        getAttackRange(this.grid, { x, y }, this.activeSkill!.range),
        healing ? HEAL_RANGE_COLOR : SKILL_RANGE_COLOR,
        healing ? HEAL_RANGE_ALPHA : SKILL_RANGE_ALPHA,
      );
      const [first] = getSkillTargets(this.grid, this.units, unitId, { x, y }, this.activeSkill!);
      if (first) this.setCursor(first.x, first.y);
      else this.setCursor(x, y);
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
    return toTileAnchorView(tile, CELL, camera, this.scale.gameSize);
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
  // hands over to the enemy phase, Undo takes the last player action back,
  // Main Menu leaves the battle for the title screen. Settings isn't built
  // yet.
  updatePauseMenu(dy: number, confirm: boolean, cancel: boolean) {
    if (cancel) {
      this.publishMenu('pauseMenu', null);
      return;
    }

    if (confirm) {
      const action = getSelectedAction(this.pauseMenu!);
      if (action?.disabled) return;
      if (action?.id === 'end-turn') this.endPlayerPhase();
      else if (action?.id === 'undo') this.undoLastPlayerAction();
      else if (action?.id === 'main-menu') this.exitToTitle();
      else console.info(`Pause action selected: ${action?.id}`);
      return;
    }

    if (dy !== 0) this.publishMenu('pauseMenu', moveSelection(this.pauseMenu!, dy));
  }

  // ---- Rewards ----------------------------------------------------------
  // After a won Warband stage's result, the reward screen offers a few
  // rewards (src/game/warband/rewards.ts) and the player takes one, or
  // skips them for a little gold: it's applied to the run, which is saved,
  // and the next stage starts. Rerolling spends gold for new offers and
  // keeps the screen up.

  // After a won stage's result: the first pick it owes (its boons, its
  // guest's recruitment, then its reward), or the next battle.
  openStagePick() {
    if (this.boonRun) this.openBoonMenu();
    else if (this.recruitOffer) this.openRecruitMenu();
    else if (this.rewardOffer) this.openRewardMenu();
    else if (this.campAfterOutcome) this.openCamp(this.campAfterOutcome);
    else this.leaveBattle();
  }

  // Reopens the boon picks a run saved before them owes, with the stage's
  // clear when a reward pick follows.
  resumeBoonPicks(run: RunState) {
    this.setCursorVisible(false);
    this.boonRun = run;
    const pending = run.pendingReward;
    if (pending) {
      gameStore.setState({
        stageClear: toStageClearView(pending.stage, { gold: pending.clearGold, flawless: pending.flawless }, run.gold),
      });
    }
    this.openBoonMenu();
  }

  // The level-up screen for a level up's boon pick: an entry per boon,
  // with whose level up it is. It holds off confirming while its level-up
  // effect plays, so a held Enter can't take a boon unseen.
  openBoonMenu() {
    const run = this.boonRun!;
    const offer = getBoonOffer(run)!;
    gameStore.setState({ boonPick: toBoonPickView(offer, run.relics), rewardTeam: toTeamView(run.roster) });
    this.publishMenu('rewardMenu', createActionMenu(toBoonActions(offer, run.relics)));
    this.rewardPickOpensAt = this.time.now + BOON_PICK_GRACE_MS;
  }

  updateBoonMenu(delta: number, confirm: boolean) {
    if (!confirm) {
      if (delta !== 0) this.publishMenu('rewardMenu', moveSelection(this.rewardMenu!, delta));
      return;
    }
    const result = tryRunCommand(
      { run: this.boonRun!, phase: 'boon' },
      { type: 'pick-boon', index: this.rewardMenu!.selectedIndex },
    );
    if (!result) return;
    const { run, phase } = result.session;
    saveRun(run);
    if (phase === 'boon') {
      this.boonRun = run;
      this.openBoonMenu();
      return;
    }
    this.boonRun = null;
    gameStore.setState({ boonPick: null });
    // The picks after the boons are rolled from the run with them taken.
    if (phase === 'recruit') this.resumeRecruitment(run);
    else if (phase === 'reward') this.resumeRewardPick(run, getPendingRewardOffer(run)!);
    else this.openCamp(run);
  }

  // Reopens the reward screen for a run saved before its pick (see
  // getPendingRewardOffer), with the same offers and the stage's clear.
  resumeRewardPick(run: RunState, pending: PendingReward & { rewards: readonly Reward[] }) {
    this.setCursorVisible(false);
    this.rewardOffer = { run, stage: pending.stage, rewards: pending.rewards, rerolls: pending.rerolls };
    // A shrine's pick is its blessing, not a stage's spoils.
    const at = getRunSite(run);
    const blessing = at?.kind === 'shrine' && at.depth === pending.stage ? at.name : null;
    gameStore.setState({
      stageClear: toStageClearView(
        pending.stage,
        { gold: pending.clearGold, flawless: pending.flawless },
        run.gold,
        blessing,
      ),
    });
    this.openRewardMenu();
  }

  // Opens the guest's recruitment, or with no guest owed, the draft a
  // Recruit reward opened (see warband/recruitment.ts).
  resumeRecruitment(run: RunState) {
    this.setCursorVisible(false);
    const draft = !run.pendingGuest;
    const stage = draft ? run.pendingDraft! : run.pendingRecruitment!;
    const session = { run, phase: 'recruit' as const };
    this.recruitOffer = { run, stage, recruits: getRecruitOffers(session), draft };
    const pending = run.pendingReward;
    if (pending) {
      this.rewardOffer = {
        run,
        stage: pending.stage,
        rewards: getPendingRewardOffer(run)!.rewards,
        rerolls: pending.rerolls,
      };
      gameStore.setState({
        stageClear: toStageClearView(stage, { gold: pending.clearGold, flawless: pending.flawless }, run.gold),
      });
    }
    this.openRecruitMenu();
  }

  openRecruitMenu() {
    const { run, stage, recruits, draft } = this.recruitOffer!;
    gameStore.setState({ recruitmentStage: stage, recruitDraft: draft, rewardTeam: toTeamView(run.roster) });
    this.publishMenu(
      'rewardMenu',
      createActionMenu([
        ...recruits.map((recruit, index) => toRewardAction(recruit, index)),
        {
          id: 'decline',
          kind: 'decline',
          label: 'Decline',
          description: draft ? 'Continue without recruiting anyone.' : 'Continue without recruiting the guest.',
          stats: null,
          healthAfter: null,
        },
      ]),
    );
  }

  openRewardMenu(selectedIndex = 0) {
    const { run, stage, rewards, rerolls } = this.rewardOffer!;
    const actions = toRewardMenuActions(rewards, {
      skipGold: getSkipGold(stage),
      rerollCost: getRerollCost(rerolls),
      run,
    });
    gameStore.setState({ rewardTeam: toTeamView(run.roster) });
    this.publishMenu('rewardMenu', selectIndex(createActionMenu(actions), selectedIndex));
  }

  updateRewardMenu(delta: number, confirm: boolean) {
    if (this.boonRun) {
      this.updateBoonMenu(delta, confirm);
      return;
    }
    if (this.recruitOffer) {
      if (confirm) {
        const { run } = this.recruitOffer;
        const index = this.rewardMenu!.selectedIndex;
        const command: RunCommand =
          this.rewardMenu!.actions[index].kind === 'decline'
            ? { type: 'decline-recruit' }
            : { type: 'pick-recruit', index };
        const result = tryRunCommand({ run, phase: 'recruit' }, command);
        if (!result) return;
        saveRun(result.session.run);
        this.recruitOffer = null;
        gameStore.setState({ recruitmentStage: null, recruitDraft: false });
        if (result.session.phase === 'reward') {
          const pending = result.session.run.pendingReward!;
          this.rewardOffer = {
            run: result.session.run,
            stage: pending.stage,
            rewards: getRewardOffers(result.session),
            rerolls: pending.rerolls,
          };
          this.openRewardMenu();
        } else this.openCamp(result.session.run);
        return;
      }
      if (delta !== 0) this.publishMenu('rewardMenu', moveSelection(this.rewardMenu!, delta));
      return;
    }
    if (confirm) {
      const offer = this.rewardOffer!;
      const action = this.rewardMenu!.actions[this.rewardMenu!.selectedIndex];
      if (action.disabled) return;
      const session = { run: offer.run, phase: 'reward' as const };
      if (action.kind === 'reroll') {
        const rerolled = tryRunCommand(session, { type: 'reroll-rewards' });
        if (!rerolled) return;
        const { run } = rerolled.session;
        saveRun(run);
        this.rewardOffer = { ...offer, run, rewards: getRewardOffers(rerolled.session), rerolls: offer.rerolls + 1 };
        const stageClear = gameStore.getState().stageClear;
        if (stageClear) gameStore.setState({ stageClear: { ...stageClear, totalGold: run.gold } });
        this.openRewardMenu(this.rewardMenu!.selectedIndex);
        return;
      }
      const command: RunCommand =
        action.kind === 'skip'
          ? { type: 'skip-reward' }
          : { type: 'pick-reward', index: this.rewardMenu!.selectedIndex };
      const result = tryRunCommand(session, command);
      if (!result) return;
      const after = result.session.run;
      saveRun(after);
      this.rewardOffer = null;
      // A Recruit reward opens its draft.
      if (result.session.phase === 'recruit') {
        this.resumeRecruitment(after);
        return;
      }
      if (result.session.phase !== 'boon') {
        this.openCamp(after);
        return;
      }
      this.boonRun = after;
      this.openBoonMenu();
      return;
    }
    if (delta !== 0) this.publishMenu('rewardMenu', moveSelection(this.rewardMenu!, delta));
  }

  // ---- Camp -------------------------------------------------------------
  // Once a won Warband stage's reward is taken, the camp (see
  // src/game/warband/camp.ts) offers Manage Roster, which opens the roster
  // screen (src/game/warband/rosterScreen.ts) to equip units and move items
  // to and from the convoy; Merchant, which opens the merchant screen
  // (src/game/warband/merchantScreen.ts) to buy into and sell from the
  // convoy; Promote, which opens the promotion screen
  // (src/game/warband/promotionScreen.ts) to spend a Master Seal on a
  // unit; Rest, a full heal for gold; Mentors, which opens the mentor
  // screen (src/game/warband/mentorScreen.ts) to learn secondary skill
  // sets; and Next Stage. Every change at camp is saved straight away.

  openCamp(run: RunState) {
    this.inputLocked = false;
    this.publishMenu('rewardMenu', null);
    gameStore.setState({ rewardTeam: null });
    this.setCampRun(run);
  }

  // Keeps `run` as the camp's run, saving it when it changed, and
  // republishes the camp menu (Rest's state and the gold follow the run),
  // keeping its highlight; it opens on Next Stage, so moving straight on
  // is one confirm.
  setCampRun(run: RunState) {
    if (this.campRun && run !== this.campRun) saveRun(run);
    this.campRun = run;
    const actions = getCampActions(run);
    const selected = this.campMenu?.selectedIndex ?? actions.findIndex((action) => action.id === 'march');
    this.publishMenu('campMenu', selectIndex(createActionMenu(actions), selected));
    gameStore.setState({ campGold: run.gold, campRelics: toRelicViews(run.relics) });
  }

  updateCampMenu(dy: number, confirm: boolean) {
    if (confirm) {
      const action = getSelectedAction(this.campMenu!);
      if (!action || action.disabled) return;
      if (action.id === 'roster') {
        this.publishRosterScreen(openRosterScreen(this.campRun!));
      } else if (action.id === 'merchant') {
        this.publishMerchantScreen(openMerchantScreen(this.campRun!));
      } else if (action.id === 'promote') {
        this.publishPromotionScreen(openPromotionScreen(this.campRun!));
      } else if (action.id === 'mentors') {
        this.publishMentorScreen(openMentorScreen(this.campRun!));
      } else if (action.id === 'rest') {
        const rested = tryRunCommand({ run: this.campRun!, phase: 'camp' }, { type: 'rest' });
        if (rested) this.setCampRun(rested.session.run);
      } else if (action.id === 'march') {
        this.marchOn();
      }
      return;
    }
    if (dy !== 0) this.publishMenu('campMenu', moveSelection(this.campMenu!, dy));
  }

  // The real time since the play clock last started (on create(), or the
  // last call), restarting it: what a Warband run adds to its play time.
  takePlayTime(): number {
    const now = Date.now();
    const elapsed = now - this.playClockFrom;
    this.playClockFrom = now;
    return elapsed;
  }

  // Next Stage: leaves camp for the run's next stage; on the realm, Travel
  // saves the run and opens the overworld to choose where to go.
  marchOn() {
    const marched = tryRunCommand({ run: this.campRun!, phase: 'camp' }, { type: 'march' });
    if (!marched) return;
    // The time spent at camp counts toward the run's play time.
    const run = {
      ...marched.session.run,
      chronicle: addPlayTime(marched.session.run.chronicle ?? EMPTY_CHRONICLE, this.takePlayTime()),
    };
    if (marched.session.phase === 'travel') {
      this.inputLocked = true;
      enterRun(run);
      return;
    }
    this.nextBattle = runStage(run);
    this.leaveBattle();
  }

  updateRosterScreen(dx: number, dy: number, confirm: boolean, cancel: boolean) {
    const state = this.rosterScreen!;
    if (cancel) {
      this.publishRosterScreen(cancelRoster(state));
    } else if (confirm) {
      this.publishRosterScreen(confirmRoster(state));
    } else if (dx !== 0 || dy !== 0) {
      this.publishRosterScreen(moveRosterCursor(state, dx, dy));
    }
  }

  // Shows the roster screen in `state` (or closes it, back to the camp,
  // for null), saving the run whenever it changed.
  publishRosterScreen(state: RosterScreenState | null) {
    if (state === this.rosterScreen) return;
    if (state && state.run !== this.campRun) this.setCampRun(state.run);
    this.rosterScreen = state;
    gameStore.setState({ rosterScreen: state && toRosterScreenView(state) });
  }

  updateMerchantScreen(dx: number, dy: number, confirm: boolean, cancel: boolean) {
    const state = this.merchantScreen!;
    if (cancel) {
      this.publishMerchantScreen(cancelMerchant(state));
    } else if (confirm) {
      this.publishMerchantScreen(confirmMerchant(state));
    } else if (dx !== 0 || dy !== 0) {
      this.publishMerchantScreen(moveMerchantCursor(state, dx, dy));
    }
  }

  // Shows the merchant screen in `state` (or closes it, back to the camp,
  // for null), saving the run whenever a purchase or sale changed it.
  publishMerchantScreen(state: MerchantScreenState | null) {
    if (state === this.merchantScreen) return;
    if (state && state.run !== this.campRun) this.setCampRun(state.run);
    this.merchantScreen = state;
    gameStore.setState({ merchantScreen: state && toMerchantScreenView(state) });
  }

  updatePromotionScreen(dy: number, confirm: boolean, cancel: boolean) {
    const state = this.promotionScreen!;
    if (cancel) {
      this.publishPromotionScreen(cancelPromotion());
    } else if (confirm) {
      this.publishPromotionScreen(confirmPromotion(state));
    } else if (dy !== 0) {
      this.publishPromotionScreen(movePromotionCursor(state, dy));
    }
  }

  // Shows the promotion screen in `state` (or closes it, back to the camp,
  // for null), saving the run whenever a promotion changed it. It closes
  // by itself once nobody is left to promote.
  publishPromotionScreen(state: PromotionScreenState | null) {
    if (state === this.promotionScreen) return;
    if (state && state.run !== this.campRun) this.setCampRun(state.run);
    const open = state && !isPromotionScreenDone(state) ? state : null;
    this.promotionScreen = open;
    gameStore.setState({ promotionScreen: open && toPromotionScreenView(open) });
  }

  updateMentorScreen(dx: number, dy: number, confirm: boolean, cancel: boolean) {
    const state = this.mentorScreen!;
    if (cancel) {
      this.publishMentorScreen(cancelMentor(state));
    } else if (confirm) {
      this.publishMentorScreen(confirmMentor(state));
    } else if (dx !== 0 || dy !== 0) {
      this.publishMentorScreen(moveMentorCursor(state, dx, dy));
    }
  }

  // Shows the mentor screen in `state` (or closes it, back to the camp, for
  // null), saving the run whenever a lesson changed it.
  publishMentorScreen(state: MentorScreenState | null) {
    if (state === this.mentorScreen) return;
    if (state && state.run !== this.campRun) this.setCampRun(state.run);
    this.mentorScreen = state;
    gameStore.setState({ mentorScreen: state && toMentorScreenView(state) });
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
  // Before a battle without deployment (after the opening dialog) React
  // shows what wins and loses it; confirm or cancel dismisses it and the
  // level carries on. With deployment, the deployment menu shows it instead.

  showObjective(onDone: () => void) {
    this.onObjectiveDone = onDone;
    gameStore.setState({ objective: this.getObjectiveView() });
  }

  getObjectiveView() {
    return toObjectiveView(describeBattle(this.setup, this.content), describeObjective(this.objective));
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
    gameStore.setState({
      phase: 'deployment',
      deploymentLimit: this.deploymentLimit,
      deploymentObjective: this.getObjectiveView(),
    });
    this.zoneTiles = this.drawTileHighlights(this.deploymentZone, DEPLOYMENT_ZONE_COLOR, DEPLOYMENT_ZONE_ALPHA);
    // The cursor stays hidden while a deployment menu has input; it only
    // appears once there's a tile to choose.
    this.setCursorVisible(false);
    // Everyone starts placed the way the player battle AI would place them
    // (src/game/battle/playerAI.ts), so Start is one confirm away; Place
    // Units still moves or swaps them.
    for (const command of planPlayerDeployment(this.battle)) {
      if (command.type === 'place') this.placeUnit(command.unitId, command.to);
    }
    this.openDeploymentMenu(canStartBattle(this.grid, this.roster) ? START_INDEX : PLACE_UNITS_INDEX);
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
        disabled: !canPickToDeploy(this.grid, this.roster, this.deploymentLimit, id),
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
    if (!canDeployUnitAt(this.grid, this.deploymentZone, this.roster, this.deploymentLimit, unitId, x, y)) return;

    this.placeUnit(unitId, { x, y });
    this.placingUnitId = null;
    this.setCursorVisible(false);
    // Only jump to Start once every slot is filled; until then, stay on
    // Place Units so the next unit is one confirm away.
    const complete = isDeploymentComplete(this.grid, this.roster, this.deploymentLimit);
    this.openDeploymentMenu(complete ? START_INDEX : PLACE_UNITS_INDEX);
  }

  // Puts a roster unit on a zone tile, and the sprites with it: a roster
  // unit it swapped with moves to where it stood, or off the map when it
  // took that unit's place.
  placeUnit(unitId: string, { x, y }: Point) {
    this.dispatch({ type: 'place', unitId, to: { x, y } });
    this.syncShown();
    this.refreshThreats();
    for (const id of this.roster) {
      const at = findUnit(this.grid, id);
      const sprite = this.unitSprites.get(id);
      if (!at) {
        if (sprite) this.removeUnitSprite(id);
      } else if (sprite) {
        const pos = getStandingPosition(at.x, at.y);
        sprite.setPosition(pos.x, pos.y);
      } else {
        this.addUnitSprite(id, at.x, at.y);
      }
    }
  }

  // Ends deployment: clears the zone, drops roster units left off the map
  // (they sit this battle out), and starts turn 1.
  startBattle() {
    for (const tile of this.zoneTiles ?? []) tile.destroy();
    this.zoneTiles = null;
    this.publishMenu('deploymentMenu', null);
    this.phase = 'battle';
    gameStore.setState({ phase: 'battle', deploymentStep: null, deploymentLimit: null, deploymentObjective: null });

    const events = this.dispatch({ type: 'start-battle' });
    this.setCursorVisible(true);
    this.continueBattle(events, () => {});
  }

  // ---- Auto play --------------------------------------------------------
  // With Auto on (the header button or A), the battle and the run play
  // themselves on screen: the player battle AI (src/game/battle/playerAI.ts)
  // deploys and takes the player's turns, the run policy
  // (src/game/warband/runPolicy.ts) picks rewards and spends the camp
  // through the same run commands the menus give, dialogs are skipped and
  // screens move on, one step every AUTO_STEP_MS. It stays on from battle
  // to battle (it lives in the store); turning it off hands control back
  // before the next step.

  toggleAutoPlay() {
    const autoPlay = !gameStore.getState().autoPlay;
    gameStore.setState({ autoPlay });
    if (!autoPlay) this.queueAutoCommands([]);
    this.applyAutoSpeed();
    this.autoElapsed = 0;
  }

  changeAutoSpeed(direction: -1 | 1) {
    gameStore.setState((state) => ({ autoSpeed: changeAutoSpeed(state.autoSpeed, direction) }));
    this.applyAutoSpeed();
  }

  cycleAutoSpeed() {
    gameStore.setState((state) => ({ autoSpeed: cycleAutoSpeed(state.autoSpeed) }));
    this.applyAutoSpeed();
  }

  // The speed setting (the header's − and +) plays every animation, banner
  // and pause faster, whether Auto is on or the player is playing.
  applyAutoSpeed() {
    const speed = this.getPlaybackSpeed();
    this.time.timeScale = speed;
    this.tweens.timeScale = speed;
  }

  getPlaybackSpeed() {
    return this.preview ? 1 : gameStore.getState().autoSpeed;
  }

  playbackDuration(durationMs: number) {
    return durationMs / this.getPlaybackSpeed();
  }

  // Takes auto play's next step once one is due. True when auto play owns
  // this frame's input; false when it's off or has nothing to do here (the
  // pause menu or unit info is open, or the player is midway through a
  // unit's action), leaving input to the player.
  updateAutoPlay(delta: number): boolean {
    if (!gameStore.getState().autoPlay || this.preview) return false;
    const step = this.getAutoStep();
    if (!step) return false;
    this.autoElapsed += delta * gameStore.getState().autoSpeed;
    if (this.autoElapsed < AUTO_STEP_MS) return true;
    this.autoElapsed = 0;
    step();
    return true;
  }

  // What auto play does next where the scene stands, or null for nothing.
  getAutoStep(): (() => void) | null {
    if (this.pauseMenu || this.unitInfoUnit) return null;
    if (this.dialog) return () => this.updateDialog(false, true);
    if (this.onObjectiveDone) return () => this.hideObjective();
    if (this.rosterScreen) return () => this.publishRosterScreen(null);
    if (this.merchantScreen) return () => this.publishMerchantScreen(null);
    if (this.promotionScreen) return () => this.publishPromotionScreen(null);
    if (this.mentorScreen) return () => this.publishMentorScreen(null);
    if (this.campMenu) return () => this.autoCamp();
    if (this.rewardMenu) return () => this.autoReward();
    if (this.battleOutcome) return () => this.openStagePick();
    if (this.phase === 'deployment') return () => this.autoDeploy();
    const choosing = this.activeUnit || this.actionMenu || this.weaponMenu || this.skillMenu || this.itemMenu;
    if (this.turnState?.team === 'player' && !choosing) {
      if (this.pendingAutoCommands.length === 0) this.queueAutoCommands(planPlayerTurn(this.battle));
      return () => this.autoPlayerAction();
    }
    return null;
  }

  autoDeploy() {
    this.publishMenu('rosterMenu', null);
    this.placingUnitId = null;
    for (const command of planPlayerDeployment(this.battle)) {
      if (command.type === 'place') this.placeUnit(command.unitId, command.to);
      else this.startBattle();
    }
  }

  // One player unit's action, played out like an enemy's; input stays
  // locked until it has, and the next step comes after AUTO_STEP_MS.
  autoPlayerAction() {
    const [move, act] = this.pendingAutoCommands;
    if (!move || !act) return;
    this.hideEnemyReach();
    this.hideRange();
    this.inputLocked = true;
    this.takeEnemyAction(move, act, () => {
      this.inputLocked = false;
    });
  }

  autoReward() {
    if (this.boonRun) {
      const command = pickBoonOffer({ run: this.boonRun, phase: 'boon' });
      if (command.type !== 'pick-boon') return;
      this.publishMenu('rewardMenu', selectIndex(this.rewardMenu!, command.index));
      this.updateRewardMenu(0, true);
      return;
    }
    if (this.recruitOffer) {
      this.publishMenu('rewardMenu', selectIndex(this.rewardMenu!, 0));
      this.updateRewardMenu(0, true);
      return;
    }
    const offer = this.rewardOffer!;
    const command = pickReward({ run: offer.run, phase: 'reward' });
    // The menu lists the offers, then Skip, then Reroll.
    const index =
      command.type === 'pick-reward'
        ? command.index
        : command.type === 'skip-reward'
          ? offer.rewards.length
          : offer.rewards.length + 1;
    this.publishMenu('rewardMenu', selectIndex(this.rewardMenu!, index));
    this.updateRewardMenu(0, true);
  }

  autoCamp() {
    const command = planCamp({ run: this.campRun!, phase: 'camp' });
    if (command.type === 'march') {
      this.marchOn();
      return;
    }
    const applied = tryRunCommand({ run: this.campRun!, phase: 'camp' }, command);
    if (applied) this.setCampRun(applied.session.run);
    else this.marchOn();
  }

  // ---- Turns ------------------------------------------------------------
  // Each turn opens with a guest phase while any guest is on the map, then
  // a player phase, then an enemy phase (rules in src/game/turns.ts). The
  // guest and enemy phases run on their own, each unit acting in turn with
  // the plan from src/game/enemyAI.ts. In the player phase each unit may
  // move, then act (attack, skill, or wait); acting finishes it and greys
  // it out, and once all are finished the enemy phase begins. After every
  // action the battle checks for victory or defeat.

  // After a command's events have played out: shows the battle as it now
  // stands, then the result if the command decided the battle, the next
  // phase if it began one, or else `otherwise` (input back to the player,
  // or the next enemy).
  continueBattle(events: readonly BattleEvent[], otherwise: () => void) {
    this.syncShown();
    this.refreshDoneTints();
    this.refreshThreats();
    this.updateHoveredUnit();
    const { outcome } = this.battle;
    if (outcome) {
      this.showOutcome(outcome);
      return;
    }
    this.showBossCalls(events);
    if (findEvent(events, 'phase-started')) {
      this.showPhaseRecoveries(events);
      this.startPhase();
      return;
    }
    otherwise();
  }

  // Shows what a boss's horn did as the enemy phase started (see
  // bosses.ts), over the map as it now stands: the horn over the boss, a
  // goblin arriving on its marked tile, or whoever stood there blocking it.
  showBossCalls(events: readonly BattleEvent[]) {
    for (const event of events) {
      if (event.type === 'reinforced' && !this.unitSprites.has(event.unitId)) {
        this.addUnitSprite(event.unitId, event.at.x, event.at.y);
        this.showDamagePopup(this.unitSprites.get(event.unitId)!, 0, 'arrived');
      }
      if (event.type === 'reinforcement-blocked' && event.blockerId) {
        const sprite = this.unitSprites.get(event.blockerId);
        if (sprite) this.showDamagePopup(sprite, 0, 'blocked');
      }
      if (event.type === 'war-horn') {
        const sprite = this.unitSprites.get(event.unitId);
        if (sprite) this.showDamagePopup(sprite, 0, 'horn');
      }
    }
  }

  // The boss's name card (see toBossIntroView) on a boss stage, input
  // locked until it's gone or confirm cuts it short; then `onDone`. Any
  // other stage goes straight on.
  showBossIntro(onDone: () => void) {
    const intro = toBossIntroView({
      id: this.nextBannerId++,
      objective: this.objective,
      durationMs: this.playbackDuration(BOSS_INTRO_DURATION_MS),
    });
    if (!intro) {
      onDone();
      return;
    }
    this.inputLocked = true;
    gameStore.setState({ bossIntro: intro });
    this.waitSkippably(BOSS_INTRO_DURATION_MS, () => {
      gameStore.setState({ bossIntro: null });
      this.inputLocked = false;
      onDone();
    });
  }

  // Publishes the boss's HP bar (see toBossBarView) as the map shows it,
  // a hit ahead of the battle included; nothing in a preview.
  publishBossBar() {
    const { objective, boss } = this.shown;
    const bossId = objective.kind === 'boss' ? objective.unitId : null;
    const unit = bossId ? this.units.get(bossId) : undefined;
    const health = (bossId ? this.shownStats.get(bossId)?.health : undefined) ?? unit?.health;
    const bar = this.preview ? null : toBossBarView(objective, boss, unit, health);
    if (!isSameBossBar(bar, gameStore.getState().bossBar)) gameStore.setState({ bossBar: bar });
  }

  // Marks the tile the boss's horn marked for its next arrival, as the map
  // shows the battle, and takes the marker down once it's spent.
  refreshIncomingMarker() {
    const tile = this.shown.boss?.incoming ?? null;
    const key = tile ? `${tile.x},${tile.y}` : null;
    if (key === this.incomingMarkerKey) return;
    if (this.incomingMarker) {
      this.tweens.killTweensOf(this.incomingMarker);
      this.incomingMarker.destroy();
    }
    this.incomingMarker = null;
    this.incomingMarkerKey = key;
    if (!tile) return;
    const { x, y } = gridToWorld(tile.x, tile.y, CELL);
    this.incomingMarker = this.add
      .rectangle(x, y, CELL.width, CELL.height, INCOMING_TILE_COLOR, INCOMING_TILE_ALPHA)
      .setOrigin(0, 0)
      .setStrokeStyle(2 * GRID_PX, INCOMING_TILE_COLOR)
      .setDepth(0.42);
    this.tweens.add({
      targets: this.incomingMarker,
      alpha: { from: 1, to: 0.35 },
      duration: INCOMING_TILE_PULSE_MS,
      yoyo: true,
      repeat: -1,
    });
  }

  // Pops up the HP and MP units recovered as the phase started (a Mending
  // Charm, a Regeneration boon), over the map as it now stands.
  showPhaseRecoveries(events: readonly BattleEvent[]) {
    for (const event of events) {
      if (event.type !== 'recovered' || event.trigger !== 'phase') continue;
      const sprite = this.unitSprites.get(event.unitId);
      if (sprite) this.showDamagePopup(sprite, event.amount, event.stat);
    }
  }

  // Announces the phase the battle is in with a banner (input locked
  // meanwhile), then either hands input to the player or runs the AI's
  // units (the enemies, or the guests).
  startPhase() {
    const turnState = this.turnState!;
    this.hideEnemyReach();
    for (const sprite of this.unitSprites.values()) sprite.clearTint();
    gameStore.setState({
      turn: toTurnView(turnState),
      objectiveStatus: getObjectiveStatus(this.objective, turnState.turn),
    });

    this.inputLocked = true;
    this.showPhaseBanner(turnState, () => {
      if (turnState.team !== 'player') {
        this.runEnemyPhase();
        return;
      }
      this.playTriggeredDialog(turnTrigger(turnState.turn), () => this.handPlayerControl());
    });
  }

  handPlayerControl() {
    const first = findUnit(this.grid, this.roster[0]);
    if (first) this.setCursor(first.x, first.y);
    this.inputLocked = false;
  }

  showPhaseBanner(turnState: TurnState, onDone: () => void) {
    const banner = toPhaseBannerView({
      id: this.nextBannerId++,
      turnState,
      durationMs: this.playbackDuration(PHASE_BANNER_DURATION_MS),
    });
    gameStore.setState({ phaseBanner: banner });
    this.waitSkippably(PHASE_BANNER_DURATION_MS, () => {
      gameStore.setState({ phaseBanner: null });
      onDone();
    });
  }

  // Greys out the units that are done for the phase, and only them.
  refreshDoneTints() {
    const { turnState } = this;
    for (const [unitId, sprite] of this.unitSprites) {
      if (turnState && isDone(turnState, unitId)) sprite.setTint(DONE_TINT);
      else sprite.clearTint();
    }
  }

  // Called once a player unit's action (its command's `events`) has fully
  // played out: ends the battle or the phase if that action decided it,
  // else hands input back.
  finishPlayerAction(events: readonly BattleEvent[]) {
    this.inputLocked = false;
    this.continueBattle(events, () => {});
  }

  // Ends the player phase early from the pause menu: any units that haven't
  // acted simply forfeit their action, and the enemy phase begins.
  endPlayerPhase() {
    this.publishMenu('pauseMenu', null);
    this.continueBattle(this.dispatch({ type: 'end-phase' }), () => {});
  }

  // Takes the last player action back (undoLastAction in
  // src/game/battle/history.ts), along with the enemy phase if one
  // followed it, and redraws the map as it was then.
  undoLastPlayerAction() {
    const rewound = undoLastAction(this.history);
    if (!rewound) return;
    this.publishMenu('pauseMenu', null);
    this.history = rewound;
    this.syncShown();
    this.hideEnemyReach();
    for (const sprite of this.unitSprites.values()) sprite.destroy();
    this.renderUnits(this.grid);
    this.refreshDoneTints();
    this.refreshThreats();
    const turnState = this.turnState!;
    gameStore.setState({
      turn: toTurnView(turnState),
      objectiveStatus: getObjectiveStatus(this.objective, turnState.turn),
    });
    this.updateHoveredUnit();
  }

  teamUnitIds(team: Team): string[] {
    return getTeamUnitIds(this.units, team);
  }

  // Ends the battle once its objective is won or lost (the battle's
  // outcome, see getObjectiveOutcome), publishing the result for React;
  // confirm then returns to the title. The level's [victory] or [defeat]
  // conversation plays before the result.
  showOutcome(outcome: BattleOutcome) {
    this.battleOutcome = outcome;
    this.inputLocked = false;
    this.setCursorVisible(false);
    // Completing the objective moves on to the next chapter or stage.
    let runOver: RunOverView | null = null;
    let runSummary: RunSummaryView | null = null;
    let stageClear: StageClearView | null = null;
    if (this.setup.mode === 'warband' && this.setup.run) {
      // A run writes the battle back to its roster and saves the next
      // stage, or forgets the run once the warband has fallen or won it. A win pays
      // the clear's gold and rolls the rewards the reward screen offers.
      const before = this.setup.run;
      const result = getRunBattleResult(this.battle, this.takePlayTime());
      const { session: finished } = finishBattleWithEvents(
        { run: before, phase: 'battle' },
        result,
        outcome,
        this.content.regions.finalStage,
      );
      const { run } = finished;
      const ended = finished.phase === 'over' || finished.phase === 'won';
      if (ended) {
        clearSavedRun();
        runOver = toRunOverView(run, finished.phase === 'won');
        // The run's recap, and the renown it earns across runs.
        const summary = summarizeRun(run, finished.phase === 'won');
        const recorded = recordRun(loadMeta(), summary);
        saveMeta(recorded.meta);
        runSummary = toRunSummaryView(summary, recorded);
      } else {
        const clear = getClearGold(before, run.fallen.length - before.fallen.length, {
          kills: countWarbandKills(before, result),
          relics: before.relics,
          heat: getRunHeat(before),
        });
        stageClear = toStageClearView(before.stage, clear, run.gold);
        // The run is saved owing the pick, so a reload reopens the reward
        // screen (resumeRewardPick) instead of skipping it. Boon picks come
        // first, and the recruit and reward picks are set up once they're
        // taken (updateBoonMenu).
        if (finished.phase === 'boon') this.boonRun = run;
        if (finished.phase === 'reward') {
          this.rewardOffer = { run, stage: before.stage, rewards: getRewardOffers(finished), rerolls: 0 };
        }
        if (finished.phase === 'recruit') {
          this.recruitOffer = { run, stage: before.stage, recruits: getRecruitOffers(finished), draft: false };
          gameStore.setState({ recruitmentStage: before.stage, recruitDraft: false });
        }
        saveRun(run);
      }
      // On the realm the next stage is wherever the warband travels, so
      // there's no next battle to name; a win with nothing to pick goes to
      // camp.
      this.nextBattle = ended || isRealmRun(run) ? null : runStage(run);
      if (!ended && finished.phase === 'camp' && isRealmRun(run)) this.campAfterOutcome = run;
    } else {
      this.nextBattle = outcome === 'victory' ? getNextBattle(this.setup, randomSeed()) : null;
    }
    const nextBattle = this.nextBattle && describeBattle(this.nextBattle, this.content);
    this.playTriggeredDialog(outcome, () => {
      gameStore.setState({ battleOutcome: outcome, nextBattle, runOver, runSummary, stageClear });
      // A won stage goes straight on to its recruit or reward pick, which
      // shows the clear's gold itself, rather than stopping on the result.
      // Confirm waits a moment there, so one pressed to hurry the battle's
      // end along doesn't take a reward unseen.
      if (this.boonRun || this.recruitOffer || this.rewardOffer) {
        this.rewardPickOpensAt = this.time.now + REWARD_PICK_GRACE_MS;
        this.openStagePick();
      }
    });
  }

  // Each unit of the phase's AI-played team, the enemy or the guests (in
  // registry order), plans its action (src/game/battle/ai.ts) and carries
  // it out, one after another, until the last one ends the phase.
  runEnemyPhase() {
    const [move, act] = planNextTurn(this.battle);
    if (move && act) {
      if (gameStore.getState().autoPlay) this.queueAutoCommands([move, act]);
      this.takeEnemyAction(move, act);
    }
  }

  // Puts the cursor on the unit, walks it along its planned route, and
  // carries out its act (an attack, or waiting) from the end of it, then
  // `next` (by default the next enemy) unless that decided the battle or
  // ended the phase.
  takeEnemyAction(move: BattleCommand, act: BattleCommand, next: () => void = () => this.runEnemyPhase()) {
    const moved = findEvent(this.dispatch(move), 'moved')!;
    this.setCursor(moved.from.x, moved.from.y);
    this.time.delayedCall(ENEMY_FOCUS_DELAY_MS, () => {
      this.walkSprite(this.unitSprites.get(moved.unitId)!, moved.path, () => {
        this.syncShown();
        this.setCursor(moved.to.x, moved.to.y);
        const events = this.dispatch(act);
        this.playEvents(events, () =>
          this.time.delayedCall(ENEMY_ACTION_DELAY_MS, () => this.continueBattle(events, next)),
        );
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
    const moveRange = getMovementRange(this.grid, from, getPhaseMovement(unit), this.movementOptions(unit));
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
  // Over a hostile unit it can strike from somewhere in its range, the
  // route runs to the tile it would attack from instead (getMoveAttackPlan).
  updateMovePath() {
    const { unit } = this.activeUnit!;
    const to = this.getMoveAttackPlan()?.tile ?? this.cursor;
    const path = extendMovePath(this.grid, this.movePath!, to, unit.movement, this.movementOptions(unit));
    if (path === this.movePath) return;
    this.movePath = path;
    this.drawMoveArrow(path);
  }

  // While choosing where to move, the hostile unit under the cursor if the
  // active unit can strike it after moving, with the tile to strike from
  // and the weapon to use (pickAttackPlan in src/game/attackMove.ts; the
  // equipped weapon is tried first), or null.
  getMoveAttackPlan() {
    const { unit } = this.activeUnit!;
    const unitId = getCell(this.grid, this.cursor.x, this.cursor.y)?.unitId;
    if (!unitId || !this.isHostileTo(unit)(unitId)) return null;
    const weapons = unit.wieldableWeapons;
    const plan = pickAttackPlan(
      this.moveRange!,
      this.movePath!,
      this.cursor,
      weapons.map(({ weapon }) => weapon),
    );
    if (!plan) return null;
    const target: TargetTile = { x: this.cursor.x, y: this.cursor.y, unitId };
    return { tile: plan.tile, weapon: weapons[plan.weaponIndex], target };
  }

  // Draws the arrow pieces from src/game/moveArrow.ts above the range
  // highlight and below units.
  drawMoveArrow(path: readonly Point[]) {
    this.clearMoveArrow();
    this.arrowSprites = getArrowPieces(path).map(({ x, y, piece }) => {
      const pos = gridToWorld(x, y, CELL);
      const frame = getTileFrame(ARROW_TILES[piece], TERRAIN_SHEET.columns);
      return this.addTileSprite(pos.x, pos.y, TERRAIN_SHEET.key, frame).setDepth(0.6);
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

  // While aiming an attack or an offensive skill, publishes the combat
  // forecast (getCombatForecast in src/game/combat.ts, or getSkillForecast
  // in src/game/skills.ts) against the target under the cursor, anchored
  // beside both units for React's CombatForecast to draw; clears it whenever
  // there's no target to forecast.
  updateCombatForecast() {
    if (this.rangeMode === 'attack') {
      const target = this.getAttackTargetUnderCursor();
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
      return;
    }
    if (this.rangeMode === 'skill' && this.activeSkill && !isHealingSkill(this.activeSkill)) {
      const target = this.getSkillTargetUnderCursor();
      if (!target) {
        gameStore.setState({ combatForecast: null });
        return;
      }
      const { unit, x, y } = this.activeUnit!;
      const skill = this.activeSkill;
      const defender = this.units.get(target.unitId)!;
      const push = skill.push ? getPushResult(this.grid, this.units, target, getPushDirection({ x, y }, target)) : null;
      const forecast = getSkillForecast(skill, unit, defender, push);
      const anchor = mergeTileAnchors(this.getTileAnchor({ x, y }), this.getTileAnchor(target));
      const attacker = { name: unit.name, team: unit.team, rank: unit.rank, weapon: { label: skill.label, id: null } };
      gameStore.setState({ combatForecast: toCombatForecastView({ forecast, attacker, defender, anchor }) });
      return;
    }
    gameStore.setState({ combatForecast: null });
  }

  showRange(mode: RangeMode, tiles: readonly Point[], color: number, alpha: number) {
    this.rangeMode = mode;
    this.rangeTiles = this.drawTileHighlights(tiles, color, alpha);
  }

  // Draws a translucent square over each tile, under units and the cursor.
  // Returns the rectangles so the caller can destroy them later.
  drawTileHighlights(tiles: readonly Point[], color: number, alpha: number) {
    return tiles.map((tile) => {
      const pos = gridToWorld(tile.x, tile.y, CELL);
      return this.add.rectangle(pos.x, pos.y, CELL.width, CELL.height, color, alpha).setOrigin(0, 0).setDepth(0.5);
    });
  }

  hideRange() {
    for (const tile of this.rangeTiles ?? []) tile.destroy();
    this.rangeTiles = null;
    this.rangeMode = null;
    this.activeSkill = null;
    this.activeStaff = null;
    this.updateCombatForecast();
    this.updatePushPreview();
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

  // Redraws everything that shows what the enemies threaten: the danger
  // zone and their intents.
  refreshThreats() {
    this.refreshDangerZone();
    this.refreshIntents();
  }

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
      return [{ origin, movement: getPhaseMovement(unit), ranges, options: this.movementOptions(unit) }];
    });
    this.dangerZoneTiles = this.drawTileHighlights(
      getDangerZone(this.grid, sources),
      DANGER_ZONE_COLOR,
      DANGER_ZONE_ALPHA,
    );
    for (const tile of this.dangerZoneTiles) tile.setDepth(0.45);
  }

  // ---- Enemy intents ----------------------------------------------------
  // During the player phase every enemy's plan for the coming enemy phase
  // (src/game/battle/intents.ts) shows on the map: a faint line along the
  // route it'll walk, and from where it stops an arrow onto the unit it'll
  // strike, whose tile React tags with the HP it stands to lose. Redrawn
  // whenever the battle on the map changes; hidden in any other phase.

  refreshIntents() {
    this.intentGraphics ??= this.add.graphics().setDepth(INTENT_DEPTH);
    this.intentGraphics.clear();
    const { stage, outcome, turnState } = this.shown;
    const showing = !this.preview && stage === 'battle' && !outcome && turnState?.team === 'player';
    const intents = showing ? getEnemyIntents(this.shown) : [];
    for (const intent of intents) this.drawIntent(this.intentGraphics, intent);
    const tags = getIntentThreats(this.shown, intents).map((threat) =>
      toIntentTagView(threat, this.getTileAnchor(threat.at)),
    );
    gameStore.setState({ intentTags: tags });
  }

  drawIntent(graphics: Phaser.GameObjects.Graphics, { path, target }: EnemyIntent) {
    const center = ({ x, y }: Point) => new Phaser.Math.Vector2((x + 0.5) * CELL.width, (y + 0.5) * CELL.height);
    const end = center(path[path.length - 1]);
    if (path.length > 1) {
      graphics.lineStyle(2 * GRID_PX, INTENT_COLOR, INTENT_ROUTE_ALPHA);
      graphics.strokePoints(path.map(center), false);
      if (!target) graphics.fillStyle(INTENT_COLOR, INTENT_ROUTE_ALPHA).fillCircle(end.x, end.y, 3 * GRID_PX);
    }
    if (!target) return;
    // From the edge of the attacker's tile to the edge of its target's, so
    // neither sprite hides the arrow.
    const tip = center(target);
    const direction = tip.clone().subtract(end).normalize();
    const from = end.clone().add(direction.clone().scale(TILE_SIZE * 0.3));
    const to = tip.clone().subtract(direction.clone().scale(TILE_SIZE * 0.4));
    const side = new Phaser.Math.Vector2(-direction.y, direction.x).scale(4 * GRID_PX);
    const base = to.clone().subtract(direction.clone().scale(7 * GRID_PX));
    graphics.lineStyle(3 * GRID_PX, INTENT_COLOR, INTENT_ARROW_ALPHA).lineBetween(from.x, from.y, base.x, base.y);
    graphics
      .fillStyle(INTENT_COLOR, INTENT_ARROW_ALPHA)
      .fillTriangle(to.x, to.y, base.x + side.x, base.y + side.y, base.x - side.x, base.y - side.y);
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
  // menu opens next. Confirming a hostile unit it can strike after moving
  // instead walks to the tile it attacks from and goes straight to aiming
  // at it, so the combat forecast is the only step left.
  tryMoveActiveUnit() {
    const { unitId, x, y } = this.activeUnit!;
    const from = { x, y };
    const attack = this.getMoveAttackPlan();
    const to = attack ? { x: attack.tile.x, y: attack.tile.y } : { x: this.cursor.x, y: this.cursor.y };
    const path = this.movePath!;
    if (!canMoveAlongPath(this.moveRange!, path, to)) return;

    this.hideRange();
    this.inputLocked = true;
    // Remember where it came from, and the battle before the move, so
    // cancelling the menu can undo it.
    const movedAt = this.history.entries.length;
    this.dispatch({ type: 'move', unitId, to, path });
    this.walkSprite(this.unitSprites.get(unitId)!, path, () => {
      this.syncShown();
      this.refreshIntents();
      this.activeUnit = { ...this.activeUnit!, x: to.x, y: to.y, origin: from, movedAt };
      this.inputLocked = false;
      if (attack) {
        this.aimAttackFromMove(attack.weapon.index, attack.target);
        return;
      }
      this.setCursor(to.x, to.y);
      // Straight on to the rest of the unit's action, with Move now used up.
      this.openActionMenu();
    });
  }

  // After moving to attack `target`: equips the weapon in inventory slot
  // `weaponIndex` and aims it at the target. Cancelling takes the equip
  // back along with the move (see undoMove).
  aimAttackFromMove(weaponIndex: number, target: Point) {
    const { unitId } = this.activeUnit!;
    this.attackFromMove = true;
    this.dispatch({ type: 'equip', unitId, index: weaponIndex });
    this.syncShown();
    this.showAttackRange();
    this.setCursor(target.x, target.y);
  }

  // Puts the active unit back where it stood before its move this phase
  // and gives it the move back: the battle goes back to before the move
  // (and anything since, such as an equip).
  undoMove() {
    const { unitId, origin, movedAt } = this.activeUnit!;
    this.history = rewindTo(this.history, movedAt!);
    this.syncShown();
    this.refreshIntents();
    const pos = getStandingPosition(origin!.x, origin!.y);
    this.unitSprites.get(unitId)!.setPosition(pos.x, pos.y);
    this.activeUnit = { unitId, x: origin!.x, y: origin!.y };
    this.setCursor(origin!.x, origin!.y);
  }

  // Attacks the unit under the cursor, if it's a hostile unit in range.
  tryAttackWithActiveUnit() {
    const { unitId } = this.activeUnit!;
    const target = this.getAttackTargetUnderCursor();
    if (!target) return;

    this.hideRange();
    this.activeUnit = null;
    this.attackFromMove = false;
    this.playPlayerAction({ type: 'attack', unitId, target: { x: target.x, y: target.y } });
  }

  // Gives the battle a player unit's act (attack, skill, heal or item),
  // plays what happened with input locked, then moves the battle on.
  playPlayerAction(command: BattleCommand) {
    const events = this.dispatch(command);
    this.inputLocked = true;
    this.playEvents(events, () => this.finishPlayerAction(events));
  }

  // Plays a command's events (src/game/battle/commands.ts) in order, each
  // with its animation, while the map still shows the battle from before
  // it, then calls onDone; continueBattle then shows the battle after it.
  playEvents(events: readonly BattleEvent[], onDone: () => void) {
    const play = (index: number) => {
      const event = events[index];
      if (event) this.playEvent(event, () => play(index + 1));
      else onDone();
    };
    play(0);
  }

  playEvent(event: BattleEvent, next: () => void) {
    switch (event.type) {
      case 'strike':
        this.playStrike(event, next);
        return;
      case 'skill':
        this.playSkill(event, next);
        return;
      case 'pushed':
        this.playPush(event, next);
        return;
      case 'healed':
        // A healing skill's mana goes as the heal lands.
        if (event.skill)
          this.showStats(event.unitId, { mana: this.units.get(event.unitId)!.mana - event.skill.manaCost });
        this.playRecovery(event.targetId, 'health', event.amount, next);
        return;
      case 'item-used':
        this.playRecovery(event.unitId, event.item.stat, event.amount, next);
        return;
      // A kill's heal plays like a potion; a phase's recoveries pop up as
      // the phase starts (see continueBattle).
      case 'recovered':
        if (event.trigger === 'kill') this.playRecovery(event.unitId, event.stat, event.amount, next);
        else next();
        return;
      case 'loot':
        this.showDamagePopup(
          this.unitSprites.get(event.unitId)!,
          0,
          event.stored ? 'stored' : 'loot',
          event.item.label,
        );
        next();
        return;
      case 'defeated':
        this.playDefeat(event.unitId, next);
        return;
      case 'experience':
        this.showExperienceGain(event, next);
        return;
      // A boss's rage: it roars over the map before the battle goes on.
      case 'boss-enraged': {
        const sprite = this.unitSprites.get(event.unitId);
        if (sprite) this.showDamagePopup(sprite, event.strength, 'enraged');
        this.time.delayedCall(this.playbackDuration(ENRAGE_PAUSE_MS), next);
        return;
      }
      default:
        next();
    }
  }

  // One strike of an exchange: the striker lunges at its target (only
  // leaning in from range) and the blow lands at the far end. It wears the
  // striker's weapon ("Broke!" pops up over it if that wears it out, or the
  // spell's name if a tome strike taught it); a hit shows the struck unit's
  // new health on the HUD while a damage number pops over it, both units
  // freeze for a beat (hit-stop, longer on a crit or a finishing blow, with
  // a camera shake on those) and the struck sprite flashes; a miss just
  // shows "Miss".
  playStrike(strike: BattleEventOf<'strike'>, next: () => void) {
    const strikerSprite = this.unitSprites.get(strike.strikerId)!;
    const sprite = this.unitSprites.get(strike.targetId)!;
    const reducedMotion = prefersReducedMotion();
    const juice = getStrikeJuice({ hit: strike.hit, crit: strike.crit, lethal: strike.health <= 0 }, reducedMotion);
    const tiles = Math.round(
      Math.max(Math.abs(sprite.x - strikerSprite.x) / CELL.width, Math.abs(sprite.y - strikerSprite.y) / CELL.height),
    );

    // Done once the target's flash (or the miss pause) and the striker's
    // return have both ended — exactly once, since next moves the battle on.
    let landed = false;
    let returned = false;
    let done = false;
    const finish = () => {
      if (done || !landed || !returned) return;
      done = true;
      next();
    };
    const land = () => {
      landed = true;
      finish();
    };

    const onImpact = () => {
      if (strike.learned) this.showDamagePopup(strikerSprite, 0, 'learned', strike.learned.label);
      else if (strike.broke) this.showDamagePopup(strikerSprite, 0, 'broke');
      if (!strike.hit) {
        this.showDamagePopup(sprite, 0, 'miss');
        this.time.delayedCall(MISS_PAUSE_MS, land);
        return;
      }
      this.showStats(strike.targetId, { health: strike.health });
      this.showDamagePopup(sprite, strike.damage, strike.crit ? 'crit' : 'damage');
      playRigAction(sprite, 'hit');
      if (juice.shake) this.shakeCamera(juice.shake);
      playHitStop(this, sprite, [strikerSprite], juice.hitStopMs, () => playHitFlash(this, sprite, land));
    };
    // The two turn to face each other, and the striker swings.
    this.faceSpriteToward(strikerSprite, sprite);
    this.faceSpriteToward(sprite, strikerSprite);
    playRigAction(strikerSprite, 'attack');
    playLunge(this, strikerSprite, spriteCenter(sprite), {
      distance: getLungeDistance(tiles, reducedMotion),
      holdMs: juice.hitStopMs,
      onImpact,
      onDone: () => {
        returned = true;
        finish();
      },
    });
  }

  // Shakes the camera, for as long as the shake lasts at the game speed
  // (the camera runs on real time, not the scene clock).
  shakeCamera({ durationMs, intensity }: Shake) {
    this.cameras.main.shake(this.playbackDuration(durationMs), intensity);
  }

  // A defeated unit bursts apart, then its sprite comes off the board. The
  // store's defeat count plays its sound.
  playDefeat(unitId: string, next: () => void) {
    const sprite = this.unitSprites.get(unitId)!;
    gameStore.setState((state) => ({ defeats: state.defeats + 1 }));
    playDeathBurst(this, sprite, spriteCenter(sprite), prefersReducedMotion(), () => {
      this.removeUnitSprite(unitId);
      next();
    });
  }

  // A skill's animation (see playSkillAnimation); the HUD shows the mana
  // spent and the damage dealt once it lands.
  playSkill({ unitId, targetId, skill, damage, health }: BattleEventOf<'skill'>, next: () => void) {
    const userSprite = this.unitSprites.get(unitId)!;
    const targetSprite = this.unitSprites.get(targetId)!;
    const mana = this.units.get(unitId)!.mana - skill.manaCost;
    const onImpact = () => {
      this.showStats(unitId, { mana });
      this.showStats(targetId, { health });
      // A Shove's blow does nothing itself: the push that follows shows
      // what it cost.
      if (damage > 0 || !skill.push) this.showDamagePopup(targetSprite, damage);
      if (damage > 0) playRigAction(targetSprite, 'hit');
    };
    if (targetSprite !== userSprite) {
      faceRigToward(userSprite, targetSprite.x);
      faceRigToward(targetSprite, userSprite.x);
    }
    playRigAction(userSprite, 'attack');
    this.playSkillAnimation(skill.animation, userSprite, targetSprite, onImpact, next);
  }

  // A shove: the shoved unit slides onto its new tile, or (stopped by
  // something) lurches toward it and back. Then whatever it cost shows: a
  // flash and the damage over it and over a unit it slammed into, "Drowned!"
  // as it sinks into deep water (its defeat plays next), or "Steadfast" for
  // a unit that holds its ground.
  playPush({ push, health, collidedHealth }: BattleEventOf<'pushed'>, next: () => void) {
    const sprite = this.unitSprites.get(push.unitId)!;
    const land = () => {
      if (push.blocked === 'steadfast') this.showDamagePopup(sprite, 0, 'steadfast');
      if (push.collidedId && collidedHealth !== null) {
        const collided = this.unitSprites.get(push.collidedId)!;
        this.showStats(push.collidedId, { health: collidedHealth });
        this.showDamagePopup(collided, push.collisionDamage);
        playRigAction(collided, 'hit');
        playHitFlash(this, collided);
      }
      if (push.drowned) {
        this.showDamagePopup(sprite, 0, 'drowned');
        this.tweens.add({
          targets: sprite,
          alpha: 0.2,
          y: sprite.y + 6 * GRID_PX,
          duration: PUSH_SLIDE_MS * 2,
          onComplete: next,
        });
        return;
      }
      if (push.damage <= 0) {
        next();
        return;
      }
      this.showStats(push.unitId, { health });
      this.showDamagePopup(sprite, push.damage);
      playRigAction(sprite, 'hit');
      playHitFlash(this, sprite, next);
    };
    if (push.moved) {
      this.tweens.add({
        targets: sprite,
        ...getStandingPosition(push.to.x, push.to.y),
        duration: PUSH_SLIDE_MS,
        ease: 'Quad.easeOut',
        onComplete: land,
      });
      return;
    }
    if (push.blocked === 'steadfast') {
      land();
      return;
    }
    const { direction } = push;
    this.tweens.add({
      targets: sprite,
      x: sprite.x + direction.x * PUSH_BUMP_PX,
      y: sprite.y + direction.y * PUSH_BUMP_PX,
      duration: PUSH_SLIDE_MS / 2,
      yoyo: true,
      onComplete: land,
    });
  }

  // A heal or a potion: the unit glows in the stat's color from
  // POTION_COLORS while a "+N HP" / "+N MP" popup rises over it.
  playRecovery(unitId: string, stat: RestoreStat, amount: number, next: () => void) {
    const sprite = this.unitSprites.get(unitId)!;
    const before = this.shownStats.get(unitId)?.[stat] ?? this.units.get(unitId)![stat];
    this.showStats(unitId, { [stat]: before + amount });
    const center = { x: sprite.x + TILE_SIZE / 2, y: sprite.y + TILE_SIZE / 2 };
    this.showDamagePopup(sprite, amount, stat);
    playPotionGlow(this, sprite, center, POTION_COLORS[stat], next);
  }

  // Shows a unit's health or mana as an event leaves it, ahead of the
  // battle catching up (see `shownStats`).
  showStats(unitId: string, stats: { health?: number; mana?: number }) {
    this.shownStats.set(unitId, { ...this.shownStats.get(unitId), ...stats });
    this.publishHoveredUnit();
    this.publishBossBar();
  }

  // Waits `durationMs` (at the game speed) and then runs `onDone`, unless
  // confirm cuts the wait short first (see skipWait): for what's only there
  // to be read, like a banner, an XP bar or a level up.
  waitSkippably(durationMs: number, onDone: () => void) {
    const timer = this.time.delayedCall(durationMs, () => {
      this.skippableWait = null;
      onDone();
    });
    this.skippableWait = { timer, onDone };
  }

  // Ends the wait waitSkippably started now, if one is running. True when
  // there was one.
  skipWait(): boolean {
    const wait = this.skippableWait;
    if (!wait) return false;
    this.skippableWait = null;
    wait.timer.remove(false);
    wait.onDone();
    return true;
  }

  // Shows XP a unit gained: React's XP bar fills for EXPERIENCE_BAR_MS,
  // then one level-up panel per level gained holds for LEVEL_UP_MS each.
  showExperienceGain({ unitId, from, result }: BattleEventOf<'experience'>, onDone: () => void) {
    const unit = this.battle.units.get(unitId)!;
    const experienceGain = toExperienceGainView({
      id: this.nextProgressId++,
      name: unit.name,
      from,
      result,
      durationMs: this.playbackDuration(EXPERIENCE_BAR_MS),
    });
    gameStore.setState({ experienceGain });

    this.waitSkippably(EXPERIENCE_BAR_MS, () => {
      gameStore.setState({ experienceGain: null });
      // In Warband Mode, the combined level-up and boon pick screen shows
      // each level gained once the battle finishes.
      if (this.setup.mode === 'warband') {
        onDone();
        return;
      }
      this.showLevelUps(
        result.levelUps.map((levelUp) => ({ name: unit.name, unitClass: unit.unitClass, levelUp })),
        onDone,
      );
    });
  }

  // Shows React's level-up panel for each level up in turn, holding each
  // for LEVEL_UP_MS, then calls onDone (straight away when there are none).
  showLevelUps(levelUps: readonly RewardLevelUp[], onDone: () => void) {
    const showLevelUp = (index: number) => {
      const entry = levelUps[index];
      if (!entry) {
        if (index > 0) gameStore.setState({ levelUp: null });
        onDone();
        return;
      }
      const view = toLevelUpView({
        id: this.nextProgressId++,
        ...entry,
        durationMs: this.playbackDuration(LEVEL_UP_MS),
      });
      gameStore.setState({ levelUp: view });
      this.waitSkippably(LEVEL_UP_MS, () => showLevelUp(index + 1));
    };
    showLevelUp(0);
  }

  // Uses the aimed skill on the unit under the cursor, if it's a hostile
  // unit in the skill's range (a wounded ally, for a healing skill).
  tryUseSkill() {
    const { unitId } = this.activeUnit!;
    const skill = this.activeSkill!;
    const target = this.getSkillTargetUnderCursor();
    if (!target) return;

    this.hideRange();
    this.activeUnit = null;
    this.playPlayerAction({ type: 'skill', unitId, skillId: skill.id, target: { x: target.x, y: target.y } });
  }

  // The unit under the cursor that the aimed skill can be used on from the
  // active unit's tile (a foe, or a wounded ally for a healing skill), as
  // { x, y, unitId }, or null.
  getSkillTargetUnderCursor() {
    const { unitId, x, y } = this.activeUnit!;
    const targets = getSkillTargets(this.grid, this.units, unitId, { x, y }, this.activeSkill!);
    return findTileAt(targets, this.cursor);
  }

  // While aiming a Shove (a push skill) at a foe, shades the tile the shove
  // would leave it on (src/game/push.ts) and has React tag it with what
  // happens there; clears both otherwise.
  updatePushPreview() {
    for (const tile of this.pushPreviewTiles) tile.destroy();
    this.pushPreviewTiles = [];
    const target = this.rangeMode === 'skill' && this.activeSkill?.push ? this.getSkillTargetUnderCursor() : null;
    if (!target) {
      gameStore.setState({ pushTag: null });
      return;
    }
    const { x, y } = this.activeUnit!;
    const push = getPushResult(this.grid, this.units, target, getPushDirection({ x, y }, target))!;
    this.pushPreviewTiles = this.drawTileHighlights([push.to], PUSH_PREVIEW_COLOR, PUSH_PREVIEW_ALPHA);
    const health = this.units.get(push.unitId)!.health;
    gameStore.setState({ pushTag: toPushTagView(push, health, this.getTileAnchor(push.to)) });
  }

  // Heals the wounded ally under the cursor with the staff being aimed, if
  // it's one: the ally regains the staff's power plus the healer's magic
  // (capped at its missing health), the staff spends a use, and the healer
  // earns HEAL_EXPERIENCE.
  tryHeal() {
    const { unitId } = this.activeUnit!;
    const { staff, index } = this.activeStaff!;
    const target = findTileAt(this.getHealTargetsFor(staff), this.cursor);
    if (!target) return;

    this.hideRange();
    this.activeUnit = null;
    this.playPlayerAction({ type: 'heal', unitId, staffIndex: index, target: { x: target.x, y: target.y } });
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
    playLunge(this, userSprite, center(targetSprite), {
      onImpact: () => {
        onImpact();
        if (!prefersReducedMotion()) this.shakeCamera(CRIT_SHAKE);
        playHitFlash(this, targetSprite, () => {
          flashed = true;
          finish();
        });
      },
      onDone: () => {
        returned = true;
        finish();
      },
    });
  }

  // The active unit uses one of its items on itself (Unit.useItem and
  // src/game/items.ts); using an item ends its action.
  useItem(itemId: string) {
    const { unitId } = this.activeUnit!;
    this.activeUnit = null;
    this.playPlayerAction({ type: 'item', unitId, itemId });
  }

  // Publishes a number rising from the top center of a sprite for the
  // React HUD to draw — damage by default, a recovery when `kind` is
  // 'health' / 'mana', or loot named by `label` when it's 'loot' / 'stored'
  // — and takes it back down once it's run its course.
  showDamagePopup(sprite: Sprite, amount: number, kind: PopupKind = 'damage', label?: string) {
    const { worldView, zoom } = this.cameras.main;
    const { x, y } = toCanvasFraction(
      worldToScreen({ x: sprite.x + sprite.displayWidth / 2, y: sprite.y }, { x: worldView.x, y: worldView.y, zoom }),
      this.scale.gameSize,
    );
    const popup = toDamagePopupView({
      id: this.nextPopupId++,
      amount,
      kind,
      label,
      x,
      y,
      durationMs: this.playbackDuration(DAMAGE_POPUP_DURATION_MS),
    });

    gameStore.setState((state) => ({ damagePopups: [...state.damagePopups, popup] }));
    this.time.delayedCall(DAMAGE_POPUP_DURATION_MS, () => {
      gameStore.setState((state) => ({
        damagePopups: state.damagePopups.filter((p) => p !== popup),
      }));
    });
  }

  // Takes a defeated unit's sprite off the board.
  removeUnitSprite(unitId: string) {
    if (unitId === this.inspectedEnemyId) this.hideEnemyReach();
    this.unitSprites.get(unitId)!.destroy();
    this.unitSprites.delete(unitId);
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

    const facings = getPathFacings(path, sprite.getData('facing'));
    this.tweens.chain({
      targets: sprite,
      tweens: steps.map((step, i) => ({
        ...getStandingPosition(step.x, step.y),
        duration: MOVE_STEP_MS,
        ease: 'Linear',
        onStart: () => this.playUnitMotion(sprite, 'move', facings[i]),
      })),
      onComplete: () => {
        this.playUnitMotion(sprite, 'idle', facings[facings.length - 1]);
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

    const toTile = (pointer: Phaser.Input.Pointer) => worldToTile(this.grid, pointer.worldX, pointer.worldY, CELL);
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
    if (queue.some((command) => command.type === 'toggle-auto-play')) this.toggleAutoPlay();
    for (const command of queue) {
      if (command.type === 'change-auto-speed') this.changeAutoSpeed(command.direction);
      if (command.type === 'cycle-auto-speed') this.cycleAutoSpeed();
    }
    if (this.inputLocked) return result;

    for (const command of queue) {
      switch (command.type) {
        case 'hover-tile':
          if (this.canRoamCursor()) this.pointCursorAt(command.x, command.y);
          break;
        case 'click-tile':
          // The reward screen and the camp are picked from, not clicked through.
          if (
            this.rewardMenu ||
            this.campMenu ||
            this.rosterScreen ||
            this.merchantScreen ||
            this.promotionScreen ||
            this.mentorScreen
          ) {
            break;
          }
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
        case 'hover-roster':
        case 'select-roster':
          if (!this.rosterScreen) break;
          this.publishRosterScreen(pointRosterCursor(this.rosterScreen, command.target, command.index));
          if (command.type === 'select-roster') result.confirm = true;
          break;
        case 'hover-merchant':
        case 'select-merchant':
          if (!this.merchantScreen) break;
          this.publishMerchantScreen(pointMerchantCursor(this.merchantScreen, command.column, command.index));
          if (command.type === 'select-merchant') result.confirm = true;
          break;
        case 'hover-promotion':
        case 'select-promotion':
          if (!this.promotionScreen) break;
          this.publishPromotionScreen(pointPromotionCursor(this.promotionScreen, command.index));
          if (command.type === 'select-promotion') result.confirm = true;
          break;
        case 'hover-mentor':
        case 'select-mentor':
          if (!this.mentorScreen) break;
          this.publishMentorScreen(pointMentorCursor(this.mentorScreen, command.column, command.index));
          if (command.type === 'select-mentor') result.confirm = true;
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
    if (this.rangeMode === 'attack' || this.rangeMode === 'skill') this.updateCombatForecast();
    if (this.rangeMode === 'skill') this.updatePushPreview();
  }

  // Looks up the unit (if any) under the visible cursor and, only on change,
  // publishes a snapshot to the game store for the React HUD to render.
  // GridScene doesn't know React exists — it only writes plain state.
  updateHoveredUnit() {
    const cell = this.cursorSprite.visible ? getCell(this.grid, this.cursor.x, this.cursor.y) : null;
    const unit = (cell?.unitId ? this.units.get(cell.unitId) : null) ?? null;

    if (unit === this.hoveredUnit) return;

    this.hoveredUnit = unit;
    this.hoveredUnitId = unit ? cell!.unitId : null;
    this.publishHoveredUnit();
  }

  // Publishes a fresh snapshot of the hovered unit — also needed when that
  // unit's stats change without the cursor moving (e.g. it takes damage) —
  // plus where its tile shows, so the unit panel can stay clear of it.
  publishHoveredUnit() {
    const view = toUnitView(this.hoveredUnit);
    const stats = this.hoveredUnitId ? this.shownStats.get(this.hoveredUnitId) : undefined;
    gameStore.setState({
      hoveredUnit: view && stats ? Object.freeze({ ...view, ...stats }) : view,
      hoveredAnchor: this.hoveredUnit ? this.getTileAnchor(this.cursor) : null,
    });
  }

  createCursor() {
    this.cursor = createCursor(0, 0);
    const { x, y } = gridToWorld(this.cursor.x, this.cursor.y, CELL);
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
    this.cursorSprite = this.addTileSprite(x, y, key, frames[0].frame).setDepth(1).play(CURSOR_ANIMATION.key);
  }

  // A hidden cursor hovers nothing, so the unit panel clears with it.
  setCursorVisible(visible: boolean) {
    this.cursorSprite.setVisible(visible);
    this.updateHoveredUnit();
  }

  updateCursorSprite() {
    const { x, y } = gridToWorld(this.cursor.x, this.cursor.y, CELL);
    this.cursorSprite.setPosition(x, y);
  }

  // A sprite (by texture key, and frame of a sheet) covering the map tile
  // whose top-left corner is (x, y), stretched to the tile whatever the
  // image's own pixel size.
  addTileSprite(x: number, y: number, key: string, frame?: number) {
    return this.add.sprite(x, y, key, frame).setOrigin(0, 0).setDisplaySize(CELL.width, CELL.height);
  }

  // A sprite standing on cell (gridX, gridY) (see src/game/sideView.ts): its
  // full TILE_SIZE square art with its feet on the cell, sorted by row.
  addStandingSprite(gridX: number, gridY: number, key: string, frame?: number) {
    const { x, y } = getStandingPosition(gridX, gridY);
    return this.add
      .sprite(x, y, key, frame)
      .setOrigin(0, 0)
      .setDisplaySize(TILE_SIZE, TILE_SIZE)
      .setDepth(getStandingDepth(y));
  }

  // A still image of one tile-sized frame, placed like addTileSprite.
  addTileImage(x: number, y: number, key: string, frame: number) {
    return this.add.image(x, y, key, frame).setOrigin(0, 0).setDisplaySize(CELL.width, CELL.height);
  }

  // The ground is the 64px corner tilesets (WANG_SETS, see
  // src/game/wangTiles.ts), each a layer of half-size tiles, four per cell:
  // the grass-and-dirt base under every cell, then the river over any
  // quarter touching water. Each blob-autotiled terrain (`autotiles`, see
  // src/game/autotile.ts) is drawn over that as its own layer off the
  // overworld sheet; animated sets step through their copies on a timer.
  // The tilemaps use their sheet's own tile size, and each layer is scaled
  // to the floor's CELL (squashed into the side view's slant).
  renderTerrain(grid: Grid, autotiles: Record<string, Autotile>) {
    const wangHalf = SPRITES[WANG_SHEET.key].frame / 2;
    for (const set of Object.values(WANG_SETS)) {
      const map = this.make.tilemap({
        data: getWangFrameMap(grid, set, WANG_SHEET.columns),
        tileWidth: wangHalf,
        tileHeight: wangHalf,
      });
      const tiles = map.addTilesetImage(WANG_SHEET.key, WANG_SHEET.key, wangHalf, wangHalf)!;
      map.createLayer(0, tiles, 0, 0)!.setScale(CELL.width / (wangHalf * 2), CELL.height / (wangHalf * 2));
    }

    const { key, columns, tileSize } = TERRAIN_SHEET;
    const scale = { x: CELL.width / tileSize, y: CELL.height / tileSize };
    const half = tileSize / 2;
    for (const [terrain, autotile] of Object.entries(autotiles)) {
      const frameCount = autotile.animation?.frames ?? 1;
      // One quarter-frame map per animation frame: frames[i][y][x].
      const frames = Array.from({ length: frameCount }, (_, i) =>
        getQuarterFrameMap(grid, terrain, autotile, columns, i),
      );

      const map = this.make.tilemap({ data: frames[0], tileWidth: half, tileHeight: half });
      const layer = map.createLayer(0, map.addTilesetImage(key, key, half, half)!, 0, 0)!.setScale(scale.x, scale.y);
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

  // A battlefield's floor and backdrop: its painting (BATTLEFIELD_PAINTINGS)
  // with its field laid over the floor (fitCamera frames the camera on it),
  // or without one its code-drawn look (BATTLEFIELD_LOOKS): a
  // flecked floor under the backdrop, both running a floor's width past
  // either side and on below the front edge, so neither ends on screen.
  // A faint grid over the floor marks out its cells without boxing them in.
  renderBattlefield(kind: BattlefieldKind, seed: number) {
    const floor = { width: this.grid.width * CELL.width, height: this.grid.height * CELL.height };
    const painting = BATTLEFIELD_PAINTINGS[kind];
    if (painting) {
      const at = getPaintingPlacement(painting, floor.width);
      this.battlefieldPainting = this.add
        .image(at.x, at.y, battlefieldPaintingKey(kind))
        .setOrigin(0, 0)
        .setDisplaySize(at.width, at.height)
        .setDepth(-1);
    } else {
      const look = BATTLEFIELD_LOOKS[kind];
      this.renderBackdrop(look.backdrop, seed, floor.width);
      const graphics = this.add.graphics().setDepth(-1);
      const field = { x: -floor.width, width: 3 * floor.width, height: 2 * floor.height };
      graphics.fillStyle(look.floor.base).fillRect(field.x, 0, field.width, field.height);
      for (const { x, y, color } of getFloorFlecks(look.floor, field.width, field.height, seed)) {
        graphics.fillStyle(color).fillRect(field.x + x, y, BACKDROP_COLUMN, BACKDROP_COLUMN);
      }
    }
    this.renderFloorGrid(floor);
  }

  // The battlefield's cells, outlined faintly: a dark line with a lighter
  // one just under it, like a groove pressed into the ground, over the
  // floor and under everything on it.
  renderFloorGrid(floor: { width: number; height: number }) {
    const graphics = this.add.graphics().setDepth(-0.5);
    const line = GRID_PX;
    for (const [color, alpha, offset] of [
      [0x000000, FLOOR_GRID_ALPHA, 0],
      [0xffffff, FLOOR_GRID_ALPHA / 2, line],
    ] as const) {
      graphics.fillStyle(color, alpha);
      for (let x = 0; x <= this.grid.width; x++) {
        const at = Math.min(x * CELL.width, floor.width - line);
        graphics.fillRect(at + offset, 0, line, floor.height);
      }
      for (let y = 0; y <= this.grid.height; y++) {
        const at = Math.min(y * CELL.height, floor.height - line);
        graphics.fillRect(0, at + offset, floor.width, line);
      }
    }
  }

  // The sky and far scenery behind the arena (src/game/backdrop.ts): the
  // sky's color bands, then each silhouette from farthest to nearest, in
  // the BACKDROP_HEIGHT above the floor's back edge, under everything.
  // `margin` runs it that far past either side of the floor, with the top
  // band of sky going on up as far again, so a battlefield's backdrop fills
  // the screen.
  renderBackdrop(style: BackdropStyle, seed: number, margin = 0) {
    const left = -margin;
    const width = this.grid.width * CELL.width + 2 * margin;
    const graphics = this.add.graphics().setDepth(-1);
    const band = BACKDROP_HEIGHT / style.sky.length;
    if (margin > 0) graphics.fillStyle(style.sky[0]).fillRect(left, -BACKDROP_HEIGHT - 2 * margin, width, 2 * margin);
    style.sky.forEach((color, i) => graphics.fillStyle(color).fillRect(left, -BACKDROP_HEIGHT + i * band, width, band));
    style.layers.forEach((layer, i) => {
      graphics.fillStyle(layer.color);
      getSilhouette(layer, width, BACKDROP_HEIGHT, seed + i).forEach((height, column) =>
        graphics.fillRect(left + column * BACKDROP_COLUMN, -height, BACKDROP_COLUMN, height),
      );
    });
  }

  // Props that stand up out of the floor (forests, mountains, buildings;
  // see src/game/mapArt.ts), at their full TILE_SIZE square art: each
  // piece stacked over its prop's base row (getPropPlacement) and sorted
  // with the units on that row, a hair behind a unit on the same cell.
  renderStandingProps(sprites: readonly MapSprite[]) {
    for (const sprite of sprites) {
      const { x, y, row } = getPropPlacement(sprite);
      const sheet = sprite.sheet ?? TERRAIN_SHEET;
      const depth = getStandingDepth(getStandingPosition(sprite.x, row).y) - STANDING_DEPTH_HAIR;
      this.add
        .image(x, y, sheet.key, getTileFrame(sprite.tile, sheet.columns))
        .setOrigin(0, 0)
        .setDisplaySize(TILE_SIZE, TILE_SIZE)
        .setDepth(depth);
    }
  }

  // Overlays lying flat on the floor, from the terrain sheet or the props
  // sheet (crossings and hazards; see src/game/mapArt.ts): ground art under
  // units, caps just above, and roofs over units like the gate's.
  renderMapSprites(sprites: readonly MapSprite[]) {
    const depths = { ground: 0.4, cap: 0.45, roof: 0.8 };
    for (const { x, y, tile, layer, sheet = TERRAIN_SHEET } of sprites) {
      const pos = gridToWorld(x, y, CELL);
      this.addTileImage(pos.x, pos.y, sheet.key, getTileFrame(tile, sheet.columns)).setDepth(depths[layer]);
    }
  }

  // Trees ({ x, y, tree } from the level) standing on the grass, sorted by
  // row with the units: a hair behind a unit on the same cell, so it stands
  // in front of the trunk.
  renderDecorations(decorations: readonly TreePlacement[]) {
    for (const { x, y, tree } of decorations) {
      const pos = getStandingPosition(x, y);
      addTreeShadow(this, pos.x, pos.y);
      const sprite = this.addStandingSprite(x, y, TREE_SPRITES[tree]);
      sprite.setDepth(sprite.depth - STANDING_DEPTH_HAIR);
    }
  }

  // Marks a seize objective's tile on the map so the player can find it.
  renderObjectiveTile() {
    if (this.objective.kind !== 'seize') return;
    const { x, y } = gridToWorld(this.objective.tile.x, this.objective.tile.y, CELL);
    const marker = this.add
      .rectangle(x, y, CELL.width, CELL.height, SEIZE_TILE_COLOR, SEIZE_TILE_ALPHA)
      .setOrigin(0, 0)
      .setStrokeStyle(2 * GRID_PX, SEIZE_TILE_COLOR)
      .setDepth(0.42);
    this.tweens.add({
      targets: marker,
      alpha: { from: 1, to: 0.4 },
      duration: SEIZE_TILE_PULSE_MS,
      yoyo: true,
      repeat: -1,
    });
  }

  // Multi-tile structures ({ x, y, structure } from the level, by top-left
  // tile), drawn a tile at a time: roof tiles over units (0.75) so a unit
  // under the roof passes behind it, but under the cursor (1); the rest at
  // the trees' depth, under units.
  renderStructures(structures: readonly StructurePlacement[]) {
    for (const { x, y, structure } of structures) {
      const sprite = STRUCTURE_SPRITES[structure];
      for (const tile of getStructureTiles(sprite, x, y)) {
        const pos = gridToWorld(tile.x, tile.y, CELL);
        this.addTileImage(pos.x, pos.y, sprite.key, tile.frame).setDepth(tile.overUnits ? 0.8 : 0.4);
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

  // Units stand on their cell (addStandingSprite) facing the other side:
  // right for the player and guests, left for enemies. A single-image unit
  // (isSingleImageUnit) is animated in code by addUnitRig.
  addUnitSprite(unitId: string, gridX: number, gridY: number) {
    const unit = this.units.get(unitId)!;
    const art = getUnitSprite(unit.unitClass);
    const facing = getStartFacing(unit.team);
    const sprite = this.addStandingSprite(gridX, gridY, getUnitTextureKey(art, 'idle'))
      .setData('art', art)
      .setData('facing', facing);
    if (!isSingleImageUnit(art)) sprite.play(this.unitAnimation(art, 'idle', facing));
    const outline = addUnitOutline(this, sprite, UNIT_OUTLINE.colors[unit.team]);
    if (isSingleImageUnit(art)) addUnitRig(this, sprite, unit.team === 'enemy' ? -1 : 1, [outline]);
    // A battlefield's painted floor gets a soft shadow, a terrain map the crisp blob.
    if (this.battlefieldKind) addUnitShadow(this, sprite, SOFT_UNIT_SHADOW, true);
    else addUnitShadow(this, sprite);
    if (unit.rank) addRankBadge(this, sprite, unit.rank);
    this.unitSprites.set(unitId, sprite);
  }

  // Turns a unit sprite to face `other` (left or right; one straight ahead
  // or behind keeps its facing): a rig turns its image, a sheet unit idles
  // on that facing's row.
  faceSpriteToward(sprite: Sprite, other: Sprite) {
    if (isSingleImageUnit(sprite.getData('art'))) {
      faceRigToward(sprite, other.x);
      return;
    }
    const facing = getFacingToward(sprite, other);
    if (facing && facing !== sprite.getData('facing')) this.playUnitMotion(sprite, 'idle', facing);
  }

  // Keeps every unit drawn in front of what stands behind it as it walks
  // between rows (see getStandingDepth).
  sortUnitSprites() {
    if (!this.unitSprites) return;
    for (const sprite of this.unitSprites.values()) sprite.setDepth(getStandingDepth(sprite.y));
  }

  // Sets a unit sprite standing or walking (a UNIT_ANIMATIONS name) facing
  // `facing`: its sheet's animation for that facing, or for a single-image
  // unit, its rig's motion (a walk already under way keeps going).
  playUnitMotion(sprite: Sprite, animation: UnitAnimation, facing: Facing) {
    const art = sprite.getData('art');
    sprite.setData('facing', facing);
    if (isSingleImageUnit(art)) setRigMotion(sprite, animation, facing);
    else sprite.play(this.unitAnimation(art, animation, facing), true);
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

// Applies a run command the screen offered, or null when the run refuses
// it (e.g. a reroll the warband can't afford), leaving everything as it was.
function tryRunCommand(session: Parameters<typeof applyRunCommand>[0], command: RunCommand): RunCommandResult | null {
  try {
    return applyRunCommand(session, command);
  } catch (error) {
    if (error instanceof RunCommandError) return null;
    throw error;
  }
}

// A unit sprite's center in world space (sprites are placed by their top left).
function spriteCenter(sprite: Sprite): Point {
  return { x: sprite.x + sprite.displayWidth / 2, y: sprite.y + sprite.displayHeight / 2 };
}

// Whether the player asked their system for less motion: the map then skips
// camera shakes and particle bursts.
function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}
