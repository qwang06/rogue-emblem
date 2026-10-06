import { describe, expect, it } from 'vitest';
import { describeEnemyGroup } from './enemyGroups.ts';

describe('describeEnemyGroup', () => {
  it('is just the count with no limits', () => {
    expect(describeEnemyGroup({ count: 3 })).toBe('3');
  });

  it('lists the region as percentages of the map', () => {
    expect(describeEnemyGroup({ count: 2, region: { y: [0, 0.34] } })).toBe('2 · rows 0–34%');
    expect(describeEnemyGroup({ count: 1, region: { x: [0.5, 1], y: [0.25, 0.75] } })).toBe(
      '1 · columns 50–100% · rows 25–75%',
    );
  });

  it('lists the walking distance however much of it is set', () => {
    expect(describeEnemyGroup({ count: 2, minDistance: 6, maxDistance: 12 })).toBe('2 · 6–12 steps');
    expect(describeEnemyGroup({ count: 2, minDistance: 6 })).toBe('2 · 6+ steps');
    expect(describeEnemyGroup({ count: 2, maxDistance: 8 })).toBe('2 · up to 8 steps');
    expect(describeEnemyGroup({ count: 1, minDistance: 4, maxDistance: 4 })).toBe('1 · 4 steps');
  });

  it('puts the region before the distance', () => {
    expect(describeEnemyGroup({ count: 2, region: { y: [0, 0.5] }, minDistance: 6 })).toBe('2 · rows 0–50% · 6+ steps');
  });
});
