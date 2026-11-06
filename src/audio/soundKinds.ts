// What a blow or a piece of gear sounds like, as a name the sound cues
// (cues.ts) and the recorded samples (samples.ts) share. The scene tags a
// strike's damage number with its weapon's sound, and the equipment
// screen tags each worn item with its gear sound, so the audio layer can
// pick the matching sample from what's on screen.

import type { Gear } from '../game/equipment.ts';
import type { Skill } from '../game/skills.ts';
import type { Weapon } from '../game/weapons.ts';

// A blow: a blade, an axe, an arrow, a blunt hit, or a spell.
export type StrikeSound = 'sword' | 'axe' | 'bow' | 'hammer' | 'fire' | 'shock' | 'air';

// Putting on or taking off gear, by what it's made of.
export type GearSound = 'weapon' | 'wooden' | 'chain' | 'plate' | 'leather' | 'robe' | 'clothes' | 'jewel';

export const GEAR_SOUNDS: readonly GearSound[] = Object.freeze([
  'weapon',
  'wooden',
  'chain',
  'plate',
  'leather',
  'robe',
  'clothes',
  'jewel',
]);

// Weapons that don't sound like the rest of their family.
const WEAPON_SOUND_BY_ID: Readonly<Record<string, StrikeSound>> = Object.freeze({
  club: 'hammer',
  'stone-maul': 'hammer',
  'great-axe': 'axe',
  'fire-breath': 'fire',
  'powder-keg': 'fire',
  ballista: 'bow',
});

// Skills whose blow is a spell or a gust rather than the user's weapon.
const SKILL_SOUND_BY_ID: Readonly<Record<string, StrikeSound>> = Object.freeze({
  'wing-buffet': 'air',
  'strafing-run': 'air',
  blast: 'fire',
  fireball: 'fire',
  inferno: 'fire',
  flare: 'fire',
  smite: 'shock',
  'holy-strike': 'shock',
  'frost-lance': 'shock',
  siphon: 'shock',
  'throw-stones': 'hammer',
  'shield-bash': 'hammer',
  'bulwark-bash': 'hammer',
  'crushing-blow': 'hammer',
  earthshaker: 'hammer',
});

// The sound of a blow struck with `weapon`, or null for one with no
// recording (fists, claws, fangs: the synthesized hit plays).
export function getWeaponSound(weapon: Weapon | null | undefined): StrikeSound | null {
  if (!weapon) return null;
  const byId = WEAPON_SOUND_BY_ID[weapon.id];
  if (byId) return byId;
  switch (weapon.type) {
    case 'sword':
    case 'dagger':
    case 'spear':
      return 'sword';
    case 'axe':
      return 'axe';
    case 'bow':
    case 'siege':
      return 'bow';
    case 'staff':
      return 'hammer';
    case 'tome':
      return weapon.id.includes('fire') ? 'fire' : 'shock';
    default:
      return null;
  }
}

// The sound of a skill's blow: its own, else the user's weapon's.
export function getSkillSound(skill: Skill, weapon: Weapon | null | undefined): StrikeSound | null {
  return SKILL_SOUND_BY_ID[skill.id] ?? getWeaponSound(weapon);
}

// The sound of putting on (or taking off) `gear`.
export function getGearSound(gear: Gear): GearSound {
  if (gear.kind === 'staff') return 'wooden';
  if (gear.kind === 'weapon') return gear.id.startsWith('wooden') ? 'wooden' : 'weapon';
  switch (gear.slot) {
    case 'shield':
      return 'plate';
    case 'head':
    case 'body':
      if (gear.weightClass === 'light') return 'leather';
      if (gear.weightClass === 'cloth') return gear.slot === 'body' ? 'robe' : 'clothes';
      if (gear.weightClass === 'heavy') return gear.slot === 'body' ? 'plate' : 'chain';
      return 'clothes';
    default:
      return 'jewel';
  }
}
