// Texture key -> URL for every standalone sprite sheet and item icon. GridScene preloads
// them all under these keys; the React UI looks unit portraits up here.
// src/game/tileset.ts names which key each unit draws with.

import acolyte02Idle from './units/Acolyte_02_Idle.png';
import acolyte02Move from './units/Acolyte_02_Move.png';
import archer02Idle from './units/Archer_02_Idle.png';
import archer02Move from './units/Archer_02_Move.png';
import gates from './gates.png';
import goblin01Idle from './units/Goblin_01_Idle.png';
import goblin01Move from './units/Goblin_01_Move.png';
import goldGinkgoTree from './gold_ginkgo_tree.png';
import ginkgoTreeGreen from './ginkgo_tree_green.png';
import skeleton01Idle from './units/Skeleton_01_Idle.png';
import skeleton01Move from './units/Skeleton_01_Move.png';
import slime01Idle from './units/Slime_01_Idle.png';
import slime01Move from './units/Slime_01_Move.png';
import soldier03Idle from './units/Soldier_03_Idle.png';
import soldier03Move from './units/Soldier_03_Move.png';
import soldier04Idle from './units/Soldier_04_Idle.png';
import soldier04Move from './units/Soldier_04_Move.png';
import vanguard04Idle from './units/Vanguard_04_Idle.png';
import vanguard04Move from './units/Vanguard_04_Move.png';
import villager01Idle from './units/Villager_01_Idle.png';
import villager01Move from './units/Villager_01_Move.png';
import woodenArmor from './items/wooden-armor.png';
import woodenAxe from './items/wooden-axe.png';
import woodenShield from './items/wooden-shield.png';
import woodenSpear from './items/wooden-spear.png';
import woodenSword from './items/wooden-sword.png';

export const SPRITE_URLS: Readonly<Record<string, string>> = {
  Acolyte_02_Idle: acolyte02Idle,
  Acolyte_02_Move: acolyte02Move,
  Archer_02_Idle: archer02Idle,
  Archer_02_Move: archer02Move,
  gates,
  Goblin_01_Idle: goblin01Idle,
  Goblin_01_Move: goblin01Move,
  gold_ginkgo_tree: goldGinkgoTree,
  ginkgo_tree_green: ginkgoTreeGreen,
  Skeleton_01_Idle: skeleton01Idle,
  Skeleton_01_Move: skeleton01Move,
  Slime_01_Idle: slime01Idle,
  Slime_01_Move: slime01Move,
  Soldier_03_Idle: soldier03Idle,
  Soldier_03_Move: soldier03Move,
  Soldier_04_Idle: soldier04Idle,
  Soldier_04_Move: soldier04Move,
  Vanguard_04_Idle: vanguard04Idle,
  Vanguard_04_Move: vanguard04Move,
  Villager_01_Idle: villager01Idle,
  Villager_01_Move: villager01Move,
  'wooden-armor': woodenArmor,
  'wooden-axe': woodenAxe,
  'wooden-shield': woodenShield,
  'wooden-spear': woodenSpear,
  'wooden-sword': woodenSword,
};
