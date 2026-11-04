// Signature and cursed gear: worn items that bend a rule instead of only
// adding numbers (see the gear design doc). Each carries its effect as
// modifiers (modifiers.ts) and, when cursed, the enemy-side cost as curses
// (curses.ts); Unit.modifiers and Unit.curses read them from what a unit
// wears (equipment.ts). Three kits come first, each a weapon, armor and an
// accessory or two, with a cursed upgrade:
// - Reaper: chain kills across the map (Encore, execute, kill stacks).
// - Mark and exploit: lay debuffs, then cash in on them.
// - Thorns tank: walk into the enemy line, taunt, and let their attacks
//   hurt them.
// Then one signature item for each monster class's special slot, so two
// monsters of a class can play differently. Pure data.

import type { Rng } from './combatStats.ts';
import type { Curse } from './curses.ts';
import type { Equipment } from './equipment.ts';
import type { Armor, ArmorSlot } from './items.ts';
import type { Modifier } from './modifiers.ts';
import type { Hands, Weapon } from './weapons.ts';

function gearWeapon(
  id: string,
  label: string,
  stats: {
    hands: Hands;
    power: number;
    hit: number;
    crit: number;
    weight: number;
    minRange?: number;
    maxRange?: number;
  },
  modifiers: readonly Modifier[],
  curses: readonly Curse[] = [],
): Weapon {
  return Object.freeze({
    kind: 'weapon',
    id,
    label,
    type: 'physical',
    minRange: 1,
    maxRange: 1,
    ...stats,
    modifiers: freezeAll(modifiers),
    ...(curses.length > 0 && { curses: freezeAll(curses) }),
  });
}

function gearArmor(
  id: string,
  label: string,
  slot: ArmorSlot,
  { defense = 0, weight = 0, forClass }: { defense?: number; weight?: number; forClass?: string },
  modifiers: readonly Modifier[],
  curses: readonly Curse[] = [],
): Armor {
  return Object.freeze({
    kind: 'armor',
    id,
    label,
    slot,
    defense,
    weight,
    ...(forClass && { forClass }),
    modifiers: freezeAll(modifiers),
    ...(curses.length > 0 && { curses: freezeAll(curses) }),
  });
}

function freezeAll<T extends object>(list: readonly T[]): readonly T[] {
  return Object.freeze(list.map((one) => Object.freeze({ ...one })));
}

// ---- Reaper ----

// A kill lets the wielder move and act again, once a phase.
export const REAPERS_SCYTHE = gearWeapon(
  'reapers-scythe',
  "Reaper's Scythe",
  { hands: 2, power: 2, hit: 70, crit: 5, weight: 6 },
  [{ kind: 'encore' }],
);
// Double damage to a foe under half HP, but clumsy against one unhurt.
export const EXECUTIONERS_AXE = gearWeapon(
  'executioners-axe',
  "Executioner's Axe",
  { hands: 1, power: 3, hit: 70, crit: 0, weight: 6 },
  [
    { kind: 'combat', term: 'damage-percent', amount: 100, when: 'vs-wounded' },
    { kind: 'combat', term: 'hit', amount: -20, when: 'vs-unhurt' },
  ],
);
// +1 DEF and +1 damage for each tenth of max HP missing.
export const BLOODSOAKED_HIDE = gearArmor('bloodsoaked-hide', 'Bloodsoaked Hide', 'body', { defense: 1, weight: 2 }, [
  { kind: 'missing-health-bonus', term: 'guard', amount: 1 },
  { kind: 'missing-health-bonus', term: 'damage', amount: 1 },
]);
// A killing crit heals the wearer by the damage past the foe's HP.
export const BLOODSTONE_RING = gearArmor('bloodstone-ring', 'Bloodstone Ring', 'accessory', {}, [
  { kind: 'overkill-heal' },
]);
// Cursed: a kill fully heals and adds +2 damage for the battle; every
// enemy has +15% stats.
export const BLOOD_CROWN = gearArmor(
  'blood-crown',
  'Blood Crown',
  'accessory',
  {},
  [
    { kind: 'kill-heal-percent', percent: 100 },
    { kind: 'kill-stack', term: 'damage', amount: 2 },
  ],
  [{ kind: 'enemy-surge', percent: 15 }],
);

