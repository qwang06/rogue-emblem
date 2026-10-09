// Texture key -> URL for every standalone sprite sheet. GridScene preloads
// them all under these keys; the React UI looks unit portraits up here.
// src/game/tileset.ts names which key each unit draws with.

import archer02Idle from './units/Archer_02_Idle.png';
import archer02Move from './units/Archer_02_Move.png';
import gates from './gates.png';
import goldGinkgoTree from './gold_ginkgo_tree.png';
import ginkgoTreeGreen from './ginkgo_tree_green.png';
import soldier03Idle from './units/Soldier_03_Idle.png';
import soldier03Move from './units/Soldier_03_Move.png';
import villager01Idle from './units/Villager_01_Idle.png';
import villager01Move from './units/Villager_01_Move.png';

export const SPRITE_URLS: Readonly<Record<string, string>> = {
  Archer_02_Idle: archer02Idle,
  Archer_02_Move: archer02Move,
  gates,
  gold_ginkgo_tree: goldGinkgoTree,
  ginkgo_tree_green: ginkgoTreeGreen,
  Soldier_03_Idle: soldier03Idle,
  Soldier_03_Move: soldier03Move,
  Villager_01_Idle: villager01Idle,
  Villager_01_Move: villager01Move,
};
