import { createStore } from './store.js';

// The single app-wide store shared by Phaser (writer) and React (reader).
// Add new UI-facing state here as plain, serializable values.
export const gameStore = createStore({
  hoveredUnit: null, // UnitView from toUnitView(), or null
  actionMenu: null, // frozen menu from src/game/actionMenu.js while open, or null
});