// ---- Mark and exploit ----

// A hit leaves the foe Marked; +3 damage against Marked foes.
export const HUNTERS_LONGBOW = gearWeapon(
  'hunters-longbow',
  "Hunter's Longbow",
  { hands: 2, power: 2, hit: 75, crit: 0, weight: 3, minRange: 2, maxRange: 3 },
  [
    { kind: 'status-on-hit', status: 'marked' },
    { kind: 'combat', term: 'damage', amount: 3, when: 'vs-marked' },
  ],
);
// +10 crit for each debuff on the foe; a crit leaves it Sundered.
export const STILETTO = gearWeapon('stiletto', 'Stiletto', { hands: 1, power: 0, hit: 90, crit: 10, weight: 1 }, [
  { kind: 'crit-per-foe-debuff', amount: 10 },
  { kind: 'status-on-hit', status: 'sundered', on: 'crit' },
]);
// Weightless; +30 avoid until its next phase after it waits.
export const SHADOW_MANTLE = gearArmor('shadow-mantle', 'Shadow Mantle', 'body', {}, [{ kind: 'veil-on-wait' }]);
// The debuffs the wearer lays last one more of the foe's phases.
export const HEXED_LOCKET = gearArmor('hexed-locket', 'Hexed Locket', 'accessory', {}, [{ kind: 'linger-debuffs' }]);
// A debuffed foe the wearer fells passes its debuffs to the foe nearest it.
export const PLAGUE_BROOCH = gearArmor('plague-brooch', 'Plague Brooch', 'accessory', {}, [{ kind: 'contagion' }]);
// Cursed: +4 damage against debuffed foes and +15 crit against Marked
// ones; one enemy becomes an elite with two affixes.
export const WARLORDS_BANNER = gearArmor(
  'warlords-banner',
  "Warlord's Banner",
  'accessory',
  {},
  [
    { kind: 'combat', term: 'damage', amount: 4, when: 'vs-debuffed' },
    { kind: 'combat', term: 'crit', amount: 15, when: 'vs-marked' },
  ],
  [{ kind: 'elite-enemy', affixes: 2 }],
);

// ---- Thorns tank ----

// Counters hit 50% harder and never miss; 2 less damage on its own attacks.
export const RIPOSTE_BLADE = gearWeapon(
  'riposte-blade',
  'Riposte Blade',
  { hands: 1, power: 2, hit: 80, crit: 0, weight: 3 },
  [
    { kind: 'combat', term: 'damage-percent', amount: 50, when: 'defending' },
    { kind: 'sure-hit', when: 'defending' },
    { kind: 'combat', term: 'damage', amount: -2, when: 'attacking' },
  ],
);
// A foe that strikes the wearer from the next tile takes 3 damage.
export const SPIKED_BUCKLER = gearArmor('spiked-buckler', 'Spiked Buckler', 'shield', { defense: 1, weight: 2 }, [
  { kind: 'thorns', amount: 3 },
]);
// Taunts the foes beside the wearer as its phase starts.
export const WARDENS_AEGIS = gearArmor('wardens-aegis', "Warden's Aegis", 'shield', { defense: 2, weight: 4 }, [
  { kind: 'taunt-aura' },
]);
// 30% of the damage the wearer takes goes back to the attacker, 50% while
// it's Taunting.
export const THORNMAIL = gearArmor('thornmail', 'Thornmail', 'body', { defense: 2, weight: 5 }, [
  { kind: 'reflect', percent: 30 },
  { kind: 'reflect', percent: 20, status: 'taunting' },
]);
// The wearer's recoil leaves its attacker Sundered.
export const BRIAR_CHARM = gearArmor('briar-charm', 'Briar Charm', 'accessory', {}, [
  { kind: 'status-on-recoil', status: 'sundered' },
]);
// Cursed: +8 DEF, 4 less damage from every hit and 5 thorns; every enemy
// is Brutal.
export const GRAVEBOUND_PLATE = gearArmor(
  'gravebound-plate',
  'Gravebound Plate',
  'body',
  { defense: 8, weight: 8 },
  [
    { kind: 'combat', term: 'guard', amount: 4 },
    { kind: 'thorns', amount: 5 },
  ],
  [{ kind: 'enemy-affix', affixId: 'brutal' }],
);

