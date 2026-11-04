// The passive a class carries into every battle, by class id: a promoted
// class's (promotions.ts) or a monster's own (the slime's Bounce, the
// troll's Regeneration). Null for a class without one. No Phaser, no
// hidden state.

import { findPromotion } from './promotions.ts';
import { SLIME_PASSIVE } from './Slime.ts';
import { TROLL_PASSIVE } from './Troll.ts';

export interface ClassPassive {
  name: string;
  description: string;
}

const MONSTER_PASSIVES: Readonly<Record<string, ClassPassive>> = Object.freeze({
  slime: SLIME_PASSIVE,
  troll: TROLL_PASSIVE,
});

export function getClassPassive(unitClass: string | null): ClassPassive | null {
  if (!unitClass) return null;
  return findPromotion(unitClass)?.passive ?? MONSTER_PASSIVES[unitClass] ?? null;
}
