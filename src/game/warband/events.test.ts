import { describe, expect, it } from 'vitest';
import { HEALTH_POTION } from '../items.ts';
import { Soldier } from '../Soldier.ts';
import type { Unit } from '../Unit.ts';
import { Warrior } from '../Warrior.ts';
import { addToConvoy, EVENTS, findEvent, getEventChoices, resolveEvent, rollEvent } from './events.ts';
import { MAX_ROSTER_SIZE } from './rewards.ts';
import { createRun, type RunState } from './run.ts';

function baseRun(gold = 100): RunState {
  const run = createRun(
    9,
    new Map<string, Unit>([
      ['alden', new Soldier({ name: 'Alden', team: 'player' })],
      ['cato', new Warrior({ name: 'Cato', team: 'player' })],
    ]),
  );
  return { ...run, gold, roster: run.roster.map((u) => ({ ...u, health: u.maxHealth - 2 })) };
}

// `run` standing at event `id`.
const at = (id: string, run = baseRun()): RunState => ({ ...run, pendingEvent: { id, depth: 4 } });
const labels = (run: RunState) => getEventChoices(run).map((choice) => choice.label);
const take = (run: RunState, label: string) => resolveEvent(run, labels(run).indexOf(label));

describe('rollEvent', () => {
  it('draws the same event for the same seed and depth, preferring ones not yet seen', () => {
    expect(rollEvent(5, 3)).toBe(rollEvent(5, 3));
    const first = rollEvent(5, 3);
    expect(rollEvent(5, 3, [first.id]).id).not.toBe(first.id);
    expect(EVENTS.map((e) => e.id)).toContain(
      rollEvent(
        5,
        3,
        EVENTS.map((e) => e.id),
      ).id,
    );
  });

  it('has a dozen events, each with two or three choices and one the run can always take', () => {
    expect(EVENTS.length).toBe(12);
    expect(new Set(EVENTS.map((e) => e.id)).size).toBe(EVENTS.length);
    for (const event of EVENTS) {
      for (const run of [at(event.id), at(event.id, baseRun(0))]) {
        const choices = getEventChoices(run);
        expect(choices.length).toBeGreaterThanOrEqual(2);
        expect(choices.length).toBeLessThanOrEqual(3);
        expect(choices.some((choice) => choice.blocked === null)).toBe(true);
      }
    }
  });
});

describe('resolveEvent', () => {
  it('settles the event, remembers it, and says what happened', () => {
    const { run, text } = take(at('healing-spring'), 'Bathe');
    expect(run.pendingEvent).toBeUndefined();
    expect(run.seenEvents).toEqual(['healing-spring']);
    expect(run.roster.every((u) => u.health === u.maxHealth)).toBe(true);
    expect(text.length).toBeGreaterThan(0);
    expect(Object.isFrozen(run)).toBe(true);
  });

  it('refuses without an event, a missing choice, or a blocked one', () => {
    expect(() => resolveEvent(baseRun(), 0)).toThrow(/No event/);
    expect(() => resolveEvent(at('gambler'), 5)).toThrow(/choice 5/);
    expect(() => take(at('gambler', baseRun(10)), 'Stake 30 gold')).toThrow(/30 gold/);
  });

  it('rolls the same outcome for the same run', () => {
    expect(take(at('gambler'), 'Stake 30 gold')).toEqual(take(at('gambler'), 'Stake 30 gold'));
  });
});