export const KIT_GEAR: readonly (Weapon | Armor)[] = Object.freeze([
  REAPERS_SCYTHE,
  EXECUTIONERS_AXE,
  BLOODSOAKED_HIDE,
  BLOODSTONE_RING,
  BLOOD_CROWN,
  HUNTERS_LONGBOW,
  STILETTO,
  SHADOW_MANTLE,
  HEXED_LOCKET,
  PLAGUE_BROOCH,
  WARLORDS_BANNER,
  RIPOSTE_BLADE,
  SPIKED_BUCKLER,
  WARDENS_AEGIS,
  THORNMAIL,
  BRIAR_CHARM,
  GRAVEBOUND_PLATE,
]);

// ---- Monster signature gear (the special slot) ----

function special(id: string, label: string, forClass: string, modifiers: readonly Modifier[]): Armor {
  return gearArmor(id, label, 'special', { forClass }, modifiers);
}

export const MONSTER_GEAR: readonly Armor[] = Object.freeze([
  special('acid-core', 'Acid Core', 'slime', [{ kind: 'status-on-hit', status: 'sundered' }]),
  special('ambush-cloak', 'Ambush Cloak', 'goblin', [{ kind: 'veil-on-wait' }]),
  special('bone-spurs', 'Bone Spurs', 'skeleton', [{ kind: 'thorns', amount: 2 }]),
  special('vampire-fang', 'Vampire Fang', 'bat', [{ kind: 'lifesteal', percent: 50 }]),
  special('warchiefs-totem', "Warchief's Totem", 'orc', [{ kind: 'kill-stack', term: 'damage', amount: 2 }]),
  special('gore-horns', 'Gore Horns', 'minotaur', [{ kind: 'shove-on-attack' }]),
  special('bloated-gut', 'Bloated Gut', 'troll', [{ kind: 'kill-heal-percent', percent: 50 }]),
  special('ancient-scale', 'Ancient Scale', 'dragon', [{ kind: 'reflect', percent: 25 }]),
  special('razor-talons', 'Razor Talons', 'beast', [{ kind: 'crit-per-foe-debuff', amount: 10 }]),
  special('egg-shard', 'Egg Shard', 'whelp', [{ kind: 'experience', percent: 50 }]),
  special('ember-heart', 'Ember Heart', 'fire-elemental', [{ kind: 'cleave-through', percent: 50 }]),
  special('undertow-pearl', 'Undertow Pearl', 'water-elemental', [{ kind: 'status-on-hit', status: 'rooted' }]),
  special('gale-core', 'Gale Core', 'air-elemental', [{ kind: 'momentum', amount: 3 }]),
  special('bedrock-heart', 'Bedrock Heart', 'earth-elemental', [{ kind: 'taunt-aura' }]),
]);

// Every piece of signature and cursed gear.
export const SIGNATURE_GEAR: readonly (Weapon | Armor)[] = Object.freeze([...KIT_GEAR, ...MONSTER_GEAR]);

// Whether a piece of gear is cursed (it carries curses).
export function isCursed(gear: { curses?: readonly Curse[] }): boolean {
  return (gear.curses?.length ?? 0) > 0;
}

