// The recorded sounds in src/assets/sounds, by the cue each one plays for.
// A cue with a sample plays it (src/audio/player.ts); the rest, and any
// cue whose sample hasn't loaded yet, play their synthesized voices from
// sfx.ts.

import type { SoundCue } from './cues.ts';
import axe from '../assets/sounds/axe.mp3';
import bow from '../assets/sounds/bow.mp3';
import button from '../assets/sounds/button.mp3';
import campAmbience from '../assets/sounds/camp-ambience.mp3';
import coinsBag from '../assets/sounds/coins-bag.mp3';
import equipChainMail from '../assets/sounds/equip-chain-mail.mp3';
import equipClothes from '../assets/sounds/equip-clothes.mp3';
import equipJewel from '../assets/sounds/equip-jewel.mp3';
import equipLeather from '../assets/sounds/equip-leather.mp3';
import equipPlateArmor from '../assets/sounds/equip-plate-armor.mp3';
import equipRobe from '../assets/sounds/equip-robe.mp3';
import equipWeapon from '../assets/sounds/equip-weapon.mp3';
import equipWoodenWeapon from '../assets/sounds/equip-wooden-weapon.mp3';
import hammer from '../assets/sounds/hammer.mp3';
import levelUp from '../assets/sounds/level-up.mp3';
import potionUse from '../assets/sounds/potion-use.mp3';
import spellAir from '../assets/sounds/spell-air.mp3';
import spellElectricShock from '../assets/sounds/spell-electric-shock.mp3';
import spellFireball from '../assets/sounds/spell-fireball.mp3';
import spellHeal from '../assets/sounds/spell-heal.mp3';
import spellRevive from '../assets/sounds/spell-revive.mp3';
import sword from '../assets/sounds/sword.mp3';
import unequipChainMail from '../assets/sounds/unequip-chain-mail.mp3';
import unequipClothes from '../assets/sounds/unequip-clothes.mp3';
import unequipJewel from '../assets/sounds/unequip-jewel.mp3';
import unequipLeather from '../assets/sounds/unequip-leather.mp3';
import unequipPlateArmor from '../assets/sounds/unequip-plate-armor.mp3';
import unequipRobe from '../assets/sounds/unequip-robe.mp3';
import unequipWeapon from '../assets/sounds/unequip-weapon.mp3';
import unequipWoodenWeapon from '../assets/sounds/unequip-wooden-weapon.mp3';

export const SAMPLE_URLS: Readonly<Partial<Record<SoundCue, string>>> = Object.freeze({
  // Every menu click, pick or cancel.
  button,
  // A blow, by what it's struck with (soundKinds.ts).
  sword,
  axe,
  bow,
  hammer,
  fire: spellFireball,
  shock: spellElectricShock,
  air: spellAir,
  healSpell: spellHeal,
  potion: potionUse,
  levelUp,
  coins: coinsBag,
  // A unit promoted at camp.
  promote: spellRevive,
  'equip-weapon': equipWeapon,
  'equip-wooden': equipWoodenWeapon,
  'equip-chain': equipChainMail,
  'equip-plate': equipPlateArmor,
  'equip-leather': equipLeather,
  'equip-robe': equipRobe,
  'equip-clothes': equipClothes,
  'equip-jewel': equipJewel,
  'unequip-weapon': unequipWeapon,
  'unequip-wooden': unequipWoodenWeapon,
  'unequip-chain': unequipChainMail,
  'unequip-plate': unequipPlateArmor,
  'unequip-leather': unequipLeather,
  'unequip-robe': unequipRobe,
  'unequip-clothes': unequipClothes,
  'unequip-jewel': unequipJewel,
});

// Looping background sounds (see getAmbience in ambience.ts).
export type AmbienceId = 'camp';

export const AMBIENCE_URLS: Readonly<Record<AmbienceId, string>> = Object.freeze({
  camp: campAmbience,
});
