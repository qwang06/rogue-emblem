// Wayside events: the short no-battle stops at a realm's event sites (see
// realm/realm.ts), Slay the Spire's "?" rooms and Darkest Dungeon's
// curios. Arriving at one draws an event from the run's seed and the
// site's depth (rollEvent); the run owes it (`pendingEvent`) until the
// player takes one of its two or three choices, each with a cost and a
// payoff (resolveEvent). A choice the run can't take (too little gold, no
// potion, a full roster) is offered disabled with the reason. Every event
// names the unit it falls on by what it reads from the roster, so the text
// and the effect agree. Pure: each function returns a new frozen run.

import type { Rng } from '../combatStats.ts';
import { HEALTH_POTION, WOODEN_ARMOR } from '../items.ts';
import { createSeededRng, randomItem } from '../rng.ts';
import { IRON_SPEAR } from '../weapons.ts';
import { needsRest } from './camp.ts';
import { isStackable, lookUpItem } from './convoy.ts';
import { getPurchaseQuantity } from './merchant.ts';
import { getUnownedRelics } from './relics.ts';
import { addGold, applyReward, eligibleWeapons, MAX_ROSTER_SIZE, rollRecruit } from './rewards.ts';
import type { ItemSnapshot, RunState, UnitSnapshot } from './run.ts';

// What a choice does to the run, with a line saying what happened.
export interface EventOutcome {
  run: RunState;
  text: string;
}

export interface EventChoice {
  label: string;
  // What it costs and pays, before it's taken.
  detail: string;
  // Why the run can't take it, or null when it can.
  blocked: string | null;
  resolve: (run: RunState, rng: Rng) => EventOutcome;
}

export interface WaysideEvent {
  id: string;
  title: string;
  text: string;
  // The choices for `run`: their text can name the unit they fall on.
  choices: (run: RunState) => readonly EventChoice[];
}

// ---- Helpers --------------------------------------------------------------

// The unit with the most max HP (the first of equals): who bleeds or bears
// a burden.
function sturdiest(run: RunState): UnitSnapshot | undefined {
  return run.roster.reduce<UnitSnapshot | undefined>(
    (best, unit) => (!best || unit.maxHealth > best.maxHealth ? unit : best),
    undefined,
  );
}

// The unit with the lowest level (the first of equals): who gains from a
// lesson.
function greenest(run: RunState): UnitSnapshot | undefined {
  return run.roster.reduce<UnitSnapshot | undefined>(
    (best, unit) => (!best || unit.level < best.level ? unit : best),
    undefined,
  );
}

function updateUnit(run: RunState, id: string, update: (unit: UnitSnapshot) => UnitSnapshot): RunState {
  return freeze({ ...run, roster: run.roster.map((unit) => (unit.id === id ? Object.freeze(update(unit)) : unit)) });
}

function updateAll(run: RunState, update: (unit: UnitSnapshot) => UnitSnapshot): RunState {
  return freeze({ ...run, roster: run.roster.map((unit) => Object.freeze(update(unit))) });
}

// Every unit loses `share` of its max HP (rounded up), never below 1 HP.
function hurtAll(run: RunState, share: number): RunState {
  return updateAll(run, (unit) => ({
    ...unit,
    health: Math.max(1, unit.health - Math.ceil(unit.maxHealth * share)),
  }));
}

function spend(run: RunState, gold: number): RunState {
  return freeze({ ...run, gold: run.gold - gold });
}

// `quantity` of item `itemId` (a weapon or staff with all its uses) added
// to the convoy, a consumable stacking onto one already there.
export function addToConvoy(run: RunState, itemId: string, quantity = 1): RunState {
  const item = lookUpItem(itemId);
  const index = isStackable(item) ? run.convoy.findIndex((entry) => entry.itemId === itemId) : -1;
  const convoy: ItemSnapshot[] = [...run.convoy];
  if (index >= 0) convoy[index] = Object.freeze({ itemId, quantity: convoy[index].quantity + quantity });
  else convoy.push(Object.freeze({ itemId, quantity: isStackable(item) ? quantity : getPurchaseQuantity(item) }));
  return freeze({ ...run, convoy });
}

