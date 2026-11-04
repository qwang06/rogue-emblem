// Run trophies: boons whose gains outlast the battle and stack for the
// whole run, so a unit that keeps killing keeps growing (there are no stat
// caps). After every won stage, each unit that fought and lives is grown
// by what it carries (getBoonModifiers of its boons):
// - 'soul-harvest': `amount` max HP (and HP) for every foe it felled;
// - 'trophy-hunter': `amount` to its highest stat of STR, INT, DEX, SPD,
//   DEF and RES (the first on a tie) if it felled any foe.
// finishStage (run.ts) applies it to the snapshots. Pure.
import { getBoonModifiers } from './boons.ts';
import type { UnitSnapshot } from './run.ts';
import { sumModifiers } from '../modifiers.ts';

const TROPHY_STATS = ['strength', 'intelligence', 'dexterity', 'speed', 'defense', 'resistance'] as const;

// `snapshot` grown by its run trophies for felling `kills` foes in a won
// stage; the same snapshot when it has none or felled nobody.
export function applyTrophies(snapshot: UnitSnapshot, kills: number): UnitSnapshot {
  if (kills <= 0 || !snapshot.boons?.length) return snapshot;
  const modifiers = getBoonModifiers(snapshot.boons);
  const health = sumModifiers(modifiers, 'soul-harvest') * kills;
  const trophy = sumModifiers(modifiers, 'trophy-hunter');
  if (health === 0 && trophy === 0) return snapshot;
  const best = TROPHY_STATS.reduce((top, stat) => (snapshot[stat] > snapshot[top] ? stat : top), TROPHY_STATS[0]);
  return Object.freeze({
    ...snapshot,
    maxHealth: snapshot.maxHealth + health,
    health: snapshot.health + health,
    ...(trophy > 0 && { [best]: snapshot[best] + trophy }),
  });
}
