import type { Item } from '../items.ts';
import { canTakeItem, MAX_ROSTER_SIZE, previewRewardHealth, type Reward } from './rewards.ts';
import { RUN_ITEMS, type RunState } from './run.ts';

// One line of a reward card's numbers block on the reward screen: a short
// label and its value, with `after` for a value the reward changes (shown
// as "value ▸ after"). `gold` marks a sum of gold, drawn with the coin, and
// `wide` a line that takes the block's whole width.
export interface RewardFact {
  label: string;
  value: string | number;
  after?: string | number;
  gold?: true;
  wide?: true;
}

// What a reward does, in numbers, for its card: an item's stats, the purse
// before and after, the HP a rest heals, the warband's size with a recruit.
// Empty for a reward with no numbers to show (a relic, keystone, seal or
// scroll, whose description says it all) and for a recruit (whose card
// shows its stat line). Without `run`, only what the reward alone tells.
export function getRewardFacts(
  reward: Reward,
  run: RunState | null = null,
  items: readonly Item[] = RUN_ITEMS,
): readonly RewardFact[] {
  return Object.freeze(rewardFacts(reward, run, items).map((fact) => Object.freeze(fact)));
}

function rewardFacts(reward: Reward, run: RunState | null, items: readonly Item[]): RewardFact[] {
  switch (reward.kind) {
    case 'arms':
    case 'gear':
    case 'supplies': {
      const item = items.find(({ id }) => id === reward.itemId);
      if (!item) return [];
      const facts = getItemFacts(item);
      if (reward.kind !== 'supplies' || !run) return facts;
      return [...facts, { label: 'Units', value: countTakers(run, reward.itemId), wide: true }];
    }
    case 'gold':
      return run
        ? [{ label: 'Purse', value: run.gold, after: run.gold + reward.amount, gold: true, wide: true }]
        : [{ label: 'Purse', value: `+${reward.amount}`, gold: true, wide: true }];
    case 'draft': {
      if (!run) return [];
      const size = run.roster.length;
      return [{ label: 'Warband', value: size, after: Math.min(size + 1, MAX_ROSTER_SIZE), wide: true }];
    }
    case 'rest': {
      if (!run) return [];
      const after = previewRewardHealth(run, reward) ?? [];
      const gains = run.roster.map((unit, index) => Math.max(0, (after[index]?.health ?? unit.health) - unit.health));
      const healed = gains.filter((gain) => gain > 0).length;
      if (healed === 0) return [{ label: 'Warband', value: 'at full HP', wide: true }];
      const total = gains.reduce((sum, gain) => sum + gain, 0);
      return [{ label: 'Heals', value: `+${total} HP, ${healed} ${healed === 1 ? 'unit' : 'units'}`, wide: true }];
    }
    case 'lesson':
      return run ? [{ label: 'Level ups', value: run.roster.length, wide: true }] : [];
    case 'recruit':
    case 'relic':
    case 'keystone':
    case 'seal':
    case 'scroll':
      return [];
  }
}

// An item's numbers: a weapon's power, hit, weight and range; armor's
// defense, weight and what its weight class adds; a staff's power and
// range; what a potion restores.
export function getItemFacts(item: Item): RewardFact[] {
  switch (item.kind) {
    case 'weapon':
      return [
        { label: 'Pow', value: item.power },
        { label: 'Hit', value: item.hit },
        { label: 'Wt', value: item.weight },
        { label: 'Rng', value: formatRange(item.minRange, item.maxRange) },
      ];
    case 'staff':
      return [
        { label: 'Pow', value: item.power },
        { label: 'Rng', value: formatRange(item.minRange, item.maxRange) },
      ];
    case 'armor':
      return [
        { label: 'Def', value: item.defense },
        { label: 'Wt', value: item.weight },
        ...(item.avoid ? [{ label: 'Avo', value: item.avoid }] : []),
        ...(item.resistance ? [{ label: 'Res', value: item.resistance }] : []),
      ];
    case 'consumable':
      return [{ label: 'Restores', value: `${item.amount} ${item.stat === 'health' ? 'HP' : 'MP'}`, wide: true }];
    case 'seal':
      return [];
  }
}

function formatRange(min: number, max: number): string {
  return min === max ? `${min}` : `${min}–${max}`;
}

// How many roster units have room for one more `itemId`, as a Supplies
// reward hands them out.
function countTakers(run: RunState, itemId: string): number {
  return run.roster.filter((unit) => canTakeItem(unit, itemId)).length;
}
