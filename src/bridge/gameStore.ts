import type { ItemAction } from '../game/items.ts';
import type { MenuAction, Menu } from '../game/actionMenu.ts';
import type { SkillAction } from '../game/skills.ts';
import type { WeaponAction } from '../game/weapons.ts';
import type { BattleSetup } from '../game/battleSetup.ts';
import type { BattleOutcome } from '../game/turns.ts';
import type { MerchantScreenView } from './merchantView.ts';
import type { RosterScreenView } from './rosterView.ts';
import { createStore } from './store.ts';
import type {
  CombatForecastView,
  DamagePopupView,
  DialogView,
  ExperienceGainView,
  LevelUpView,
  ObjectiveView,
  PhaseBannerView,
  RosterEntryView,
  RewardAction,
  RunOverView,
  StageClearView,
  TileAnchorView,
  TurnView,
  UnitDetailView,
  UnitView,
} from './views.ts';

export type Screen = 'title' | 'battle' | 'preview';
export type BattlePhase = 'deployment' | 'battle';
export type DeploymentStep = 'menu' | 'roster' | 'placing';
export type { BattleSetup };

// A roster entry as a menu entry: RosterEntryViews carry their own label.
export type RosterMenuEntry = RosterEntryView & MenuAction;

export interface BattleState {
  mapLoadProgress: number;
  mapReady: boolean;
  phase: BattlePhase | null;
  deploymentStep: DeploymentStep | null;
  deploymentLimit: number | null;
  deploymentMenu: Menu | null;
  rosterMenu: Menu<RosterMenuEntry> | null;
  pauseMenu: Menu | null;
  hoveredUnit: UnitView | null;
  hoveredAnchor: TileAnchorView | null;
  unitInfo: UnitDetailView | null;
  actionMenu: Menu | null;
  weaponMenu: Menu<WeaponAction> | null;
  skillMenu: Menu<SkillAction> | null;
  itemMenu: Menu<ItemAction> | null;
  combatForecast: CombatForecastView | null;
  dangerZoneVisible: boolean;
  menuAnchor: TileAnchorView | null;
  experienceGain: ExperienceGainView | null;
  levelUp: LevelUpView | null;
  damagePopups: readonly DamagePopupView[];
  turn: TurnView | null;
  phaseBanner: PhaseBannerView | null;
  battleOutcome: BattleOutcome | null;
  dialog: DialogView | null;
  objective: ObjectiveView | null;
  nextBattle: string | null;
  runOver: RunOverView | null;
  stageClear: StageClearView | null;
  rewardMenu: Menu<RewardAction> | null;
  campMenu: Menu | null;
  campGold: number | null;
  rosterScreen: RosterScreenView | null;
  merchantScreen: MerchantScreenView | null;
}

export interface GameState extends BattleState {
  screen: Screen;
  battleSetup: BattleSetup | null;
}

// State that only exists while the map is running. The map scene resets
// these when a battle starts and when it's left, so nothing carries over.
export const BATTLE_STATE_DEFAULTS: Readonly<BattleState> = Object.freeze({
  mapLoadProgress: 0, // 0–1, how much of the map's art has loaded (the loading screen's bar)
  mapReady: false, // true once the map scene has loaded and built the map, lifting the loading screen
  phase: null, // 'deployment' (placing units) | 'battle' while the map runs, else null
  deploymentStep: null, // 'menu' | 'roster' | 'placing' during deployment, else null
  deploymentLimit: null, // how many units can be deployed (getDeploymentLimit) during deployment, else null
  deploymentMenu: null, // frozen Place Units / Start menu while open, or null
  rosterMenu: null, // frozen menu of RosterEntryViews while picking a unit to place, or null
  pauseMenu: null, // frozen End Turn / Main Menu / Settings menu while open, or null
  hoveredUnit: null, // UnitView from toUnitView(), or null
  hoveredAnchor: null, // TileAnchorView from toTileAnchorView() of the hovered unit's tile (the unit panel docks away from it), or null
  unitInfo: null, // UnitDetailView from toUnitDetailView() while the unit info screen is open, or null
  actionMenu: null, // frozen menu from src/game/actionMenu.ts while open, or null
  weaponMenu: null, // frozen menu of the active unit's weapons (from getWeaponActions) after choosing Attack, or null
  skillMenu: null, // frozen menu of the active unit's skills (from getSkillActions) while open, or null
  itemMenu: null, // frozen menu of the active unit's items (from getItemActions) while open, or null
  combatForecast: null, // CombatForecastView from toCombatForecastView() while aiming an attack at a target, or null
  dangerZoneVisible: false, // whether the map shades every tile an enemy could strike next phase (toggled with D)
  menuAnchor: null, // TileAnchorView from toTileAnchorView() of the active unit's tile, which its menus open beside, or null
  experienceGain: null, // ExperienceGainView from toExperienceGainView() while a unit's XP bar fills after combat, or null
  levelUp: null, // LevelUpView from toLevelUpView() while a level up is being shown, or null
  damagePopups: [], // DamagePopupViews (damage or recovery) from toDamagePopupView() currently on screen
  turn: null, // TurnView from toTurnView() once the battle starts, else null
  phaseBanner: null, // PhaseBannerView from toPhaseBannerView() while a phase is being announced, or null
  battleOutcome: null, // 'victory' | 'defeat' once the battle is decided, else null
  dialog: null, // DialogView from toDialogView() of the line being spoken, or null
  objective: null, // ObjectiveView from toObjectiveView() while the Objective screen is up, or null
  nextBattle: null, // describeBattle() of the battle a victory leads to (shown on the result), or null
  runOver: null, // RunOverView from toRunOverView() once a Warband Mode run has ended, or null
  stageClear: null, // StageClearView from toStageClearView() once a Warband Mode stage is won, or null
  rewardMenu: null, // frozen menu of RewardActions (toRewardAction) while the reward screen is up after a won stage, or null
  campMenu: null, // frozen camp menu (getCampActions: Manage Roster / Merchant / Rest / Next Stage) once a won stage's reward is taken, or null
  campGold: null, // the warband's gold while at camp (shown on the camp menu), or null
  rosterScreen: null, // RosterScreenView from toRosterScreenView() while the roster screen is open between stages, or null
  merchantScreen: null, // MerchantScreenView from toMerchantScreenView() while the camp's merchant screen is open, or null
});

// The single app-wide store shared by Phaser (writer) and React (reader).
// Add new UI-facing state here as plain, serializable values.
export const gameStore = createStore<GameState>({
  // 'title' (main menu) | 'battle' (the map is running) | 'preview' (the map
  // is shown read-only, from the config editor: no deployment, dialog or turns)
  screen: 'title',
  // Which battle the map runs, set together with screen 'battle' or 'preview':
  // a BattleSetup from src/game/battleSetup.ts. Winning a battle that has a
  // next one (getNextBattle) swaps it in; main.ts restarts the map whenever
  // it changes.
  battleSetup: null,
  ...BATTLE_STATE_DEFAULTS,
});
