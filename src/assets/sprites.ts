// Texture key -> URL for every standalone sprite sheet and item icon. GridScene preloads
// them all under these keys; the React UI looks unit portraits up here.
// src/game/tileset.ts names which key each unit draws with.

import gates from './gates.png';
import ginkgoTreeGreen from './ginkgo_tree_green.png';
import goldGinkgoTree from './gold_ginkgo_tree.png';
import mapProps from './map-props.png';
import overworldAutumn from './overworld-autumn.png';
import overworldUnderworld from './overworld-underworld.png';
import overworldStarship from './overworld-starship.png';
import overworldWinter from './overworld-winter.png';
import overworld from './overworld.png';
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

// Every unit sheet in src/assets/units/ but the pack's ships, which no class
// uses yet, keyed by file name without .png (Soldier_02_Idle, Orc_Attack, ...).
const unitSheets = import.meta.glob<string>(
  ['./units/*.png', '!./units/{Battleship,Frigate,FishingBoat,TransportShip}_*.png'],
  { eager: true, import: 'default' },
);
const UNIT_SHEET_URLS: Record<string, string> = Object.fromEntries(
  Object.entries(unitSheets).map(([path, url]) => [path.slice('./units/'.length, -'.png'.length), url]),
);

// Each season's terrain sheet (SEASON_TERRAIN_SHEETS in tileset.ts) by
// texture key. GridScene loads them as 32px spritesheets and tilemap images.
export const TERRAIN_SHEET_URLS: Readonly<Record<string, string>> = {
  overworld,
  'overworld-autumn': overworldAutumn,
  'overworld-winter': overworldWinter,
  'overworld-underworld': overworldUnderworld,
  'overworld-starship': overworldStarship,
};

export const SPRITE_URLS: Readonly<Record<string, string>> = {
  ...UNIT_SHEET_URLS,
  gates,
  ginkgo_tree_green: ginkgoTreeGreen,
  gold_ginkgo_tree: goldGinkgoTree,
  'map-props': mapProps,
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
