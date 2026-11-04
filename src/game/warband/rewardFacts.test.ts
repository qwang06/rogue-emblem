import { describe, expect, it } from 'vitest';
import { Archer } from '../Archer.ts';
import { HEALTH_POTION, MAX_INVENTORY_SLOTS, WOODEN_SHIELD } from '../items.ts';
import { Soldier } from '../Soldier.ts';
import { Villager } from '../Villager.ts';
import { IRON_BOW, IRON_SPEAR } from '../weapons.ts';
import { HEAL_STAFF } from '../healing.ts';
import { getItemFacts, getRewardFacts } from './rewardFacts.ts';
import { MAX_ROSTER_SIZE } from './rewards.ts';
import { createRun, type RunState } from './run.ts';

// A three-unit warband at full HP with 50 gold.
function run(): RunState {
  const base = createRun(
    7,
    new Map([
      ['alden', new Soldier({ name: 'Alden', team: 'player' })],
      ['bryn', new Archer({ name: 'Bryn', team: 'player' })],
      ['cato', new Villager({ name: 'Cato', team: 'player' })],
    ]),
  );
  return { ...base, gold: 50 };
}

describe('getItemFacts', () => {
  it("lists a weapon's power, hit, weight and range", () => {
    expect(getItemFacts(IRON_SPEAR)).toEqual([
      { label: 'Pow', value: IRON_SPEAR.power },
      { label: 'Hit', value: IRON_SPEAR.hit },
      { label: 'Wt', value: IRON_SPEAR.weight },
      { label: 'Rng', value: '1' },
    ]);
  });

  it('shows a range that spans tiles as min–max', () => {
    const rangeOf = (weapon: typeof IRON_BOW) => getItemFacts(weapon).find(({ label }) => label === 'Rng')?.value;
    expect(rangeOf({ ...IRON_BOW, minRange: 1, maxRange: 2 })).toBe('1–2');
    expect(rangeOf({ ...IRON_BOW, minRange: 2, maxRange: 2 })).toBe('2');
  });

  it("lists armor's defense and weight, and a staff's power and range", () => {
    expect(getItemFacts(WOODEN_SHIELD).map(({ label }) => label)).toEqual(['Def', 'Wt']);
    expect(getItemFacts(HEAL_STAFF).map(({ label }) => label)).toEqual(['Pow', 'Rng']);
  });

  it('says what a potion restores', () => {
    expect(getItemFacts(HEALTH_POTION)).toEqual([
      { label: 'Restores', value: `${HEALTH_POTION.amount} HP`, wide: true },
    ]);
  });
});

describe('getRewardFacts', () => {
  it("shows an Arms or gear reward's item stats", () => {
    expect(getRewardFacts({ kind: 'arms', itemId: IRON_SPEAR.id, label: IRON_SPEAR.label })).toEqual(
      getItemFacts(IRON_SPEAR),
    );
  });

  it('is empty for an unknown item', () => {
    expect(getRewardFacts({ kind: 'arms', itemId: 'nope', label: 'Nope' })).toEqual([]);
  });

  it('counts the units with room for a Supplies reward', () => {
    const base = run();
    const full = Array.from({ length: MAX_INVENTORY_SLOTS }, (_, i) => ({ itemId: `item-${i}`, quantity: 1 }));
    const crowded = { ...base, roster: base.roster.map((unit, i) => (i === 0 ? { ...unit, items: full } : unit)) };
    const facts = getRewardFacts({ kind: 'supplies', itemId: HEALTH_POTION.id, label: HEALTH_POTION.label }, crowded);
    expect(facts.at(-1)).toEqual({ label: 'Units', value: 2, wide: true });
  });

  it('shows the purse before and after a Gold reward, or the amount without a run', () => {
    expect(getRewardFacts({ kind: 'gold', amount: 80 }, run())).toEqual([
      { label: 'Purse', value: 50, after: 130, gold: true, wide: true },
    ]);
    expect(getRewardFacts({ kind: 'gold', amount: 80 })).toEqual([
      { label: 'Purse', value: '+80', gold: true, wide: true },
    ]);
  });

  it("shows the warband's size before and after a draft, capped at the roster's limit", () => {
    expect(getRewardFacts({ kind: 'draft', stage: 3 }, run())).toEqual([
      { label: 'Warband', value: 3, after: 4, wide: true },
    ]);
    const base = run();
    const full = {
      ...base,
      roster: Array.from({ length: MAX_ROSTER_SIZE }, (_, i) => ({ ...base.roster[0], id: `u${i}` })),
    };
    expect(getRewardFacts({ kind: 'draft', stage: 3 }, full)).toEqual([
      { label: 'Warband', value: MAX_ROSTER_SIZE, after: MAX_ROSTER_SIZE, wide: true },
    ]);
  });

  it('totals the HP a Rest heals and the units it heals', () => {
    const base = run();
    const hurt = {
      ...base,
      roster: base.roster.map((unit, i) => (i < 2 ? { ...unit, health: unit.maxHealth - 3 - i } : unit)),
    };
    expect(getRewardFacts({ kind: 'rest' }, hurt)).toEqual([{ label: 'Heals', value: '+7 HP, 2 units', wide: true }]);
  });

  it('says so when a Rest finds everyone at full HP', () => {
    expect(getRewardFacts({ kind: 'rest' }, run())).toEqual([{ label: 'Warband', value: 'at full HP', wide: true }]);
  });

  it('counts the level ups a lesson gives', () => {
    expect(getRewardFacts({ kind: 'lesson', seed: 1 }, run())).toEqual([{ label: 'Level ups', value: 3, wide: true }]);
  });

  it('is empty for rewards whose description says it all, and frozen', () => {
    for (const reward of [{ kind: 'seal' }, { kind: 'scroll' }, { kind: 'relic', relicId: 'whetstone' }] as const) {
      expect(getRewardFacts(reward, run())).toEqual([]);
    }
    const facts = getRewardFacts({ kind: 'gold', amount: 5 }, run());
    expect(Object.isFrozen(facts)).toBe(true);
    expect(Object.isFrozen(facts[0])).toBe(true);
  });
});
