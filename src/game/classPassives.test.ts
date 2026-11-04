import { describe, expect, it } from 'vitest';
import { getClassPassive } from './classPassives.ts';
import { SOLDIER_PASSIVE } from './Soldier.ts';
import { SLIME_PASSIVE } from './Slime.ts';
import { TROLL_PASSIVE } from './Troll.ts';

describe('getClassPassive', () => {
  it("gives a promoted class's passive", () => {
    expect(getClassPassive('soldier')?.name).toBe(SOLDIER_PASSIVE.name);
  });

  it("gives a monster's own passive", () => {
    expect(getClassPassive('slime')?.name).toBe(SLIME_PASSIVE.name);
    expect(getClassPassive('troll')?.name).toBe(TROLL_PASSIVE.name);
  });

  it('is null for a class without one, or no class', () => {
    expect(getClassPassive('goblin')).toBeNull();
    expect(getClassPassive('villager')).toBeNull();
    expect(getClassPassive(null)).toBeNull();
  });
});