// The run with one Health Potion used up from the convoy, else from the
// first unit carrying one; null when nobody has one.
function takePotion(run: RunState): RunState | null {
  const convoyIndex = run.convoy.findIndex((entry) => entry.itemId === HEALTH_POTION.id);
  if (convoyIndex >= 0) {
    const entry = run.convoy[convoyIndex];
    const convoy =
      entry.quantity > 1
        ? run.convoy.map((e, i) => (i === convoyIndex ? Object.freeze({ ...e, quantity: e.quantity - 1 }) : e))
        : run.convoy.filter((_, i) => i !== convoyIndex);
    return freeze({ ...run, convoy });
  }
  const carrier = run.roster.find((unit) => unit.items.some((item) => item.itemId === HEALTH_POTION.id));
  if (!carrier) return null;
  return updateUnit(run, carrier.id, (unit) => {
    const i = unit.items.findIndex((item) => item.itemId === HEALTH_POTION.id);
    const items = unit.items
      .map((item, j) => (j === i ? { ...item, quantity: item.quantity - 1 } : item))
      .filter((item) => item.quantity > 0);
    return { ...unit, items };
  });
}

// A relic the run doesn't hold, picked with `rng`, added to it.
function gainRelic(run: RunState, rng: Rng): { run: RunState; name: string } | null {
  const unowned = getUnownedRelics(run.relics);
  if (unowned.length === 0) return null;
  const relic = randomItem(rng, unowned);
  return { run: applyReward(run, { kind: 'relic', relicId: relic.id }), name: relic.name };
}

const LEAVE: EventChoice = Object.freeze({
  label: 'Move on',
  detail: 'Nothing happens.',
  blocked: null,
  resolve: (run: RunState) => ({ run, text: 'The warband moves on.' }),
});

function needGold(run: RunState, gold: number): string | null {
  return run.gold >= gold ? null : `Needs ${gold} gold`;
}

function event(id: string, title: string, text: string, choices: WaysideEvent['choices']): WaysideEvent {
  return Object.freeze({ id, title, text, choices });
}

// ---- The events -------------------------------------------------------------

const OFFERING_GOLD = 20;
const GAMBLE_GOLD = 30;
const TOLL_GOLD = 25;
const LESSON_GOLD = 30;
const HIRE_GOLD = 50;

