// Pure rules for curses: what cursed gear costs. A curse makes the enemy
// side stronger, and only in battles where a unit carrying it is deployed:
// a unit holds its curses for the battle (`Unit.curses`, set by whatever
// gives it the cursed gear), and as the battle starts (startBattle in
// battle/commands.ts) the deployed units' curses all fall on the enemies
// (applyCurses), stacking. Kinds:
// - 'enemy-surge': every enemy's stats grow by `percent`% (like a stage's
//   surge, see warband/enemyCurve.ts).
// - 'enemy-affix': every enemy carries the elite affix `affixId`
//   (warband/elites.ts), e.g. Keen, Swift or Regenerating.
// - 'elite-enemy': the strongest enemy that isn't the boss carries
//   `affixes` random elite affixes and is ranked an elite.
// - 'boss-modifiers': the boss (the strongest enemy without one) carries
//   `modifiers`, e.g. the same effect as the gear (a mirror curse).
// No Phaser, no hidden state beyond the units it's given.

import type { Rng } from './combatStats.ts';
import { applyModifiers, type Modifier } from './modifiers.ts';
import { shuffle } from './rng.ts';
import type { Unit } from './Unit.ts';
import { applySurge } from './warband/enemyCurve.ts';
import { ELITE_AFFIXES, findEliteAffix } from './warband/elites.ts';

export type Curse =
  | { kind: 'enemy-surge'; percent: number }
  | { kind: 'enemy-affix'; affixId: string }
  | { kind: 'elite-enemy'; affixes: number }
  | { kind: 'boss-modifiers'; modifiers: readonly Modifier[] };

// Every curse the deployed units among `units` carry, in order.
export function getDeployedCurses(units: ReadonlyMap<string, Unit>, deployed: readonly string[]): Curse[] {
  return deployed.flatMap((unitId) => units.get(unitId)?.curses ?? []);
}

// The enemy a curse aimed at the boss falls on: the one ranked boss, else
// the one with the most max HP (the first on a tie), or null for none.
export function getCurseBoss(enemies: readonly Unit[]): Unit | null {
  return enemies.find((unit) => unit.rank === 'boss') ?? strongest(enemies);
}

function strongest(units: readonly Unit[]): Unit | null {
  return units.reduce<Unit | null>((best, unit) => (!best || unit.maxHealth > best.maxHealth ? unit : best), null);
}

// Lays `curses` on `enemies` (units freshly built for the battle, or
// clones: it changes them), with `rng` picking an elite's affixes. Surges
// add up (two +15% curses make +30%) before they apply.
export function applyCurses(enemies: readonly Unit[], curses: readonly Curse[], rng: Rng): void {
  if (curses.length === 0 || enemies.length === 0) return;
  const surge = curses.reduce((total, curse) => total + (curse.kind === 'enemy-surge' ? curse.percent : 0), 0);
  if (surge > 0) for (const unit of enemies) applySurge(unit, 100 + surge);
  for (const curse of curses) {
    switch (curse.kind) {
      case 'enemy-surge':
        break;
      case 'enemy-affix': {
        const affix = findEliteAffix(curse.affixId);
        if (!affix) throw new Error(`Unknown elite affix ${curse.affixId}`);
        for (const unit of enemies) giveAffixes(unit, [affix.id]);
        break;
      }
      case 'elite-enemy': {
        const boss = getCurseBoss(enemies);
        const elite = strongest(enemies.filter((unit) => unit !== boss && unit.rank !== 'elite'));
        if (!elite) break;
        const affixes = shuffle(rng, ELITE_AFFIXES).slice(0, curse.affixes);
        giveAffixes(
          elite,
          affixes.map((affix) => affix.id),
        );
        if (affixes.length > 0) {
          elite.name = `${affixes[0].name} ${elite.name.replace(/^Enemy /, '')}`;
          elite.rank = 'elite';
        }
        break;
      }
      case 'boss-modifiers': {
        const boss = getCurseBoss(enemies);
        if (boss) applyModifiers(boss, curse.modifiers);
        break;
      }
    }
  }
}

// Gives `unit` the elite affixes `ids` (their modifiers and their ids).
function giveAffixes(unit: Unit, ids: readonly string[]) {
  const affixes = ids.map((id) => findEliteAffix(id)!);
  applyModifiers(
    unit,
    affixes.flatMap((affix) => affix.modifiers),
  );
  unit.eliteAffixes = Object.freeze([...unit.eliteAffixes, ...ids]);
}
