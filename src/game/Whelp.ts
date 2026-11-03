import { BEAST_GROWTHS, BEAST_ITEMS, BEAST_STATS, BEAST_WEAPON_TYPES } from './Beast.ts';
import { Unit, type ClassUnitOptions } from './Unit.ts';

// A young beast, raised by the Beast Tamer origin (warband/origins.ts): a
// Beast that hasn't grown into its wings yet. It starts about as strong as
// a villager, so the origin's second unit doesn't outclass the warband,
// and grows into a full Beast at WHELP_GROWN_LEVEL (see
// warband/whelp.ts). It isn't a recruit or a promotion.
export const WHELP_STATS = Object.freeze({
  health: 10,
  mana: 1,
  strength: 2,
  intelligence: 0,
  dexterity: 2,
  speed: 3,
  luck: 1,
  defense: 1,
  resistance: 0,
  movement: 5,
});

// The level it grows up into a Beast at, the level a villager promotes at.
export const WHELP_GROWN_LEVEL = 5;

// Starts at level 1 with the stat line above, the Beast's growths and its
// Bite; it learns no skills until it's grown.
export class Whelp extends Unit {
  constructor({ name = 'Whelp', team, level = 1, items = BEAST_ITEMS, faction }: ClassUnitOptions) {
    super({
      name,
      unitClass: 'whelp',
      level,
      team,
      faction,
      items,
      weaponTypes: BEAST_WEAPON_TYPES,
      growths: BEAST_GROWTHS,
      ...WHELP_STATS,
    });
  }
}

// What growing up adds to each stat: how far the Beast starts above the
// whelp (MOV comes with the Beast's class).
export const WHELP_GROWTH_BONUSES = Object.freeze(
  Object.fromEntries(
    (Object.keys(WHELP_STATS) as (keyof typeof WHELP_STATS)[])
      .filter((stat) => stat !== 'movement')
      .map((stat) => [stat, Math.max(0, BEAST_STATS[stat] - WHELP_STATS[stat])]),
  ) as Readonly<Record<Exclude<keyof typeof WHELP_STATS, 'movement'>, number>>,
);
