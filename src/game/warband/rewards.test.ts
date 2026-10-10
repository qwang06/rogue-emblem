import { describe, expect, it } from 'vitest';
import { Archer } from '../Archer.ts';
import { HEALTH_POTION, MAX_INVENTORY_SLOTS } from '../items.ts';
import { createSeededRng } from '../rng.ts';
import { Soldier } from '../Soldier.ts';
import { Unit } from '../Unit.ts';
import { UNIT_CLASSES } from '../unitClasses.ts';
import { Villager } from '../Villager.ts';
import { createRun, type RunState, type UnitSnapshot } from './run.ts';
import {
  addGold,
  applyReward,
  describeReward,
  FLAWLESS_BONUS_GOLD,
  getRewardSeed,
  getStageClearGold,
  MAX_ROSTER_SIZE,
  PURSE_GOLD,
  PURSE_GOLD_PER_STAGE,
  RECRUIT_CLASS_IDS,
  REWARD_CHOICES,
  rollRecruit,
  rollRewards,
  STAGE_CLEAR_GOLD,
  STAGE_CLEAR_GOLD_PER_STAGE,
  TRAINING_MAX_HEALTH,
  type Reward,
} from './rewards.ts';
import { WARBAND_NAMES } from './names.ts';
import { STARTING_CLASSES } from './startingClasses.ts';

function runOf(...units: [string, Unit][]): RunState {
  return createRun(7, new Map(units));
}

// A three-unit warband, everyone at full HP.
function fullRun(): RunState {
  return runOf(
    ['alden', new Soldier({ name: 'Alden', team: 'player' })],
    ['bryn', new Archer({ name: 'Bryn', team: 'player' })],
    ['cato', new Villager({ name: 'Cato', team: 'player' })],
  );
}

function withRoster(run: RunState, roster: UnitSnapshot[]): RunState {
  return { ...run, roster };
}

const kinds = (rewards: readonly Reward[]) => rewards.map((reward) => reward.kind);

describe('getStageClearGold', () => {
  it('pays a base plus a per-stage amount, with a bonus for a flawless clear', () => {
    expect(getStageClearGold(1, 0)).toEqual({
      gold: STAGE_CLEAR_GOLD + STAGE_CLEAR_GOLD_PER_STAGE + FLAWLESS_BONUS_GOLD,
      flawless: true,
    });
    expect(getStageClearGold(4, 2)).toEqual({
      gold: STAGE_CLEAR_GOLD + STAGE_CLEAR_GOLD_PER_STAGE * 4,
      flawless: false,
    });
  });

  it('pays more on later stages', () => {
    expect(getStageClearGold(5, 0).gold).toBeGreaterThan(getStageClearGold(1, 0).gold);
  });
});

describe('getRewardSeed', () => {
  it('is the same for the same run and stage, and differs between stages', () => {
    expect(getRewardSeed(42, 3)).toBe(getRewardSeed(42, 3));
    expect(getRewardSeed(42, 3)).not.toBe(getRewardSeed(42, 4));
    expect(getRewardSeed(42, 3)).not.toBe(getRewardSeed(43, 3));
  });
});

