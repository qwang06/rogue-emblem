import { createStore } from './store.js';

// The single app-wide store shared by Phaser (writer) and React (reader).
// Add new UI-facing state here as plain, serializable values.
export const gameStore = createStore({
  screen: 'title', // 'title' (main menu) | 'battle' (the map is running)
  phase: null, // 'deployment' (placing units) | 'battle' while the map runs, else null
  deploymentStep: null, // 'menu' | 'roster' | 'placing' during deployment, else null
  deploymentMenu: null, // frozen Place Units / Start menu while open, or null
  rosterMenu: null, // frozen menu of RosterEntryViews while picking a unit to place, or null
  hoveredUnit: null, // UnitView from toUnitView(), or null
  actionMenu: null, // frozen menu from src/game/actionMenu.js while open, or null
  damagePopups: [], // DamagePopupViews from toDamagePopupView() currently on screen
});
