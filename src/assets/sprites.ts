// Texture key -> URL for every standalone sprite sheet and item icon. GridScene preloads
// them all under these keys; the React UI looks unit portraits up here.
// src/game/tileset.ts names which key each unit draws with.

import acolyte01Idle from './units/Acolyte_01_Idle.png';
import acolyte01Move from './units/Acolyte_01_Move.png';
import acolyte02Idle from './units/Acolyte_02_Idle.png';
import acolyte02Move from './units/Acolyte_02_Move.png';
import acolyte03Idle from './units/Acolyte_03_Idle.png';
import acolyte03Move from './units/Acolyte_03_Move.png';
import archer02Idle from './units/Archer_02_Idle.png';
import archer02Move from './units/Archer_02_Move.png';
import archer03Idle from './units/Archer_03_Idle.png';
import archer03Move from './units/Archer_03_Move.png';
import bat01Idle from './units/Bat_01_Idle.png';
import bat01Move from './units/Bat_01_Move.png';
import gates from './gates.png';
import ginkgoTreeGreen from './ginkgo_tree_green.png';
import goblin01Idle from './units/Goblin_01_Idle.png';
import goblin01Move from './units/Goblin_01_Move.png';
import goldGinkgoTree from './gold_ginkgo_tree.png';
import mapProps from './map-props.png';
import orc01Idle from './units/Orc_01_Idle.png';
import orc01Move from './units/Orc_01_Move.png';
import sapper04Idle from './units/Sapper_04_Idle.png';
import sapper04Move from './units/Sapper_04_Move.png';
import siege03Idle from './units/Siege_03_Idle.png';
import siege03Move from './units/Siege_03_Move.png';
import skeleton01Idle from './units/Skeleton_01_Idle.png';
import skeleton01Move from './units/Skeleton_01_Move.png';
import slime01Idle from './units/Slime_01_Idle.png';
import slime01Move from './units/Slime_01_Move.png';
import soldier02Idle from './units/Soldier_02_Idle.png';
import soldier02Move from './units/Soldier_02_Move.png';
import soldier03Idle from './units/Soldier_03_Idle.png';
import soldier03Move from './units/Soldier_03_Move.png';
import soldier04Idle from './units/Soldier_04_Idle.png';
import soldier04Move from './units/Soldier_04_Move.png';
import soldier05Idle from './units/Soldier_05_Idle.png';
import soldier05Move from './units/Soldier_05_Move.png';
import soldier06Idle from './units/Soldier_06_Idle.png';
import soldier06Move from './units/Soldier_06_Move.png';
import vanguard01Idle from './units/Vanguard_01_Idle.png';
import vanguard01Move from './units/Vanguard_01_Move.png';
import vanguard02Idle from './units/Vanguard_02_Idle.png';
import vanguard02Move from './units/Vanguard_02_Move.png';
import vanguard03Idle from './units/Vanguard_03_Idle.png';
import vanguard03Move from './units/Vanguard_03_Move.png';
import vanguard04Idle from './units/Vanguard_04_Idle.png';
import vanguard04Move from './units/Vanguard_04_Move.png';
import vanguard06Idle from './units/Vanguard_06_Idle.png';
import vanguard06Move from './units/Vanguard_06_Move.png';
import warrior01Idle from './units/Warrior_01_Idle.png';
import warrior01Move from './units/Warrior_01_Move.png';
import wolf01Idle from './units/Wolf_01_Idle.png';
import wolf01Move from './units/Wolf_01_Move.png';
import ballistaIcon from './items/ballista.png';
import biteIcon from './items/bite.png';
import boneClawsIcon from './items/bone-claws.png';
import clubIcon from './items/club.png';
import fangsIcon from './items/fangs.png';
import fireSpellIcon from './items/fire-spell.png';
import fireIcon from './items/fire.png';
import fistsIcon from './items/fists.png';
import greatAxeIcon from './items/great-axe.png';
import healStaffIcon from './items/heal-staff.png';
import healthPotionIcon from './items/health-potion.png';
import ironAxeIcon from './items/iron-axe.png';
import ironBowIcon from './items/iron-bow.png';
import ironSpearIcon from './items/iron-spear.png';
import lightIcon from './items/light.png';
import manaPotionIcon from './items/mana-potion.png';
import masterSealIcon from './items/master-seal.png';
import powderKegIcon from './items/powder-keg.png';
import tackleIcon from './items/tackle.png';
import woodenArmor from './items/wooden-armor.png';
import woodenAxe from './items/wooden-axe.png';
import woodenShield from './items/wooden-shield.png';
import woodenSpear from './items/wooden-spear.png';
import woodenSword from './items/wooden-sword.png';