describe('rollRewards', () => {
  it('offers REWARD_CHOICES rewards of different kinds', () => {
    for (let seed = 0; seed < 30; seed++) {
      const rewards = rollRewards(fullRun(), 2, createSeededRng(seed));
      expect(rewards).toHaveLength(REWARD_CHOICES);
      expect(new Set(kinds(rewards)).size).toBe(REWARD_CHOICES);
    }
  });

  it('is the same for the same seed', () => {
    expect(rollRewards(fullRun(), 2, createSeededRng(5))).toEqual(rollRewards(fullRun(), 2, createSeededRng(5)));
  });

  it('always offers a recruit first while the roster is smaller than the deploy cap', () => {
    const lone = runOf(['alden', new Villager({ name: 'Alden', team: 'player' })]);
    for (let seed = 0; seed < 30; seed++) {
      expect(rollRewards(lone, 2, createSeededRng(seed))[0].kind).toBe('recruit');
    }
  });

  it('only offers rest when someone is hurt or low on mana', () => {
    const run = fullRun();
    for (let seed = 0; seed < 30; seed++) {
      expect(kinds(rollRewards(run, 2, createSeededRng(seed)))).not.toContain('rest');
    }
    const hurt = withRoster(run, [{ ...run.roster[0], health: 1 }, ...run.roster.slice(1)]);
    const offered = Array.from({ length: 30 }, (_, seed) => kinds(rollRewards(hurt, 2, createSeededRng(seed)))).flat();
    expect(offered).toContain('rest');
  });

  it('stops offering recruits at a full roster', () => {
    const run = fullRun();
    const roster = Array.from({ length: MAX_ROSTER_SIZE }, (_, i) => ({ ...run.roster[0], id: `u${i}` }));
    const full = withRoster(run, roster);
    for (let seed = 0; seed < 30; seed++) {
      expect(kinds(rollRewards(full, 2, createSeededRng(seed)))).not.toContain('recruit');
    }
  });

  it('offers fewer when the pools run dry', () => {
    const run = fullRun();
    const items = Array.from({ length: MAX_INVENTORY_SLOTS }, (_, i) => ({
      itemId: i ? 'iron-spear' : 'fists',
      quantity: 1,
    }));
    const roster = Array.from({ length: MAX_ROSTER_SIZE }, (_, i) => ({ ...run.roster[0], id: `u${i}`, items }));
    const rewards = rollRewards(withRoster(run, roster), 2, createSeededRng(1));
    expect(kinds(rewards).sort()).toEqual(['gold', 'training']);
  });

  it('offers nothing when asked for none', () => {
    expect(rollRewards(fullRun(), 1, createSeededRng(1), 0)).toEqual([]);
  });

  it('sizes the gold purse by stage', () => {
    const lone = fullRun();
    const gold = Array.from({ length: 30 }, (_, seed) => rollRewards(lone, 3, createSeededRng(seed)))
      .flat()
      .find((reward) => reward.kind === 'gold');
    expect(gold).toEqual({ kind: 'gold', amount: PURSE_GOLD + PURSE_GOLD_PER_STAGE * 3 });
  });
});

describe('rollRecruit', () => {
  it('is a recruit class at the roster average level, named and id-ed uniquely', () => {
    const run = fullRun();
    const leveled = withRoster(run, [
      { ...run.roster[0], level: 4 },
      { ...run.roster[1], level: 3 },
      { ...run.roster[2], level: 1 },
    ]);
    for (let seed = 0; seed < 20; seed++) {
      const recruit = rollRecruit(leveled, 3, createSeededRng(seed));
      expect(RECRUIT_CLASS_IDS).toContain(recruit.classId);
      expect(recruit.level).toBe(2);
      expect(WARBAND_NAMES).toContain(recruit.name);
      expect(['Alden', 'Bryn', 'Cato']).not.toContain(recruit.name);
      expect(run.roster.map((unit) => unit.id)).not.toContain(recruit.id);
      expect(recruit.health).toBe(recruit.maxHealth);
    }
  });

  it('rolls level ups, so a higher-level recruit has more stats', () => {
    const run = fullRun();
    const veterans = withRoster(
      run,
      run.roster.map((unit) => ({ ...unit, level: 10 })),
    );
    const recruit = rollRecruit(veterans, 5, () => 0);
    const base = UNIT_CLASSES.find((unitClass) => unitClass.id === recruit.classId)!.create({
      name: 'x',
      team: 'player',
    });
    expect(recruit.level).toBe(10);
    expect(recruit.maxHealth).toBeGreaterThan(base.maxHealth);
  });

  it('avoids ids already in the run, fallen units included', () => {
    const run = fullRun();
    const taken = { ...run, fallen: [{ ...run.roster[0], id: 'recruit-2' }] };
    expect(rollRecruit(taken, 2, createSeededRng(3)).id).not.toBe('recruit-2');
  });

  it('falls back to "Recruit" once every name is used', () => {
    const run = fullRun();
    const fallen = WARBAND_NAMES.map((name, i) => ({ ...run.roster[0], id: `f${i}`, name }));
    expect(rollRecruit({ ...run, fallen }, 2, createSeededRng(3)).name).toBe('Recruit');
  });

  it('comes out at level 1 for an empty roster', () => {
    expect(rollRecruit(withRoster(fullRun(), []), 1, createSeededRng(1)).level).toBe(1);
  });
});