export const EVENTS: readonly WaysideEvent[] = Object.freeze([
  event(
    'old-shrine',
    'Old Shrine',
    'A moss-covered shrine to a forgotten war god. The stone basin is stained dark.',
    (run) => {
      const unit = sturdiest(run);
      return [
        {
          label: 'Bleed for strength',
          detail: `${unit?.name ?? 'A unit'} gains +2 STR and loses 4 max HP.`,
          blocked: unit && unit.maxHealth > 8 ? null : 'Nobody can spare the blood',
          resolve: (r) => ({
            run: updateUnit(r, unit!.id, (u) => ({
              ...u,
              strength: u.strength + 2,
              maxHealth: u.maxHealth - 4,
              health: Math.max(1, Math.min(u.health, u.maxHealth - 4)),
            })),
            text: `${unit!.name} feels the old god's strength, and a chill that doesn't leave.`,
          }),
        },
        {
          label: `Leave ${OFFERING_GOLD} gold`,
          detail: 'Everyone recovers to full HP and MP.',
          blocked: needGold(run, OFFERING_GOLD) ?? (needsRest(run) ? null : 'Nobody needs healing'),
          resolve: (r) => ({
            run: applyReward(spend(r, OFFERING_GOLD), { kind: 'rest' }),
            text: 'Warmth spreads through the warband. Every wound closes.',
          }),
        },
        LEAVE,
      ];
    },
  ),
  event('deserter', 'Deserter', 'A wounded soldier staggers out of the trees and begs for a potion.', (run) => [
    {
      label: 'Give him a Health Potion',
      detail: 'He joins the warband, badly hurt.',
      blocked: !takePotion(run)
        ? 'No Health Potion'
        : run.roster.length >= MAX_ROSTER_SIZE
          ? 'The roster is full'
          : null,
      resolve: (r, rng) => {
        const recruit = rollRecruit(r, r.stage, rng, undefined, { classId: 'soldier' });
        const joined = { ...recruit, health: Math.max(1, Math.floor(recruit.maxHealth / 4)) };
        return {
          run: applyReward(takePotion(r)!, { kind: 'recruit', unit: joined }),
          text: `${joined.name} drinks, steadies, and swears to fight for you.`,
        };
      },
    },
    {
      label: 'Take his spear',
      detail: 'An Iron Spear goes to the convoy.',
      blocked: null,
      resolve: (r) => ({
        run: addToConvoy(r, IRON_SPEAR.id),
        text: 'You leave him by the road, his spear in your cart.',
      }),
    },
    LEAVE,
  ]),
  event('gambler', 'Gambler', 'A grinning man shuffles three cups. "Find the pea, win a treasure."', (run) => [
    {
      label: `Stake ${GAMBLE_GOLD} gold`,
      detail: 'A coin flip: a relic, or the gold is gone.',
      blocked: needGold(run, GAMBLE_GOLD) ?? (getUnownedRelics(run.relics).length > 0 ? null : 'Nothing left to win'),
      resolve: (r, rng) => {
        const paid = spend(r, GAMBLE_GOLD);
        const won = rng() < 0.5 ? gainRelic(paid, rng) : null;
        return won
          ? { run: won.run, text: `The pea is under your cup. You win the ${won.name}.` }
          : { run: paid, text: 'The cup is empty. So, somehow, is the gambler’s stall.' };
      },
    },
    LEAVE,
  ]),
  event('healing-spring', 'Healing Spring', 'Clear water bubbles up between white stones.', (run) => [
    {
      label: 'Bathe',
      detail: 'Everyone recovers to full HP and MP.',
      blocked: needsRest(run) ? null : 'Nobody needs healing',
      resolve: (r) => ({ run: applyReward(r, { kind: 'rest' }), text: 'The warband rises from the water whole.' }),
    },
    {
      label: 'Bottle the water',
      detail: `Two ${HEALTH_POTION.label}s go to the convoy.`,
      blocked: null,
      resolve: (r) => ({ run: addToConvoy(r, HEALTH_POTION.id, 2), text: 'You fill two flasks for the road.' }),
    },
  ]),
  event('bandit-toll', 'Bandit Toll', 'Bandits block the bridge. "The toll is fair. Your lives are not."', (run) => [
    {
      label: `Pay ${TOLL_GOLD} gold`,
      detail: 'Cross in peace.',
      blocked: needGold(run, TOLL_GOLD),
      resolve: (r) => ({ run: spend(r, TOLL_GOLD), text: 'The bandits bow you across.' }),
    },
    {
      label: 'Fight through',
      detail: 'Everyone loses a third of their max HP. The bandits’ purse holds 20 gold.',
      blocked: null,
      resolve: (r) => ({
        run: addGold(hurtAll(r, 1 / 3), 20),
        text: 'Steel rings on the bridge. The bandits scatter.',
      }),
    },
  ]),
  event(
    'abandoned-cart',
    'Abandoned Cart',
    'An overturned cart lies in the ditch, its cargo still lashed down.',
    (run) => {
      const unit = sturdiest(run);
      const weapons = eligibleWeapons(run);
      return [
        {
          label: 'Search it',
          detail: `A weapon your warband can use goes to the convoy. Something may bite ${unit?.name ?? 'the searcher'}.`,
          blocked: weapons.length > 0 ? null : 'Nothing your warband can use',
          resolve: (r, rng) => {
            const weapon = randomItem(rng, eligibleWeapons(r));
            const bitten = rng() < 0.5;
            const after = addToConvoy(r, weapon.id);
            return bitten
              ? {
                  run: updateUnit(after, unit!.id, (u) => ({ ...u, health: Math.max(1, u.health - 6) })),
                  text: `A ${weapon.label}! And a snake, which bites ${unit!.name} for 6.`,
                }
              : { run: after, text: `Under the canvas: a ${weapon.label}.` };
          },
        },
        LEAVE,
      ];
    },
  ),
  event('swordmaster', 'Wandering Swordmaster', 'An old swordmaster sits by the road, sharpening a blade.', (run) => {
    const student = greenest(run);
    const sparrer = sturdiest(run);
    return [
      {
        label: `Pay ${LESSON_GOLD} gold for a lesson`,
        detail: `${student?.name ?? 'A unit'} gains +1 SKL and +1 SPD.`,
        blocked: needGold(run, LESSON_GOLD),
        resolve: (r) => ({
          run: updateUnit(spend(r, LESSON_GOLD), student!.id, (u) => ({
            ...u,
            skill: u.skill + 1,
            speed: u.speed + 1,
          })),
          text: `${student!.name} learns to strike faster and truer.`,
        }),
      },
      {
        label: 'Spar with him',
        detail: `${sparrer?.name ?? 'A unit'} gains +1 STR and loses half its HP.`,
        blocked: sparrer ? null : 'Nobody to spar',
        resolve: (r) => ({
          run: updateUnit(r, sparrer!.id, (u) => ({
            ...u,
            strength: u.strength + 1,
            health: Math.max(1, u.health - Math.ceil(u.maxHealth / 2)),
          })),
          text: `${sparrer!.name} is beaten black and blue, and comes away stronger.`,
        }),
      },
      LEAVE,
    ];
  }),
  event('broken-wagon', 'Broken Wagon', 'A merchant’s wagon is stuck axle-deep in mud.', () => [
    {
      label: 'Help push',
      detail: 'Everyone loses 3 HP. The merchant pays 40 gold.',
      blocked: null,
      resolve: (r) => ({
        run: addGold(
          updateAll(r, (u) => ({ ...u, health: Math.max(1, u.health - 3) })),
          40,
        ),
        text: 'The wagon lurches free. The merchant presses a purse into your hand.',
      }),
    },
    LEAVE,
  ]),
  event(
    'knights-grave',
    'Knight’s Grave',
    'A cairn with a rusted helm on top. The armor beneath is still good.',
    () => [
      {
        label: 'Take the armor',
        detail: `${WOODEN_ARMOR.label} goes to the convoy.`,
        blocked: null,
        resolve: (r) => ({ run: addToConvoy(r, WOODEN_ARMOR.id), text: 'The dead knight won’t miss it. Probably.' }),
      },
      {
        label: 'Pay respects',
        detail: 'Everyone gains +1 LCK.',
        blocked: null,
        resolve: (r) => ({
          run: updateAll(r, (u) => ({ ...u, luck: u.luck + 1 })),
          text: 'You add a stone to the cairn. The road feels kinder.',
        }),
      },
    ],
  ),
  event('ruined-chapel', 'Ruined Chapel', 'Stairs lead down into a crypt. Something glints in the dark.', (run) => [
    {
      label: 'Search the crypt',
      detail: 'A coin flip: a relic, or the dead wake and everyone loses a quarter of their max HP.',
      blocked: getUnownedRelics(run.relics).length > 0 ? null : 'Nothing left to find',
      resolve: (r, rng) => {
        const found = rng() < 0.5 ? gainRelic(r, rng) : null;
        return found
          ? { run: found.run, text: `Among the bones: the ${found.name}.` }
          : { run: hurtAll(r, 1 / 4), text: 'The dead do not like visitors. The warband flees, bloodied.' };
      },
    },
    LEAVE,
  ]),
  event(
    'mercenary-camp',
    'Mercenary Camp',
    'Sellswords dice around a fire. One looks up: "Looking for a blade?"',
    (run) => [
      {
        label: `Hire a sellsword for ${HIRE_GOLD} gold`,
        detail: 'A new unit joins the warband.',
        blocked: needGold(run, HIRE_GOLD) ?? (run.roster.length >= MAX_ROSTER_SIZE ? 'The roster is full' : null),
        resolve: (r, rng) => {
          const recruit = rollRecruit(r, r.stage, rng);
          return {
            run: applyReward(spend(r, HIRE_GOLD), { kind: 'recruit', unit: recruit }),
            text: `${recruit.name} takes the coin and falls in.`,
          };
        },
      },
      LEAVE,
    ],
  ),
  event('blood-altar', 'Blood Altar', 'A black altar hums. Carved words promise power for a price.', (run) => {
    const unit = sturdiest(run);
    return [
      {
        label: 'Make an offering',
        detail: `${unit?.name ?? 'A unit'} loses 6 max HP. The warband gains a relic.`,
        blocked:
          getUnownedRelics(run.relics).length === 0
            ? 'Nothing left to gain'
            : unit && unit.maxHealth > 10
              ? null
              : 'Nobody can spare the blood',
        resolve: (r, rng) => {
          const hurt = updateUnit(r, unit!.id, (u) => ({
            ...u,
            maxHealth: u.maxHealth - 6,
            health: Math.max(1, Math.min(u.health, u.maxHealth - 6)),
          }));
          const won = gainRelic(hurt, rng)!;
          return { run: won.run, text: `${unit!.name} bleeds on the altar. The ${won.name} rises from the stone.` };
        },
      },
      LEAVE,
    ];
  }),
]);