export const SPRITE_URLS: Readonly<Record<string, string>> = {
  Acolyte_01_Idle: acolyte01Idle,
  Acolyte_01_Move: acolyte01Move,
  Acolyte_02_Idle: acolyte02Idle,
  Acolyte_02_Move: acolyte02Move,
  Acolyte_03_Idle: acolyte03Idle,
  Acolyte_03_Move: acolyte03Move,
  Archer_02_Idle: archer02Idle,
  Archer_02_Move: archer02Move,
  Archer_03_Idle: archer03Idle,
  Archer_03_Move: archer03Move,
  Bat_01_Idle: bat01Idle,
  Bat_01_Move: bat01Move,
  gates,
  ginkgo_tree_green: ginkgoTreeGreen,
  Goblin_01_Idle: goblin01Idle,
  Goblin_01_Move: goblin01Move,
  gold_ginkgo_tree: goldGinkgoTree,
  'map-props': mapProps,
  Orc_01_Idle: orc01Idle,
  Orc_01_Move: orc01Move,
  Sapper_04_Idle: sapper04Idle,
  Sapper_04_Move: sapper04Move,
  Siege_03_Idle: siege03Idle,
  Siege_03_Move: siege03Move,
  Skeleton_01_Idle: skeleton01Idle,
  Skeleton_01_Move: skeleton01Move,
  Slime_01_Idle: slime01Idle,
  Slime_01_Move: slime01Move,
  Soldier_02_Idle: soldier02Idle,
  Soldier_02_Move: soldier02Move,
  Soldier_03_Idle: soldier03Idle,
  Soldier_03_Move: soldier03Move,
  Soldier_04_Idle: soldier04Idle,
  Soldier_04_Move: soldier04Move,
  Soldier_05_Idle: soldier05Idle,
  Soldier_05_Move: soldier05Move,
  Soldier_06_Idle: soldier06Idle,
  Soldier_06_Move: soldier06Move,
  Vanguard_01_Idle: vanguard01Idle,
  Vanguard_01_Move: vanguard01Move,
  Vanguard_02_Idle: vanguard02Idle,
  Vanguard_02_Move: vanguard02Move,
  Vanguard_03_Idle: vanguard03Idle,
  Vanguard_03_Move: vanguard03Move,
  Vanguard_04_Idle: vanguard04Idle,
  Vanguard_04_Move: vanguard04Move,
  Vanguard_06_Idle: vanguard06Idle,
  Vanguard_06_Move: vanguard06Move,
  Warrior_01_Idle: warrior01Idle,
  Warrior_01_Move: warrior01Move,
  Wolf_01_Idle: wolf01Idle,
  Wolf_01_Move: wolf01Move,
  'ballista': ballistaIcon,
  'bite': biteIcon,
  'bone-claws': boneClawsIcon,
  'club': clubIcon,
  'fangs': fangsIcon,
  'fire-spell': fireSpellIcon,
  'fire': fireIcon,
  'fists': fistsIcon,
  'great-axe': greatAxeIcon,
  'heal-staff': healStaffIcon,
  'health-potion': healthPotionIcon,
  'iron-axe': ironAxeIcon,
  'iron-bow': ironBowIcon,
  'iron-spear': ironSpearIcon,
  'light': lightIcon,
  'mana-potion': manaPotionIcon,
  'master-seal': masterSealIcon,
  'powder-keg': powderKegIcon,
  'tackle': tackleIcon,
  'wooden-armor': woodenArmor,
  'wooden-axe': woodenAxe,
  'wooden-shield': woodenShield,
  'wooden-spear': woodenSpear,
  'wooden-sword': woodenSword,
};