describe('applyReward', () => {
  it('adds a recruit to the end of the roster', () => {
    const run = fullRun();
    const unit = rollRecruit(run, 1, createSeededRng(1));
    const after = applyReward(run, { kind: 'recruit', unit });
    expect(after.roster.map((snapshot) => snapshot.id)).toEqual([...run.roster.map((s) => s.id), unit.id]);
    expect(Object.isFrozen(after)).toBe(true);
    expect(run.roster).toHaveLength(3);
  });

  it('turns a recruit away at a full roster', () => {
    const run = fullRun();
    const full = withRoster(
      run,
      Array.from({ length: MAX_ROSTER_SIZE }, (_, i) => ({ ...run.roster[0], id: `u${i}` })),
    );
    const unit = rollRecruit(run, 1, createSeededRng(1));
    expect(applyReward(full, { kind: 'recruit', unit })).toBe(full);
  });

  it('rests everyone to full HP and mana', () => {
    const run = fullRun();
    const hurt = withRoster(
      run,
      run.roster.map((unit) => ({ ...unit, health: 1, mana: 0 })),
    );
    for (const unit of applyReward(hurt, { kind: 'rest' }).roster) {
      expect(unit.health).toBe(unit.maxHealth);
      expect(unit.mana).toBe(unit.maxMana);
    }
  });

  it('hands out supplies, stacking onto potions already carried and skipping full packs', () => {
    const run = fullRun();
    const fullPack = Array.from({ length: MAX_INVENTORY_SLOTS }, (_, i) => ({
      itemId: i ? 'iron-spear' : 'fists',
      quantity: 1,
    }));
    const mixed = withRoster(run, [
      { ...run.roster[0], items: [{ itemId: HEALTH_POTION.id, quantity: 1 }] },
      { ...run.roster[1], items: [] },
      { ...run.roster[2], items: fullPack },
    ]);
    const after = applyReward(mixed, { kind: 'supplies', itemId: HEALTH_POTION.id, label: HEALTH_POTION.label });
    expect(after.roster[0].items).toEqual([{ itemId: HEALTH_POTION.id, quantity: 2 }]);
    expect(after.roster[1].items).toEqual([{ itemId: HEALTH_POTION.id, quantity: 1 }]);
    expect(after.roster[2].items).toEqual(fullPack);
  });

  it('trains max HP and current HP up together, stopping at the class cap', () => {
    const run = fullRun();
    const soldierCap = new Soldier({ name: 'x', team: 'player' }).caps.health!;
    const nearCap = withRoster(run, [
      { ...run.roster[0], health: 5 },
      { ...run.roster[1] },
      { ...run.roster[0], id: 'capped', maxHealth: soldierCap - 1, health: soldierCap - 1 },
    ]);
    const after = applyReward(nearCap, { kind: 'training', maxHealth: TRAINING_MAX_HEALTH });
    expect(after.roster[0].maxHealth).toBe(run.roster[0].maxHealth + TRAINING_MAX_HEALTH);
    expect(after.roster[0].health).toBe(5 + TRAINING_MAX_HEALTH);
    expect(after.roster[1].maxHealth).toBe(run.roster[1].maxHealth + TRAINING_MAX_HEALTH);
    expect(after.roster[2].maxHealth).toBe(soldierCap);
    expect(after.roster[2].health).toBe(soldierCap);
  });

  it('adds gold', () => {
    expect(applyReward(fullRun(), { kind: 'gold', amount: 40 }).gold).toBe(40);
  });

  it('leaves the stage, convoy and fallen alone', () => {
    const run = fullRun();
    const after = applyReward(run, { kind: 'rest' });
    expect(after.stage).toBe(run.stage);
    expect(after.fallen).toEqual(run.fallen);
    expect(after.convoy).toEqual(run.convoy);
  });
});

