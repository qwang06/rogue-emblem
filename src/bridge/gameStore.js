import { createStore } from './store.js';

// State that only exists while the map is running. The map scene resets
// these when a battle starts and when it's left, so nothing carries over.
export const BATTLE_STATE_DEFAULTS = Object.freeze({
  phase: null, // 'deployment' (placing units) | 'battle' while the map runs, else null
  deploymentStep: null, // 'menu' | 'roster' | 'placing' during deployment, else null
  deploymentMenu: null, // frozen Place Units / Start menu while open, or null
  rosterMenu: null, // frozen menu of RosterEntryViews while picking a unit to place, or null
  pauseMenu: null, // frozen Main Menu / Settings menu while open, or null
  hoveredUnit: null, // UnitView from toUnitView(), or null
  actionMenu: null, // frozen menu from src/game/actionMenu.js while open, or null
  skillMenu: null, // frozen menu of the active unit's skills (from getSkillActions) while open, or null
  damagePopups: [], // DamagePopupViews from toDamagePopupView() currently on screen
});

// The single app-wide store shared by Phaser (writer) and React (reader).
// Add new UI-facing state here as plain, serializable values.
export const gameStore = createStore({
  screen: 'title', // 'title' (main menu) | 'battle' (the map is running)
  ...BATTLE_STATE_DEFAULTS,
});
