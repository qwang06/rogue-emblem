// Pure rules for tomes: magical weapons (see weapons.ts) that teach their
// spell. Every strike a unit makes with a tome counts towards learning it,
// as long as it doesn't already know the spell; once it has struck with it
// the tome's `teaches.afterUses` times, the tome's slot turns into the
// spell — a weapon that never breaks and stays with the unit — and the
// tome, with whatever uses it has left, moves to the next free slot so
// another unit can learn from it (or is handed back when there's no room).
// A unit's progress is a map of tome id to strikes made, kept on the unit
// across battles. No Phaser, no rendering, no hidden state.

import { addItem, canAddItem, createInventory, findItem, type Inventory, type InventoryEntry } from './items.ts';
import { WEAPONS, weaponEntry, type TomeLesson, type Weapon } from './weapons.ts';

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

// Whether a unit carrying `inventory` already knows the spell `tome`
// teaches.
export function knowsSpell(inventory: Inventory, tome: Tome): boolean {
  return findItem(inventory, tome.teaches.spellId) !== null;
}

// The strikes left before `tome` is learned under `progress`.
export function getUsesToLearn(progress: TomeProgress, tome: Tome): number {
  return Math.max(0, tome.teaches.afterUses - (progress[tome.id] ?? 0));
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

// The inventory once `spell` is learned from the tome at `tomeIndex` (null
// when the tome broke on the strike that taught it, freeing its slot): the
// spell takes the tome's slot, or the end of the inventory, and the tome
// moves to the end. `leftover` is the tome's entry when there's no room to
// keep it, else null.
export function learnSpell(
  inventory: Inventory,
  tomeIndex: number | null,
  spell: Weapon,
): { inventory: Inventory; leftover: InventoryEntry | null } {
  if (tomeIndex === null) return { inventory: addItem(inventory, spell), leftover: null };
  const tome = inventory[tomeIndex];
  if (!tome) throw new Error(`No tome at slot ${tomeIndex}`);
  const taught = createInventory(inventory.map((entry, i) => (i === tomeIndex ? weaponEntry(spell) : entry)));
  if (!canAddItem(taught, tome.item)) return { inventory: taught, leftover: tome };
  return { inventory: createInventory([...taught, tome]), leftover: null };
}