describe('addGold', () => {
  it('adds to what the run has and never takes any away', () => {
    expect(addGold(addGold(fullRun(), 15), 10).gold).toBe(25);
    expect(addGold(fullRun(), -5).gold).toBe(0);
  });
});

describe('describeReward', () => {
  it('names each reward with a line of description', () => {
    const run = fullRun();
    const unit = { ...rollRecruit(run, 1, createSeededRng(1)), name: 'Dara', classId: 'wizard', level: 2 };
    expect(describeReward({ kind: 'recruit', unit })).toEqual({
      label: 'Recruit Dara',
      description: 'A level 2 Wizard joins the warband.',
    });
    expect(describeReward({ kind: 'rest' }).label).toBe('Rest');
    expect(
      describeReward({ kind: 'supplies', itemId: HEALTH_POTION.id, label: 'Health Potion' }).description,
    ).toContain('Health Potion');
    expect(describeReward({ kind: 'training', maxHealth: 2 }).description).toContain('+2 max HP');
    expect(describeReward({ kind: 'gold', amount: 40 }).label).toBe('40 Gold');
  });
});

describe('stage 1 rewards', () => {
  const lone = () => runOf(['alden', new Villager({ name: 'Alden', team: 'player' })]);
  const recruits = (rewards: readonly Reward[]) =>
    rewards.map((reward) => (reward.kind === 'recruit' ? reward.unit : null));

  it('offers a recruit of each starting class, in order', () => {
    for (let seed = 0; seed < 20; seed++) {
      const rewards = rollRewards(lone(), 1, createSeededRng(seed));
      expect(kinds(rewards)).toEqual(STARTING_CLASSES.map(() => 'recruit'));
      expect(recruits(rewards).map((unit) => unit?.classId)).toEqual(STARTING_CLASSES.map(({ id }) => id));
    }
  });

  it('names each recruit differently, and none after the warband', () => {
    for (let seed = 0; seed < 20; seed++) {
      const names = recruits(rollRewards(lone(), 1, createSeededRng(seed))).map((unit) => unit?.name);
      expect(new Set(names).size).toBe(names.length);
      expect(names).not.toContain('Alden');
    }
  });

  it('brings the recruits in at level 1 beside a level 1 warband', () => {
    for (const unit of recruits(rollRewards(lone(), 1, createSeededRng(4)))) expect(unit?.level).toBe(1);
  });

  it('still respects the count', () => {
    expect(rollRewards(lone(), 1, createSeededRng(4), 2)).toHaveLength(2);
  });

  it('falls back to the usual offers when the roster is full', () => {
    const run = fullRun();
    const full = withRoster(
      run,
      Array.from({ length: MAX_ROSTER_SIZE }, (_, i) => ({ ...run.roster[0], id: `u${i}` })),
    );
    expect(kinds(rollRewards(full, 1, createSeededRng(4)))).not.toContain('recruit');
  });

  it("describes a starting-class recruit with the class's pitch", () => {
    const [villager] = recruits(rollRewards(lone(), 1, createSeededRng(4)));
    expect(describeReward({ kind: 'recruit', unit: villager! }).description).toContain(STARTING_CLASSES[0].description);
  });
});

describe('rollRecruit options', () => {
  it('uses the given class and skips taken names', () => {
    const run = fullRun();
    const taken = WARBAND_NAMES.filter((name) => name !== 'Dara');
    const unit = rollRecruit(run, 2, createSeededRng(1), undefined, { classId: 'wizard', takenNames: taken });
    expect(unit.classId).toBe('wizard');
    expect(unit.name).toBe(WARBAND_NAMES.includes('Dara') ? 'Dara' : 'Recruit');
  });
});
