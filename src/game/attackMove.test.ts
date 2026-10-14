import { describe, expect, it } from 'vitest';
import { pickAttackPlan } from './attackMove.ts';
import type { RangeTile } from './movement.ts';

const SWORD = { minRange: 1, maxRange: 1 };
const BOW = { minRange: 2, maxRange: 2 };
const JAVELIN = { minRange: 1, maxRange: 2 };

// A straight corridor x = 0..4 at y = 0, the mover at x = 0.
const CORRIDOR: RangeTile[] = [0, 1, 2, 3, 4].map((x) => ({ x, y: 0, cost: x }));

describe('pickAttackPlan', () => {
  it('strikes from where the planned route ends when that reaches', () => {
    const path = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ];
    expect(pickAttackPlan(CORRIDOR, path, { x: 3, y: 0 }, [SWORD])).toEqual({
      tile: { x: 2, y: 0, cost: 2 },
      weaponIndex: 0,
    });
  });

  it("stays on the mover's own tile when the route's end can't reach", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 4, y: 0 },
    ];
    expect(pickAttackPlan(CORRIDOR, path, { x: 0, y: 2 }, [JAVELIN])?.tile).toEqual({ x: 0, y: 0, cost: 0 });
  });

  it('otherwise picks the cheapest tile in reach', () => {
    const path = [{ x: 0, y: 0 }];
    expect(pickAttackPlan(CORRIDOR, path, { x: 4, y: 1 }, [SWORD])?.tile).toEqual({ x: 4, y: 0, cost: 4 });
    expect(pickAttackPlan(CORRIDOR, path, { x: 4, y: 1 }, [JAVELIN])?.tile).toEqual({ x: 3, y: 0, cost: 3 });
  });

  it('prefers the cheaper of two tiles in reach whatever their order in the range', () => {
    const range = [...CORRIDOR].reverse();
    expect(pickAttackPlan(range, [{ x: 0, y: 0 }], { x: 2, y: 1 }, [JAVELIN])?.tile).toEqual({ x: 1, y: 0, cost: 1 });
  });

  it('keeps the first weapon that reaches from the chosen tile', () => {
    const path = [{ x: 0, y: 0 }];
    expect(pickAttackPlan(CORRIDOR, path, { x: 1, y: 0 }, [BOW, SWORD])).toEqual({
      tile: { x: 0, y: 0, cost: 0 },
      weaponIndex: 1,
    });
    expect(pickAttackPlan(CORRIDOR, path, { x: 2, y: 0 }, [BOW, SWORD])).toEqual({
      tile: { x: 0, y: 0, cost: 0 },
      weaponIndex: 0,
    });
  });

  it('respects a minimum range', () => {
    // A bow can't hit point-blank: from x = 1 the target at x = 2 is too
    // close, so it backs off to x = 0.
    const path = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ];
    expect(pickAttackPlan(CORRIDOR, path, { x: 2, y: 0 }, [BOW])?.tile).toEqual({ x: 0, y: 0, cost: 0 });
  });

  it("skips a route end that isn't a place to stop (an ally passed through)", () => {
    const range = CORRIDOR.filter(({ x }) => x !== 2);
    const path = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ];
    expect(pickAttackPlan(range, path, { x: 2, y: 1 }, [JAVELIN])?.tile).toEqual({ x: 1, y: 0, cost: 1 });
  });

  it('returns null when nothing reaches or there are no weapons', () => {
    expect(pickAttackPlan(CORRIDOR, [{ x: 0, y: 0 }], { x: 9, y: 9 }, [JAVELIN])).toBeNull();
    expect(pickAttackPlan(CORRIDOR, [{ x: 0, y: 0 }], { x: 1, y: 1 }, [])).toBeNull();
    expect(pickAttackPlan([], [], { x: 1, y: 1 }, [SWORD])).toBeNull();
  });
});
