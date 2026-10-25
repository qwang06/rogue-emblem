// Elite affixes: what makes the enemies at a realm's elite lair (see
// realm/realm.ts) harder than an ordinary battle's, like Slay the Spire's
// elites. A lair rolls two affixes from its run's seed and depth
// (rollEliteAffixes), and every enemy there carries one of them, the boss
// both (applyEliteAffixes), named before its class ("Armored Goblin") and
// listed on its unit info screen. Each affix is plain modifiers
// (modifiers.ts), so the combat rules read it like a relic. Winning a lair
// pays a pick of relics instead of the usual rewards (rewards.ts). Pure
// data and functions; applyEliteAffixes changes the units it's given,
// which are freshly built for the battle.

import { applyModifiers, type Modifier } from '../modifiers.ts';
import { createSeededRng, shuffle } from '../rng.ts';
import type { Unit } from '../Unit.ts';

export interface EliteAffix {
  id: string;
  name: string;
  description: string;
  modifiers: readonly Modifier[];
}

function affix(id: string, name: string, description: string, modifiers: readonly Modifier[]): EliteAffix {
  return Object.freeze({ id, name, description, modifiers: Object.freeze(modifiers.map((m) => Object.freeze(m))) });
}

export const ELITE_AFFIXES: readonly EliteAffix[] = Object.freeze([
  affix('armored', 'Armored', 'Takes 3 less damage from each hit.', [{ kind: 'combat', term: 'guard', amount: 3 }]),
  affix('swift', 'Swift', '+1 MOV and +20 avoid.', [
    { kind: 'movement', amount: 1 },
    { kind: 'combat', term: 'avoid', amount: 20 },
  ]),
  affix('berserk', 'Berserk', 'Deals +4 damage while under half HP.', [
    { kind: 'combat', term: 'damage', amount: 4, when: 'wounded' },
  ]),
  affix('regenerating', 'Regenerating', 'Recovers 3 HP at the start of each of its phases.', [
    { kind: 'phase-heal', amount: 3 },
  ]),
  affix('keen', 'Keen', '+10 hit and +15 crit.', [
    { kind: 'combat', term: 'hit', amount: 10 },
    { kind: 'combat', term: 'crit', amount: 15 },
  ]),
  affix('brutal', 'Brutal', 'Deals +2 damage when it attacks.', [
    { kind: 'combat', term: 'damage', amount: 2, when: 'attacking' },
  ]),
]);

// How many affixes a lair rolls.
export const ELITE_AFFIX_COUNT = 2;

export function findEliteAffix(id: string): EliteAffix | null {
  return ELITE_AFFIXES.find((candidate) => candidate.id === id) ?? null;
}

// The affixes the elite lair at `depth` of a run started with `runSeed`
// fields: ELITE_AFFIX_COUNT different ones, always the same for the pair.
export function rollEliteAffixes(runSeed: number, depth: number): EliteAffix[] {
  const rng = createSeededRng((runSeed ^ Math.imul(depth + 0x3c, 0x27d4eb2d) ^ 0x656c6974) >>> 0);
  return shuffle(rng, ELITE_AFFIXES).slice(0, ELITE_AFFIX_COUNT);
}

// Gives the enemies among `units` (in their map order) `affixes` in turn,
// one each, and the boss (`bossUnitId`) all of them: each affix's
// modifiers, its id in `eliteAffixes`, and its name before the unit's.
export function applyEliteAffixes(
  units: ReadonlyMap<string, Unit>,
  affixes: readonly EliteAffix[],
  bossUnitId?: string,
): void {
  if (affixes.length === 0) return;
  let turn = 0;
  for (const [unitId, unit] of units) {
    if (unit.team !== 'enemy') continue;
    const given = unitId === bossUnitId ? affixes : [affixes[turn++ % affixes.length]];
    applyModifiers(
      unit,
      given.flatMap((one) => one.modifiers),
    );
    unit.eliteAffixes = Object.freeze([...unit.eliteAffixes, ...given.map((one) => one.id)]);
    if (unitId !== bossUnitId) unit.name = `${given[0].name} ${unit.name.replace(/^Enemy /, '')}`;
  }
}
