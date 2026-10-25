// Place names for a Warband realm: the realm itself and each site on it.
// Names are built from a shared stock of prefixes and a few patterns per
// kind of place, so a town reads like a town ("Ashford") and a battlefield
// like the land it's on ("Greyfen Marsh"). Pure: the same Rng sequence
// always gives the same names.

import type { Rng } from '../../combatStats.ts';
import { randomItem } from '../../rng.ts';
import type { Biome, SiteKind } from './realm.ts';

const PREFIXES: readonly string[] = Object.freeze([
  'Ash',
  'Black',
  'Bram',
  'Briar',
  'Cold',
  'Dun',
  'Elder',
  'Fen',
  'Gold',
  'Grey',
  'Hollow',
  'Iron',
  'Kings',
  'Lark',
  'Marl',
  'Mill',
  'Moss',
  'Oak',
  'Raven',
  'Red',
  'Rook',
  'Stone',
  'Thorn',
  'Wolf',
  'Wych',
]);

const TOWN_ENDINGS = ['ford', 'bridge', 'haven', 'market', 'bury', 'wick', 'gate'];
const VILLAGE_ENDINGS = ['stead', 'field', 'thorpe', 'ley', 'by', 'combe'];
const SAINTS = ['Aldric', 'Brigid', 'Corwin', 'Elsbeth', 'Odo', 'Maren', 'Ivo', 'Hild'];

// Battlefields are named for the land: a prefix and one of these.
const BATTLE_PATTERNS: Readonly<Record<Biome, readonly ((prefix: string) => string)[]>> = {
  meadow: [(p) => `${p} Fields`, (p) => `${p} Moor`, (p) => `${p} Downs`],
  lake: [(p) => `${p}mere`, (p) => `Lake ${p}`, (p) => `${p} Marsh`],
  forest: [(p) => `${p}wood`, (p) => `${p} Forest`, (p) => `${p} Thicket`],
  hills: [(p) => `${p} Crag`, (p) => `${p} Pass`, (p) => `${p} Tor`],
};

const REALM_ADJECTIVES = ['Ashen', 'Broken', 'Grey', 'Hollow', 'Iron', 'Last', 'Red', 'Sundered', 'Wild'];
const REALM_NOUNS = ['March', 'Reach', 'Vale', 'Frontier', 'Marches', 'Wilds', 'Borderland'];

// A name for the whole realm, e.g. "The Sundered Reach".
export function nameRealm(rng: Rng): string {
  return `The ${randomItem(rng, REALM_ADJECTIVES)} ${randomItem(rng, REALM_NOUNS)}`;
}

// A name for a site of `kind` in `biome`. `taken` is the names already
// given; a clash is rolled again (a few times, then numbered) so every
// site's name is its own. The Hold is named by the caller (after its
// region), so it isn't handled here.
export function nameSite(kind: SiteKind, biome: Biome, rng: Rng, taken: ReadonlySet<string>): string {
  for (let attempt = 0; attempt < 20; attempt++) {
    const name = rollName(kind, biome, rng);
    if (!taken.has(name)) return name;
  }
  const base = rollName(kind, biome, rng);
  let n = 2;
  while (taken.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

function rollName(kind: SiteKind, biome: Biome, rng: Rng): string {
  const prefix = randomItem(rng, PREFIXES);
  switch (kind) {
    case 'home':
      return `${prefix}${randomItem(rng, VILLAGE_ENDINGS)} Camp`;
    case 'town':
      return `${prefix}${randomItem(rng, TOWN_ENDINGS)}`;
    case 'village':
      return `${prefix}${randomItem(rng, VILLAGE_ENDINGS)}`;
    case 'shrine':
      return `Shrine of St. ${randomItem(rng, SAINTS)}`;
    case 'fort':
      return `Fort ${prefix}`;
    case 'elite':
      return randomItem(rng, [`${prefix} Lair`, `${prefix} Den`, `${prefix} Barrow`]);
    case 'event':
      return randomItem(rng, [`${prefix} Crossroads`, `${prefix} Wayside`, `Old ${prefix} Road`]);
    case 'battle':
    case 'hold':
      return randomItem(rng, BATTLE_PATTERNS[biome])(prefix);
  }
}