// What each piece of signature gear does, for its card and the Equipment
// screen; a cursed one says what it costs too.
export const GEAR_DESCRIPTIONS: Readonly<Record<string, string>> = Object.freeze({
  'reapers-scythe': 'A kill lets the wielder move and act again, once a phase.',
  'executioners-axe': 'Double damage to foes under half HP; −20 hit against foes at full HP.',
  'bloodsoaked-hide': '+1 DEF and +1 damage for each tenth of max HP missing.',
  'bloodstone-ring': "A killing crit heals the wearer by the damage past the foe's HP.",
  'blood-crown': 'A kill fully heals and gives +2 damage for the battle. Curse: every enemy has +15% stats.',
  'hunters-longbow': 'Range 2–3. A hit leaves the foe Marked; +3 damage to Marked foes.',
  stiletto: '+10 crit for each debuff on the foe; a crit leaves it Sundered.',
  'shadow-mantle': 'Weightless. After waiting, +30 avoid until your next phase.',
  'hexed-locket': 'Debuffs the wearer lays last one more enemy phase.',
  'plague-brooch': 'A debuffed foe the wearer fells passes its debuffs to the foe nearest it.',
  'warlords-banner':
    '+4 damage to debuffed foes and +15 crit against Marked ones. Curse: one enemy becomes an elite with two affixes.',
  'riposte-blade': 'Counters deal +50% damage and never miss; −2 damage on your own attacks.',
  'spiked-buckler': 'A foe that strikes the wearer from the next tile takes 3 damage.',
  'wardens-aegis': 'At the start of your phase, foes next to the wearer are Taunted.',
  thornmail: '30% of the damage the wearer takes goes back to the attacker, 50% while Taunting.',
  'briar-charm': "The wearer's thorns and reflected damage leave the attacker Sundered.",
  'gravebound-plate': '+8 DEF, takes 4 less damage from every hit, 5 thorns. Curse: every enemy is Brutal.',
  'acid-core': 'A hit leaves the foe Sundered.',
  'ambush-cloak': 'After waiting, +30 avoid until its next phase.',
  'bone-spurs': 'A foe that strikes it from the next tile takes 2 damage.',
  'vampire-fang': 'Heals half the damage it deals.',
  'warchiefs-totem': 'Each kill gives +2 damage for the rest of the battle.',
  'gore-horns': 'A hit in its own attack shoves the foe a tile back.',
  'bloated-gut': 'A kill heals half its max HP.',
  'ancient-scale': '25% of the damage it takes goes back to the attacker.',
  'razor-talons': '+10 crit for each debuff on its foe.',
  'egg-shard': '+50% XP.',
  'ember-heart': 'Each hit splashes half its damage onto the foes beside the target.',
  'undertow-pearl': 'A hit leaves the foe Rooted.',
  'gale-core': 'A kill lets it move 3 more tiles.',
  'bedrock-heart': 'Taunts the foes beside it as its phase starts.',
});

// Enemy monsters wear their class's signature gear at a chance that grows
// with the stage: MONSTER_GEAR_BASE_PERCENT plus MONSTER_GEAR_PERCENT_PER_STAGE
// a stage, up to MONSTER_GEAR_MAX_PERCENT.
export const MONSTER_GEAR_BASE_PERCENT = 10;
export const MONSTER_GEAR_PERCENT_PER_STAGE = 4;
export const MONSTER_GEAR_MAX_PERCENT = 75;

// The chance (percent) an enemy monster of stage `stage` wears its gear.
export function getMonsterGearChance(stage: number): number {
  if (!Number.isFinite(stage) || stage < 1) return 0;
  return Math.min(MONSTER_GEAR_MAX_PERCENT, MONSTER_GEAR_BASE_PERCENT + MONSTER_GEAR_PERCENT_PER_STAGE * stage);
}

// The special-slot gear made for class `classId`, or null.
export function findMonsterGear(classId: string | null, gear: readonly Armor[] = MONSTER_GEAR): Armor | null {
  return gear.find((item) => item.forClass === classId) ?? null;
}

// Puts signature gear on the enemy monsters among `units` (freshly built
// for the battle: it changes them): each one with gear made for its class
// and an empty special slot wears it at getMonsterGearChance(stage), rolled
// with `rng`.
export function equipEnemyMonsters(
  units: Iterable<{ team: string; unitClass: string | null; equipment: Equipment }>,
  stage: number,
  rng: Rng,
): void {
  const chance = getMonsterGearChance(stage);
  if (chance === 0) return;
  for (const unit of units) {
    if (unit.team !== 'enemy' || unit.equipment.special) continue;
    const gear = findMonsterGear(unit.unitClass);
    if (!gear || rng() * 100 >= chance) continue;
    unit.equipment = Object.freeze({ ...unit.equipment, special: gear });
  }
}
