import { describe, expect, it } from 'vitest';
import { getDeployedCurses } from '../curses.ts';
import { createSeededRng } from '../rng.ts';
import { Soldier } from '../Soldier.ts';
import { findEliteAffix } from './elites.ts';
import { findKeystone, isKeystoneStage, KEYSTONE_CHOICES, KEYSTONES, rollKeystones } from './keystones.ts';
import { applyReward, describeReward, rollStageRewards } from './rewards.ts';
import { rollStartingRelics } from './relics.ts';
import { createRun, parseRun, restoreRoster, serializeRun } from './run.ts';

const run = () =>
  createRun(
    3,
    new Map([
      ['alden', new Soldier({ name: 'Alden', team: 'player' })],
      ['bryn', new Soldier({ name: 'Bryn', team: 'player' })],
    ]),
  );

describe('keystones', () => {
  it('each have an upside and a cost, with shared curses and known affixes', () => {
    expect(new Set(KEYSTONES.map(({ id }) => id)).size).toBe(KEYSTONES.length);
    for (const keystone of KEYSTONES) {
      expect(keystone.modifiers.length, keystone.id).toBeGreaterThan(0);
      expect(keystone.curses.length, keystone.id).toBeGreaterThan(0);
      for (const curse of keystone.curses) {
        expect(curse.shared).toBe(`keystone-${keystone.id}`);
        if (curse.kind === 'enemy-affix') expect(findEliteAffix(curse.affixId), curse.affixId).not.toBeNull();
      }
    }
  });

  it('are offered after every tenth stage', () => {
    expect([1, 9, 10, 11, 20, 30].map(isKeystoneStage)).toEqual([false, false, true, false, true, true]);
    expect(isKeystoneStage(0)).toBe(false);
  });

  it('never offer the one the warband holds', () => {
    for (let seed = 0; seed < 20; seed++) {
      const offered = rollKeystones(createSeededRng(seed), 'frenzy-pact');
      expect(offered).toHaveLength(KEYSTONE_CHOICES);
      expect(offered.map(({ id }) => id)).not.toContain('frenzy-pact');
    }
  });

  it('replace a stage ten clear reward pick', () => {
    const rewards = rollStageRewards(run(), 10);
    expect(rewards).toHaveLength(KEYSTONE_CHOICES);
    expect(rewards.every((reward) => reward.kind === 'keystone')).toBe(true);
    expect(rollStageRewards(run(), 9).some((reward) => reward.kind === 'keystone')).toBe(false);
  });

  it('are held one at a time, a new one replacing the old', () => {
    const first = applyReward(run(), { kind: 'keystone', keystoneId: 'glass-lens' });
    expect(first.keystone).toBe('glass-lens');
    const reward = { kind: 'keystone' as const, keystoneId: 'iron-legion' };
    expect(describeReward(reward, undefined, first).description).toContain('Replaces Glass Lens.');
    expect(applyReward(first, reward).keystone).toBe('iron-legion');
    expect(applyReward(run(), { kind: 'keystone', keystoneId: 'nonsense' }).keystone).toBeUndefined();
  });

  it('give every unit its modifiers, and its curses fall once however many deploy', () => {
    const units = restoreRoster({ ...run(), keystone: 'frenzy-pact' });
    for (const unit of units.values()) expect(unit.modifiers).toContainEqual({ kind: 'always-double' });
    expect(getDeployedCurses(units, [...units.keys()])).toEqual(findKeystone('frenzy-pact')!.curses);
  });

  it('survive a save', () => {
    const saved = { ...run(), keystone: 'vampire-court' };
    expect(parseRun(serializeRun(saved))?.keystone).toBe('vampire-court');
    expect(parseRun(serializeRun(run()))?.keystone).toBeUndefined();
  });
});

describe('the Lone Wolf relic', () => {
  it('is never a starting relic', () => {
    for (let seed = 0; seed < 200; seed++) {
      expect(rollStartingRelics(seed).map(({ id }) => id)).not.toContain('lone-wolf');
    }
  });
});
