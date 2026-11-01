import { describe, expect, it } from 'vitest';
import { BEAST_STATS } from '../Beast.ts';
import { growToLevel } from '../experience.ts';
import { createUnitOfClass } from '../unitClasses.ts';
import { WHELP_GROWN_LEVEL, WHELP_STATS } from '../Whelp.ts';
import { VILLAGER_STATS } from '../Villager.ts';
import { restoreUnit, snapshotUnit } from './run.ts';
import { canGrowUp, growUpWhelp } from './whelp.ts';

function whelpAt(level: number) {
  const unit = createUnitOfClass('whelp', { name: 'Pip', team: 'player' });
  growToLevel(unit, level);
  return unit;
}

describe('the whelp', () => {
  it('starts no stronger than a villager', () => {
    expect(WHELP_STATS.health).toBeLessThanOrEqual(VILLAGER_STATS.health);
    expect(WHELP_STATS.strength).toBeLessThan(VILLAGER_STATS.strength);
    expect(WHELP_STATS.movement).toBe(VILLAGER_STATS.movement);
    expect(WHELP_STATS.health).toBeLessThan(BEAST_STATS.health);
  });

  it('stays a whelp below the grown level', () => {
    const snapshot = snapshotUnit('whelp-1', whelpAt(WHELP_GROWN_LEVEL - 1));
    expect(canGrowUp(snapshot)).toBe(false);
    expect(snapshot.classId).toBe('whelp');
    expect(growUpWhelp(snapshot)).toBe(snapshot);
  });

  it('is saved grown into a Beast at the grown level, as a fresh Beast of that level would be', () => {
    const whelp = whelpAt(WHELP_GROWN_LEVEL);
    const grown = snapshotUnit('whelp-1', whelp);
    const beast = createUnitOfClass('beast', { team: 'player' });
    growToLevel(beast, WHELP_GROWN_LEVEL);
    expect(grown.classId).toBe('beast');
    expect(grown.level).toBe(WHELP_GROWN_LEVEL);
    expect(grown.name).toBe('Pip');
    expect(grown.maxHealth).toBe(beast.maxHealth);
    expect(grown.strength).toBe(beast.strength);
    expect(grown.health).toBe(whelp.health + (BEAST_STATS.health - WHELP_STATS.health));
    const restored = restoreUnit(grown);
    expect(restored.unitClass).toBe('beast');
    expect(restored.movement).toBe(BEAST_STATS.movement);
  });

  it('leaves other classes alone', () => {
    const snapshot = snapshotUnit('beast-1', createUnitOfClass('beast', { team: 'player', level: 6 }));
    expect(growUpWhelp(snapshot)).toBe(snapshot);
  });
});
