// Names for the unit a new Warband Mode run starts with. The New Run menu
// offers a generated name the player can reroll or type over; whichever
// name they settle on is the unit's name for the whole run.

import type { Rng } from '../combatStats.ts';

// The longest name a unit can have, so it fits the menus and panels.
export const MAX_NAME_LENGTH = 12;

// The names generateName picks from.
export const WARBAND_NAMES: readonly string[] = Object.freeze([
  'Alden',
  'Bryn',
  'Cael',
  'Dara',
  'Edric',
  'Fenna',
  'Garret',
  'Hale',
  'Isolde',
  'Jory',
  'Kestrel',
  'Lysa',
  'Maren',
  'Nolan',
  'Orla',
  'Perrin',
  'Quill',
  'Rowan',
  'Sabine',
  'Tamsin',
  'Ulric',
  'Vesna',
  'Wren',
  'Yara',
  'Aldous',
  'Brenna',
  'Corin',
  'Delphine',
  'Emrys',
  'Faye',
  'Gideon',
  'Hollis',
  'Ilse',
  'Jasper',
  'Kael',
  'Linnea',
  'Merrick',
  'Nessa',
  'Osric',
  'Pell',
  'Rhosyn',
  'Soren',
  'Tobin',
  'Una',
  'Varek',
  'Willa',
  'Ysolde',
  'Zephyr',
]);

// A name from `names`, picked with `rng`: never `avoid` (e.g. the name
// being rerolled) unless it's the only one there is. Throws on an empty list.
export function generateName(rng: Rng, avoid?: string, names: readonly string[] = WARBAND_NAMES): string {
  if (names.length === 0) throw new Error('No names to pick from');
  const choices = names.filter((name) => name !== avoid);
  const pool = choices.length > 0 ? choices : names;
  return pool[Math.floor(rng() * pool.length)];
}

// A typed name made fit for a unit: control characters dropped, runs of
// spaces collapsed, trimmed, and cut to MAX_NAME_LENGTH characters. Null
// if nothing is left.
export function cleanName(text: string): string | null {
  const spaced = text.replace(/\s+/g, ' ').replace(/[\u0000-\u001f\u007f]/g, '');
  const name = Array.from(spaced.trim()).slice(0, MAX_NAME_LENGTH).join('').trim();
  return name.length > 0 ? name : null;
}