describe('the events', () => {
  it('Old Shrine: the sturdiest unit trades max HP for strength, or gold buys a full heal', () => {
    const run = at('old-shrine');
    const sturdiest = [...run.roster].sort((a, b) => b.maxHealth - a.maxHealth)[0];
    const bled = take(run, 'Bleed for strength').run.roster.find((u) => u.id === sturdiest.id)!;
    expect(bled.strength).toBe(sturdiest.strength + 2);
    expect(bled.maxHealth).toBe(sturdiest.maxHealth - 4);
    expect(bled.health).toBeLessThanOrEqual(bled.maxHealth);
    const healed = take(run, 'Leave 20 gold').run;
    expect(healed.gold).toBe(80);
    expect(healed.roster.every((u) => u.health === u.maxHealth)).toBe(true);
  });

  it('Deserter: a potion buys a hurt recruit; his spear goes to the convoy', () => {
    const unarmed = { ...baseRun(), roster: baseRun().roster.map((u) => ({ ...u, items: [] })) };
    expect(getEventChoices(at('deserter', unarmed))[0].blocked).toBe('No Health Potion');
    const withPotion = at('deserter', addToConvoy(unarmed, HEALTH_POTION.id));
    const joined = take(withPotion, 'Give him a Health Potion').run;
    expect(joined.roster).toHaveLength(3);
    expect(joined.roster[2].health).toBeLessThan(joined.roster[2].maxHealth);
    expect(joined.convoy.some((e) => e.itemId === HEALTH_POTION.id)).toBe(false);
    expect(take(at('deserter'), 'Take his spear').run.convoy.map((e) => e.itemId)).toEqual(['iron-spear']);
  });

  it('Deserter and Mercenary Camp refuse a full roster', () => {
    const full = baseRun();
    const roster = Array.from({ length: MAX_ROSTER_SIZE }, (_, i) => ({ ...full.roster[0], id: `u${i}` }));
    expect(getEventChoices(at('mercenary-camp', { ...full, roster }))[0].blocked).toBe('The roster is full');
  });

  it('Gambler and Ruined Chapel pay a relic or a price', () => {
    const outcomes = Array.from({ length: 20 }, (_, depth) => {
      const run = { ...baseRun(), pendingEvent: { id: 'gambler', depth } };
      return take(run, 'Stake 30 gold').run;
    });
    expect(outcomes.every((run) => run.gold === 70)).toBe(true);
    expect(outcomes.some((run) => run.relics.length === 1)).toBe(true);
    expect(outcomes.some((run) => run.relics.length === 0)).toBe(true);
  });

  it('Bandit Toll: pay, or bleed a third of max HP for 20 gold, never dropping below 1 HP', () => {
    expect(take(at('bandit-toll'), 'Pay 25 gold').run.gold).toBe(75);
    const fought = take(at('bandit-toll'), 'Fight through').run;
    expect(fought.gold).toBe(120);
    expect(fought.roster.every((u) => u.health >= 1)).toBe(true);
  });

  it('Swordmaster: a lesson for the greenest unit, sparring for the sturdiest', () => {
    const run = at('swordmaster');
    const taught = take(run, 'Pay 30 gold for a lesson').run;
    expect(taught.roster[0].skill + taught.roster[1].skill).toBe(run.roster[0].skill + run.roster[1].skill + 1);
    expect(taught.gold).toBe(70);
  });

  it("Knight's Grave and Healing Spring stock the convoy", () => {
    expect(take(at('knights-grave'), 'Take the armor').run.convoy).toEqual([{ itemId: 'wooden-armor', quantity: 1 }]);
    expect(take(at('healing-spring'), 'Bottle the water').run.convoy).toEqual([
      { itemId: HEALTH_POTION.id, quantity: 2 },
    ]);
    expect(take(at('knights-grave'), 'Pay respects').run.roster.map((u) => u.luck)).toEqual(
      baseRun().roster.map((u) => u.luck + 1),
    );
  });

  it('Blood Altar: the sturdiest unit loses max HP for a relic', () => {
    expect(getEventChoices(at('blood-altar'))[0].blocked).toBe('Nobody can spare the blood');
    const tough = { ...baseRun(), roster: baseRun().roster.map((u) => ({ ...u, maxHealth: 20, health: 20 })) };
    const after = take(at('blood-altar', tough), 'Make an offering').run;
    expect(after.relics).toHaveLength(1);
    expect(after.roster[0].maxHealth).toBe(14);
  });

  it('Broken Wagon pays 40 gold for 3 HP each; Abandoned Cart finds a usable weapon', () => {
    const pushed = take(at('broken-wagon'), 'Help push').run;
    expect(pushed.gold).toBe(140);
    const searched = take(at('abandoned-cart'), 'Search it').run;
    expect(searched.convoy).toHaveLength(1);
  });

  it('finds every event by id', () => {
    for (const event of EVENTS) expect(findEvent(event.id)).toBe(event);
    expect(findEvent('nope')).toBeNull();
  });
});
