// A Beast Tamer's whelp growing up (Whelp.ts): once it has reached
// WHELP_GROWN_LEVEL, its saved snapshot becomes a Beast's, with the stats
// the Beast starts above the whelp added (max HP and MP with their current
// values). Everything it has (level, XP, items, boons, quirk) is kept. No
// Master Seal: it grows on its own, the next time the run saves it. Pure.

import { WHELP_GROWN_LEVEL, WHELP_GROWTH_BONUSES } from '../Whelp.ts';
import type { UnitSnapshot } from './run.ts';

// Whether `unit` is a whelp ready to grow up.
export function canGrowUp(unit: Pick<UnitSnapshot, 'classId' | 'level'>): boolean {
  return unit.classId === 'whelp' && unit.level >= WHELP_GROWN_LEVEL;
}

// `unit` grown into a Beast if it's ready (canGrowUp), else itself.
export function growUpWhelp(unit: UnitSnapshot): UnitSnapshot {
  if (!canGrowUp(unit)) return unit;
  const bonus = WHELP_GROWTH_BONUSES;
  return Object.freeze({
    ...unit,
    classId: 'beast',
    maxHealth: unit.maxHealth + bonus.health,
    health: unit.health + bonus.health,
    maxMana: unit.maxMana + bonus.mana,
    mana: unit.mana + bonus.mana,
    strength: unit.strength + bonus.strength,
    intelligence: unit.intelligence + bonus.intelligence,
    skill: unit.skill + bonus.skill,
    speed: unit.speed + bonus.speed,
    luck: unit.luck + bonus.luck,
    defense: unit.defense + bonus.defense,
    resistance: unit.resistance + bonus.resistance,
  });
}
