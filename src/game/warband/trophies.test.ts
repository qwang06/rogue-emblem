import { describe, expect, it } from 'vitest';
import { Soldier } from '../Soldier.ts';
import { createRun, finishStage, restoreRoster, snapshotUnit } from './run.ts';
import { applyTrophies } from './trophies.ts';

const snapshot = (boons: string[]) => {
  const unit = new Soldier({ name: 'Alden', team: 'player' });
  unit.boons = Object.freeze(boons);
  return snapshotUnit('alden', unit);
};

describe('applyTrophies', () => {
  it('grows max HP and HP by Soul Harvest for each kill, every rank adding', () => {
    const before = snapshot(['soul-harvest', 'soul-harvest']);
    const after = applyTrophies(before, 3);
    expect(after.maxHealth).toBe(before.maxHealth + 6);
    expect(after.health).toBe(before.health + 6);
  });

  it('grows the highest stat by Trophy Hunter once a stage with a kill', () => {
    const before = snapshot(['trophy-hunter']);
    const best = (['strength', 'intelligence', 'dexterity', 'speed', 'defense', 'resistance'] as const).reduce(
      (top, stat) => (before[stat] > before[top] ? stat : top),
    );
    const after = applyTrophies(before, 4);
    expect(after[best]).toBe(before[best] + 1);
    expect(after.maxHealth).toBe(before.maxHealth);
  });

  it('gives nothing without kills or without trophies', () => {
    const trophied = snapshot(['soul-harvest', 'trophy-hunter']);
    expect(applyTrophies(trophied, 0)).toBe(trophied);
    const plain = snapshot(['brawler']);
    expect(applyTrophies(plain, 5)).toBe(plain);
  });
});

describe('trophies after a stage', () => {
  it('grow a unit that fought and won, and not on a defeat', () => {
    const unit = new Soldier({ name: 'Alden', team: 'player' });
    unit.boons = Object.freeze(['soul-harvest']);
    const run = createRun(1, new Map([['alden', unit]]));
    const units = restoreRoster(run);
    const result = { units, kills: new Map([['alden', 2]]) };
    const won = finishStage(run, result, 'victory').run;
    expect(won.roster[0].maxHealth).toBe(run.roster[0].maxHealth + 2);
    const lost = finishStage(run, result, 'defeat').run;
    expect(lost.roster[0].maxHealth).toBe(run.roster[0].maxHealth);
  });
});
