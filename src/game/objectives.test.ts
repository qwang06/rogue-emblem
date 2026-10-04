import { describe, expect, it } from 'vitest';
import { DEFAULT_OBJECTIVE, describeObjective, ROUT } from './objectives.ts';

describe('objectives', () => {
  it('defaults to a rout', () => {
    expect(DEFAULT_OBJECTIVE).toBe(ROUT);
    expect(ROUT).toEqual({ kind: 'rout' });
  });

  it('describes a rout as defeating every enemy, lost when every unit falls', () => {
    expect(describeObjective(ROUT)).toEqual({ goal: 'Defeat all enemies', defeat: 'All your units fall' });
  });

  it('returns frozen text', () => {
    expect(Object.isFrozen(describeObjective(ROUT))).toBe(true);
  });
});
