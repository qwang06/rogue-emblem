import { describe, expect, it } from 'vitest';
import { Archer } from '../Archer.ts';
import { MASTER_SEAL, MAX_INVENTORY_SLOTS } from '../items.ts';
import { PROMOTION_LEVEL } from '../promotions.ts';
import type { Unit } from '../Unit.ts';
import { Warrior } from '../Warrior.ts';
import { BALLISTA } from '../weapons.ts';
import { canPromoteInRun, countSeals, getPromotionCandidates, promoteInRun } from './promotion.ts';
import { createRun, restoreUnit, type ItemSnapshot, type RunState } from './run.ts';

const SEAL: ItemSnapshot = { itemId: MASTER_SEAL.id, quantity: 1 };

function campRun({ convoy = [SEAL], level = PROMOTION_LEVEL } = {}): RunState {
  const run = createRun(
    3,
    new Map<string, Unit>([
      ['ada', new Warrior({ name: 'Ada', team: 'player' })],
      ['bryn', new Archer({ name: 'Bryn', team: 'player' })],
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
    const run = promoteInRun(campRun(), 'ada', 'hero');
    expect(getPromotionCandidates(run).map((unit) => unit.id)).toEqual(['bryn']);
  });
});

describe('canPromoteInRun', () => {
  it('needs a seal, the level and one of its own class’s promotions', () => {
    expect(canPromoteInRun(campRun(), 'ada', 'hero')).toBe(true);
    expect(canPromoteInRun(campRun({ convoy: [] }), 'ada', 'hero')).toBe(false);
    expect(canPromoteInRun(campRun({ level: PROMOTION_LEVEL - 1 }), 'ada', 'hero')).toBe(false);
    expect(canPromoteInRun(campRun(), 'ada', 'sniper')).toBe(false);
    expect(canPromoteInRun(campRun(), 'nobody', 'hero')).toBe(false);
  });
});

describe('promoteInRun', () => {
  it('promotes the unit and spends the convoy’s seal', () => {
    const before = campRun();
    const after = promoteInRun(before, 'ada', 'hero');
    expect(ada(after).classId).toBe('hero');
    expect(ada(after).level).toBe(PROMOTION_LEVEL);
    expect(ada(after).maxHealth).toBe(ada(before).maxHealth + 4);
    expect(after.convoy).toEqual([]);
    expect(bryn(after)).toEqual(bryn(before));
    expect(Object.isFrozen(after)).toBe(true);
  });

  it('spends the unit’s own seal before the convoy’s', () => {
    const run = campRun();
    const carrying = {
      ...run,
      roster: run.roster.map((u) => (u.id === 'ada' ? { ...u, items: [...u.items, SEAL] } : u)),
    };
    const after = promoteInRun(carrying, 'ada', 'hero');
    expect(after.convoy).toEqual([SEAL]);
    expect(ada(after).items.some((entry) => entry.itemId === MASTER_SEAL.id)).toBe(false);
  });

  it('spends another unit’s seal when nobody else holds one', () => {
    const run = campRun({ convoy: [] });
    const carrying = {
      ...run,
      roster: run.roster.map((u) => (u.id === 'bryn' ? { ...u, items: [...u.items, SEAL] } : u)),
    };
    const after = promoteInRun(carrying, 'ada', 'berserker');
    expect(countSeals(after)).toBe(0);
    expect(ada(after).classId).toBe('berserker');
  });

  it('hands over the gift weapon, or sends it to the convoy without room', () => {
    const after = promoteInRun(campRun(), 'bryn', 'arbalest');
    expect(bryn(after).items.at(-1)).toEqual({ itemId: BALLISTA.id, quantity: BALLISTA.uses });
    expect(restoreUnit(bryn(after)).weaponTypes).toContain('siege');

    const run = campRun();
    const filler = { itemId: 'health-potion', quantity: 1 };
    const full = {
      ...run,
      roster: run.roster.map((u) =>
        u.id === 'bryn' ? { ...u, items: Array.from({ length: MAX_INVENTORY_SLOTS }, () => filler) } : u,
      ),
    };
    const sent = promoteInRun(full, 'bryn', 'arbalest');
    expect(sent.convoy).toEqual([{ itemId: BALLISTA.id, quantity: BALLISTA.uses }]);
  });

  it('keeps a promoted unit’s new class through a save', () => {
    const after = promoteInRun(campRun(), 'ada', 'hero');
    expect(restoreUnit(ada(after)).unitClass).toBe('hero');
  });

  it('throws when the unit can’t promote', () => {
    expect(() => promoteInRun(campRun({ convoy: [] }), 'ada', 'hero')).toThrow();
  });
});