export function findEvent(id: string): WaysideEvent | null {
  return EVENTS.find((candidate) => candidate.id === id) ?? null;
}

// The seed an event's dice roll from at `depth` of a run started with
// `runSeed`, also what picks the event.
function eventSeed(runSeed: number, depth: number): number {
  return (runSeed ^ Math.imul(depth + 0x45, 0x2c1b3c6d) ^ 0x65766e74) >>> 0;
}

// The event at `depth` of a run started with `runSeed`: one the run hasn't
// met yet when it can (`seen`), always the same for the same arguments.
export function rollEvent(runSeed: number, depth: number, seen: readonly string[] = []): WaysideEvent {
  const fresh = EVENTS.filter((candidate) => !seen.includes(candidate.id));
  return randomItem(createSeededRng(eventSeed(runSeed, depth)), fresh.length > 0 ? fresh : EVENTS);
}

// The choices the run's pending event offers, or none when it owes none.
export function getEventChoices(run: RunState): readonly EventChoice[] {
  const pending = run.pendingEvent && findEvent(run.pendingEvent.id);
  return pending ? pending.choices(run) : [];
}

// The run after taking choice `index` of its pending event: the choice's
// effect, the event settled and remembered as seen, and what happened.
// Throws when no event is owed or the choice is missing or blocked.
export function resolveEvent(run: RunState, index: number): EventOutcome {
  const pending = run.pendingEvent;
  if (!pending) throw new Error('No event is owed');
  const choice = getEventChoices(run)[index];
  if (!choice) throw new Error(`No event choice ${index}`);
  if (choice.blocked) throw new Error(choice.blocked);
  const outcome = choice.resolve(run, createSeededRng(eventSeed(run.seed, pending.depth) ^ 0x9e3779b9));
  const { pendingEvent: _settled, ...rest } = outcome.run;
  const seenEvents = Object.freeze([...(run.seenEvents ?? []), pending.id]);
  return { run: freeze({ ...rest, seenEvents }), text: outcome.text };
}

function freeze(run: RunState): RunState {
  return Object.freeze(run);
}
