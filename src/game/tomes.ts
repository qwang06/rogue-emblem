// Pure rules for tomes: magical weapons (see weapons.ts) that teach their
// spell. Every strike a unit makes with a tome counts towards learning it,
// as long as it doesn't already know the spell; once it has struck with it
// the tome's `teaches.afterUses` times, the spell joins the unit's innate
// attacks for good (see Unit.innate), and the tome stays in its hand, free
// to be handed to another unit to learn from. A unit's progress is a map
// of tome id to strikes made, kept on the unit across battles. No Phaser,
// no rendering, no hidden state.

import { WEAPONS, type TomeLesson, type Weapon } from './weapons.ts';

// Strikes made with each tome not yet learned from, by tome id.
export type TomeProgress = Readonly<Record<string, number>>;

export type Tome = Weapon & { teaches: TomeLesson };

export function isTome(weapon: Weapon): weapon is Tome {
  return weapon.teaches !== undefined;
}

// The spell weapon `tome` teaches, looked up in `weapons`. Throws if it
// isn't there.
export function getTomeSpell(tome: Tome, weapons: readonly Weapon[] = WEAPONS): Weapon {
  const spell = weapons.find((weapon) => weapon.id === tome.teaches.spellId);
  if (!spell) throw new Error(`Unknown spell: ${tome.teaches.spellId}`);
  return spell;
}

// Whether a unit with the innate attacks `innate` already knows the spell
// `tome` teaches.
export function knowsSpell(innate: readonly Weapon[], tome: Tome): boolean {
  return innate.some((weapon) => weapon.id === tome.teaches.spellId);
}

// Counts one strike with `tome` and returns { progress, learned }: learned
// is true when that strike reaches the tome's count, and the tome then
// drops out of progress.
export function recordTomeUse(progress: TomeProgress, tome: Tome): { progress: TomeProgress; learned: boolean } {
  const used = (progress[tome.id] ?? 0) + 1;
  if (used >= tome.teaches.afterUses) {
    const { [tome.id]: _learned, ...rest } = progress;
    return { progress: Object.freeze(rest), learned: true };
  }
  return { progress: Object.freeze({ ...progress, [tome.id]: used }), learned: false };
}
