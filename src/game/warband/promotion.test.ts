import { describe, expect, it } from 'vitest';
import { MASTER_SEAL } from '../items.ts';
import { PROMOTION_LEVEL } from '../promotions.ts';
import type { Unit } from '../Unit.ts';
import { Villager } from '../Villager.ts';
import { POWDER_KEG } from '../weapons.ts';
import { canPromoteInRun, countSeals, getPromotionCandidates, promoteInRun } from './promotion.ts';
import { createRun, restoreUnit, type ItemSnapshot, type RunState } from './run.ts';

const SEAL: ItemSnapshot = { itemId: MASTER_SEAL.id, quantity: 1 };

function campRun({ convoy = [SEAL], level = PROMOTION_LEVEL } = {}): RunState {
  const run = createRun(
    3,
    new Map<string, Unit>([
      ['ada', new Villager({ name: 'Ada', team: 'player' })],
      ['bryn', new Villager({ name: 'Bryn', team: 'player' })],
    ]),
  );
  return { ...run, convoy, roster: run.roster.map((unit) => ({ ...unit, level })) };
}

const ada = (run: RunState) => run.roster.find((unit) => unit.id === 'ada')!;
const bryn = (run: RunState) => run.roster.find((unit) => unit.id === 'bryn')!;

describe('countSeals', () => {
  it('counts seals in the convoy and on units', () => {
    const run = campRun({ convoy: [SEAL, SEAL] });
    expect(countSeals(run)).toBe(2);
    const carried = { ...run, roster: run.roster.map((unit) => ({ ...unit, items: [...unit.items, SEAL] })) };
    expect(countSeals(carried)).toBe(4);
    expect(countSeals(campRun({ convoy: [] }))).toBe(0);
  });
});

describe('getPromotionCandidates', () => {
  it('lists the units at PROMOTION_LEVEL or past it, in roster order', () => {
    expect(getPromotionCandidates(campRun()).map((unit) => unit.id)).toEqual(['ada', 'bryn']);
    expect(getPromotionCandidates(campRun({ level: PROMOTION_LEVEL - 1 }))).toEqual([]);
  });

  it('leaves out a unit that has already promoted', () => {
    const run = promoteInRun(campRun(), 'ada', 'vanguard');
    expect(getPromotionCandidates(run).map((unit) => unit.id)).toEqual(['bryn']);
  });
});

describe('canPromoteInRun', () => {
  it('needs a seal, the level and one of its own class’s promotions', () => {
    expect(canPromoteInRun(campRun(), 'ada', 'vanguard')).toBe(true);
    expect(canPromoteInRun(campRun({ convoy: [] }), 'ada', 'vanguard')).toBe(false);
    expect(canPromoteInRun(campRun({ level: PROMOTION_LEVEL - 1 }), 'ada', 'vanguard')).toBe(false);
    expect(canPromoteInRun(campRun(), 'ada', 'scout')).toBe(false);
    expect(canPromoteInRun(campRun(), 'nobody', 'vanguard')).toBe(false);
  });
});

describe('promoteInRun', () => {
  it('promotes the unit and spends the convoy’s seal', () => {
    const before = campRun();
    const after = promoteInRun(before, 'ada', 'vanguard');
    expect(ada(after).classId).toBe('vanguard');
    expect(ada(after).level).toBe(PROMOTION_LEVEL);
    expect(ada(after).maxHealth).toBe(ada(before).maxHealth + 2);
    // The Vanguard's gift axe replaces the wooden sword, which goes to the convoy.
    expect(ada(after).equipment).toEqual({ main: 'iron-axe' });
    expect(after.convoy).toEqual([{ itemId: 'wooden-sword', quantity: 1 }]);
    expect(bryn(after)).toEqual(bryn(before));
    expect(Object.isFrozen(after)).toBe(true);
  });

  it('spends the unit’s own seal before the convoy’s', () => {
    const run = campRun();
    const carrying = {
      ...run,
      roster: run.roster.map((u) => (u.id === 'ada' ? { ...u, items: [...u.items, SEAL] } : u)),
    };
    const after = promoteInRun(carrying, 'ada', 'vanguard');
    expect(after.convoy).toEqual([SEAL, { itemId: 'wooden-sword', quantity: 1 }]);
    expect(ada(after).items.some((entry) => entry.itemId === MASTER_SEAL.id)).toBe(false);
  });

  it('spends another unit’s seal when nobody else holds one', () => {
    const run = campRun({ convoy: [] });
    const carrying = {
      ...run,
      roster: run.roster.map((u) => (u.id === 'bryn' ? { ...u, items: [...u.items, SEAL] } : u)),
    };
    const after = promoteInRun(carrying, 'ada', 'archer');
    expect(countSeals(after)).toBe(0);
    expect(ada(after).classId).toBe('archer');
  });

  it('puts the gift weapon in the main hand, sending what it displaces to the convoy', () => {
    const run = campRun();
    const shielded = {
      ...run,
      roster: run.roster.map((u) =>
        u.id === 'bryn' ? { ...u, equipment: { main: 'wooden-sword', off: 'wooden-shield' } } : u,
      ),
    };
    const after = promoteInRun(shielded, 'bryn', 'sapper');
    expect(bryn(after).equipment).toEqual({ main: POWDER_KEG.id });
    expect(restoreUnit(bryn(after)).weaponTypes).toContain('siege');
    // The keg takes both hands, so the shield comes off too.
    expect(after.convoy).toEqual([
      { itemId: 'wooden-sword', quantity: 1 },
      { itemId: 'wooden-shield', quantity: 1 },
    ]);
  });

  it('keeps a promoted unit’s new class through a save', () => {
    const after = promoteInRun(campRun(), 'ada', 'vanguard');
    expect(restoreUnit(ada(after)).unitClass).toBe('vanguard');
  });

  it('throws when the unit can’t promote', () => {
    expect(() => promoteInRun(campRun({ convoy: [] }), 'ada', 'vanguard')).toThrow();
  });
});
