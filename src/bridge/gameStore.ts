import type { ItemAction } from '../game/items.ts';
import type { MenuAction, Menu } from '../game/actionMenu.ts';
import type { SkillAction } from '../game/skills.ts';
import type { BattleOutcome } from '../game/turns.ts';
import { createStore } from './store.ts';
import type {
  CombatForecastView,
  DamagePopupView,
  DialogView,
  ExperienceGainView,
  LevelUpView,
  PhaseBannerView,
  RosterEntryView,
  TileAnchorView,
  TurnView,
  UnitView,
} from './views.ts';

export type Screen = 'title' | 'battle';
export type BattlePhase = 'deployment' | 'battle';
export type DeploymentStep = 'menu' | 'roster' | 'placing';
export type BattleSetup = { mode: 'demo' } | { mode: 'training'; unitClass: string };

// A roster entry as a menu entry: RosterEntryViews carry their own label.
export type RosterMenuEntry = RosterEntryView & MenuAction;

export interface BattleState {
  mapLoadProgress: number;
  mapReady: boolean;
  phase: BattlePhase | null;
  deploymentStep: DeploymentStep | null;
  deploymentMenu: Menu | null;
  rosterMenu: Menu<RosterMenuEntry> | null;
  pauseMenu: Menu | null;
  hoveredUnit: UnitView | null;
  actionMenu: Menu | null;
  skillMenu: Menu<SkillAction> | null;
  itemMenu: Menu<ItemAction> | null;
  combatForecast: CombatForecastView | null;
  menuAnchor: TileAnchorView | null;
  experienceGain: ExperienceGainView | null;
  levelUp: LevelUpView | null;
  damagePopups: readonly DamagePopupView[];
  turn: TurnView | null;
  phaseBanner: PhaseBannerView | null;
  battleOutcome: BattleOutcome | null;
  dialog: DialogView | null;
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
  deploymentMenu: null, // frozen Place Units / Start menu while open, or null
  rosterMenu: null, // frozen menu of RosterEntryViews while picking a unit to place, or null
  pauseMenu: null, // frozen Main Menu / Settings menu while open, or null
  hoveredUnit: null, // UnitView from toUnitView(), or null
  actionMenu: null, // frozen menu from src/game/actionMenu.ts while open, or null
  skillMenu: null, // frozen menu of the active unit's skills (from getSkillActions) while open, or null
  itemMenu: null, // frozen menu of the active unit's items (from getItemActions) while open, or null
  combatForecast: null, // CombatForecastView from toCombatForecastView() while aiming an attack at a target, or null
  menuAnchor: null, // TileAnchorView from toTileAnchorView() of the active unit's tile, which its menus open beside, or null
  experienceGain: null, // ExperienceGainView from toExperienceGainView() while a unit's XP bar fills after combat, or null
  levelUp: null, // LevelUpView from toLevelUpView() while a level up is being shown, or null
  damagePopups: [], // DamagePopupViews (damage or recovery) from toDamagePopupView() currently on screen
  turn: null, // TurnView from toTurnView() once the battle starts, else null
  phaseBanner: null, // PhaseBannerView from toPhaseBannerView() while a phase is being announced, or null
  battleOutcome: null, // 'victory' | 'defeat' once the battle is decided, else null
  dialog: null, // DialogView from toDialogView() of the line being spoken, or null
});

// The single app-wide store shared by Phaser (writer) and React (reader).
// Add new UI-facing state here as plain, serializable values.
export const gameStore = createStore<GameState>({
  screen: 'title', // 'title' (main menu) | 'battle' (the map is running)
  // Which battle the map runs, set together with screen: 'battle':
  // { mode: 'demo' } | { mode: 'training', unitClass } (a class id from src/game/unitClasses.ts)
  battleSetup: null,
  ...BATTLE_STATE_DEFAULTS,
});
