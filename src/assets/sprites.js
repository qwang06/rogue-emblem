// Texture key -> URL for every standalone sprite sheet. GridScene preloads
// them all under these keys; the React UI looks unit portraits up here.
// src/game/tileset.js names which key each unit draws with.

import goldGinkgoTree from './gold_ginkgo_tree.png';
import ginkgoTreeGreen from './ginkgo_tree_green.png';
import soldier03Idle from './Soldier_03_Idle.png';
import soldier03Move from './Soldier_03_Move.png';
import villager01Idle from './Villager_01_Idle.png';
import villager01Move from './Villager_01_Move.png';

export const SPRITE_URLS = {
  gold_ginkgo_tree: goldGinkgoTree,
  ginkgo_tree_green: ginkgoTreeGreen,
  Soldier_03_Idle: soldier03Idle,
  Soldier_03_Move: soldier03Move,
  Villager_01_Idle: villager01Idle,
  Villager_01_Move: villager01Move,
};
