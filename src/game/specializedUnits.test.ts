import { describe, expect, it } from 'vitest';
import { Beast, BEAST_CAPS, BEAST_GROWTHS, BEAST_ITEMS, BEAST_STATS, BEAST_WEAPON_TYPES } from './Beast.ts';
import {
  BeastRider,
  BEAST_RIDER_CAPS,
  BEAST_RIDER_GROWTHS,
  BEAST_RIDER_ITEMS,
  BEAST_RIDER_STATS,
  BEAST_RIDER_WEAPON_TYPES,
} from './BeastRider.ts';
import { DEFAULT_ENEMY_FACTION, PLAYER_FACTION } from './factions.ts';
import { getStandingCombatBonus } from './modifiers.ts';
import { Ram, RAM_CAPS, RAM_GROWTHS, RAM_ITEMS, RAM_STATS, RAM_WEAPON_TYPES } from './Ram.ts';
import {
  Sapper,
  SAPPER_CAPS,
  SAPPER_GROWTHS,
  SAPPER_ITEMS,
  SAPPER_PASSIVE,
  SAPPER_STATS,
  SAPPER_WEAPON_TYPES,
} from './Sapper.ts';
import { Scout, SCOUT_CAPS, SCOUT_GROWTHS, SCOUT_ITEMS, SCOUT_STATS, SCOUT_WEAPON_TYPES } from './Scout.ts';
import { Siege, SIEGE_CAPS, SIEGE_GROWTHS, SIEGE_ITEMS, SIEGE_STATS, SIEGE_WEAPON_TYPES } from './Siege.ts';
import type { ClassUnitOptions, Unit } from './Unit.ts';

// The classes added with the faction rework share one shape, so they are
// tested together: each is checked against its own exported tables.
const CLASSES = [
  [
    'sapper',
    'Sapper',
    (o: ClassUnitOptions) => new Sapper(o),
    SAPPER_STATS,
    SAPPER_GROWTHS,
    SAPPER_CAPS,
    SAPPER_WEAPON_TYPES,
    SAPPER_ITEMS,
  ],
  [
    'scout',
    'Scout',
    (o: ClassUnitOptions) => new Scout(o),
    SCOUT_STATS,
    SCOUT_GROWTHS,
    SCOUT_CAPS,
    SCOUT_WEAPON_TYPES,
    SCOUT_ITEMS,
  ],
  [
    'beast',
    'Beast',
    (o: ClassUnitOptions) => new Beast(o),
    BEAST_STATS,
    BEAST_GROWTHS,
    BEAST_CAPS,
    BEAST_WEAPON_TYPES,
    BEAST_ITEMS,
  ],
  [
    'beast-rider',
    'Beast Rider',
    (o: ClassUnitOptions) => new BeastRider(o),
    BEAST_RIDER_STATS,
    BEAST_RIDER_GROWTHS,
    BEAST_RIDER_CAPS,
    BEAST_RIDER_WEAPON_TYPES,
    BEAST_RIDER_ITEMS,
  ],
  [
    'siege',
    'Siege',
    (o: ClassUnitOptions) => new Siege(o),
    SIEGE_STATS,
    SIEGE_GROWTHS,
    SIEGE_CAPS,
    SIEGE_WEAPON_TYPES,
    SIEGE_ITEMS,
  ],
  ['ram', 'Ram', (o: ClassUnitOptions) => new Ram(o), RAM_STATS, RAM_GROWTHS, RAM_CAPS, RAM_WEAPON_TYPES, RAM_ITEMS],
] as const;

describe.each(CLASSES)('%s', (id, label, create, stats, growths, caps, weaponTypes, items) => {
  const build = (options: ClassUnitOptions): Unit => create(options);

  it('is a level-1 unit of its class, named after it', () => {
    const unit = build({ team: 'player' });
    expect(unit.unitClass).toBe(id);
    expect(unit.name).toBe(label);
    expect(unit.level).toBe(1);
  });

  it('uses its stat line, growths, caps and weapon types', () => {
    const unit = build({ team: 'enemy' });
    expect(unit.maxHealth).toBe(stats.health);
    expect(unit.strength).toBe(stats.strength);
    expect(unit.defense).toBe(stats.defense);
    expect(unit.movement).toBe(stats.movement);
    expect(unit.growths).toBe(growths);
    expect(unit.caps).toBe(caps);
    expect(unit.weaponTypes).toEqual(weaponTypes);
  });

  it('carries its starting items and can wield its weapon', () => {
    const unit = build({ team: 'player' });
    expect(unit.items).toEqual(items);
    expect(unit.weapon).toEqual(items[0].item);
  });

  it("takes its team's faction, or the one it's given", () => {
    expect(build({ team: 'player' }).faction).toBe(PLAYER_FACTION);
    expect(build({ team: 'enemy' }).faction).toBe(DEFAULT_ENEMY_FACTION);
    expect(build({ team: 'enemy', faction: 'verdant' }).faction).toBe('verdant');
  });
});

describe('Sapper', () => {
  it('carries its Demolitions passive', () => {
    const unit = new Sapper({ team: 'player' });
    expect(unit.modifiers).toEqual(SAPPER_PASSIVE.modifiers);
    expect(getStandingCombatBonus(unit.modifiers).crit).toBe(5);
  });
});
