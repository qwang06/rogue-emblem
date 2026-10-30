// Texture key -> image for every standalone sprite sheet and item icon. GridScene preloads
// them all under these keys; the React UI looks unit portraits up here.
// src/game/tileset.ts names which key each unit draws with.

import acolyte01Idle from './units/Acolyte_01_Idle.png';
import acolyte01Move from './units/Acolyte_01_Move.png';
import acolyte02Idle from './units/Acolyte_02_Idle.png';
import acolyte02Move from './units/Acolyte_02_Move.png';
import acolyte03Idle from './units/Acolyte_03_Idle.png';
import acolyte03Move from './units/Acolyte_03_Move.png';
import amazon01Idle from './units/Amazon_01_Idle.png';
import amazon01Move from './units/Amazon_01_Move.png';
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
import terrain64 from './terrain64.png';
import terrain64Props from './terrain64-props.png';
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
import warrior02Idle from './units/Warrior_02_Idle.png';
import warrior02Move from './units/Warrior_02_Move.png';
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

// An image and the size of its square frames in its own pixels: a unit
// sheet is 4x4 frames, a one-tile sprite is one frame, a multi-tile
// structure one frame per tile. The game draws every frame one map tile
// (TILE_SIZE) big whatever its pixel size, so 32px and 64px art mix.
export interface SpriteSheet {
  url: string;
  frame: number;
}

export const SPRITES: Readonly<Record<string, SpriteSheet>> = {
  Acolyte_01_Idle: { url: acolyte01Idle, frame: 32 },
  Acolyte_01_Move: { url: acolyte01Move, frame: 32 },
  Acolyte_02_Idle: { url: acolyte02Idle, frame: 32 },
  Acolyte_02_Move: { url: acolyte02Move, frame: 32 },
  Acolyte_03_Idle: { url: acolyte03Idle, frame: 32 },
  Acolyte_03_Move: { url: acolyte03Move, frame: 32 },
  Amazon_01_Idle: { url: amazon01Idle, frame: 32 },
  Amazon_01_Move: { url: amazon01Move, frame: 32 },
  Archer_03_Idle: { url: archer03Idle, frame: 32 },
  Archer_03_Move: { url: archer03Move, frame: 32 },
  Bat_01_Idle: { url: bat01Idle, frame: 32 },
  Bat_01_Move: { url: bat01Move, frame: 32 },
  gates: { url: gates, frame: 32 },
  ginkgo_tree_green: { url: ginkgoTreeGreen, frame: 32 },
  Goblin_01_Idle: { url: goblin01Idle, frame: 32 },
  Goblin_01_Move: { url: goblin01Move, frame: 32 },
  gold_ginkgo_tree: { url: goldGinkgoTree, frame: 32 },
  'map-props': { url: mapProps, frame: 32 },
  terrain64: { url: terrain64, frame: 64 },
  'terrain64-props': { url: terrain64Props, frame: 64 },
  Orc_01_Idle: { url: orc01Idle, frame: 32 },
  Orc_01_Move: { url: orc01Move, frame: 32 },
  Sapper_04_Idle: { url: sapper04Idle, frame: 32 },
  Sapper_04_Move: { url: sapper04Move, frame: 32 },
  Siege_03_Idle: { url: siege03Idle, frame: 32 },
  Siege_03_Move: { url: siege03Move, frame: 32 },
  Skeleton_01_Idle: { url: skeleton01Idle, frame: 32 },
  Skeleton_01_Move: { url: skeleton01Move, frame: 32 },
  Slime_01_Idle: { url: slime01Idle, frame: 64 },
  Slime_01_Move: { url: slime01Move, frame: 64 },
  Soldier_02_Idle: { url: soldier02Idle, frame: 32 },
  Soldier_02_Move: { url: soldier02Move, frame: 32 },
  Soldier_03_Idle: { url: soldier03Idle, frame: 32 },
  Soldier_03_Move: { url: soldier03Move, frame: 32 },
  Soldier_04_Idle: { url: soldier04Idle, frame: 32 },
  Soldier_04_Move: { url: soldier04Move, frame: 32 },
  Soldier_05_Idle: { url: soldier05Idle, frame: 32 },
  Soldier_05_Move: { url: soldier05Move, frame: 32 },
  Soldier_06_Idle: { url: soldier06Idle, frame: 32 },
  Soldier_06_Move: { url: soldier06Move, frame: 32 },
  Vanguard_01_Idle: { url: vanguard01Idle, frame: 32 },
  Vanguard_01_Move: { url: vanguard01Move, frame: 32 },
  Vanguard_02_Idle: { url: vanguard02Idle, frame: 32 },
  Vanguard_02_Move: { url: vanguard02Move, frame: 32 },
  Vanguard_03_Idle: { url: vanguard03Idle, frame: 32 },
  Vanguard_03_Move: { url: vanguard03Move, frame: 32 },
  Vanguard_04_Idle: { url: vanguard04Idle, frame: 32 },
  Vanguard_04_Move: { url: vanguard04Move, frame: 32 },
  Vanguard_06_Idle: { url: vanguard06Idle, frame: 32 },
  Vanguard_06_Move: { url: vanguard06Move, frame: 32 },
  Warrior_02_Idle: { url: warrior02Idle, frame: 32 },
  Warrior_02_Move: { url: warrior02Move, frame: 32 },
  Wolf_01_Idle: { url: wolf01Idle, frame: 32 },
  Wolf_01_Move: { url: wolf01Move, frame: 32 },
  'ballista': { url: ballistaIcon, frame: 32 },
  'bite': { url: biteIcon, frame: 32 },
  'bone-claws': { url: boneClawsIcon, frame: 32 },
  'club': { url: clubIcon, frame: 32 },
  'fangs': { url: fangsIcon, frame: 32 },
  'fire-spell': { url: fireSpellIcon, frame: 32 },
  'fire': { url: fireIcon, frame: 32 },
  'fists': { url: fistsIcon, frame: 32 },
  'great-axe': { url: greatAxeIcon, frame: 32 },
  'heal-staff': { url: healStaffIcon, frame: 32 },
  'health-potion': { url: healthPotionIcon, frame: 32 },
  'iron-axe': { url: ironAxeIcon, frame: 32 },
  'iron-bow': { url: ironBowIcon, frame: 32 },
  'iron-spear': { url: ironSpearIcon, frame: 32 },
  'light': { url: lightIcon, frame: 32 },
  'mana-potion': { url: manaPotionIcon, frame: 32 },
  'master-seal': { url: masterSealIcon, frame: 32 },
  'powder-keg': { url: powderKegIcon, frame: 32 },
  'tackle': { url: tackleIcon, frame: 32 },
  'wooden-armor': { url: woodenArmor, frame: 32 },
  'wooden-axe': { url: woodenAxe, frame: 32 },
  'wooden-shield': { url: woodenShield, frame: 32 },
  'wooden-spear': { url: woodenSpear, frame: 32 },
  'wooden-sword': { url: woodenSword, frame: 32 },
};

// Texture key -> URL, for the UI, which sizes images itself.
export const SPRITE_URLS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(SPRITES).map(([key, { url }]) => [key, url]),
);
