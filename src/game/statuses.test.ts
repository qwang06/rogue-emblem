import { describe, expect, it } from 'vitest';
import { getFighterBonus } from './combat.ts';
import { getPhaseMovement } from './enemyAI.ts';
import {
  addStatus,
  clearStatuses,
  getStatusModifiers,
  getStatusMovement,
  isRooted,
  STATUS_IDS,
  STATUSES,
} from './statuses.ts';

describe('STATUSES', () => {
  it('describes every status', () => {
    for (const id of STATUS_IDS) expect(STATUSES[id]).toMatchObject({ id, label: expect.any(String) });
  });
});

describe('addStatus', () => {
  it("adds a status once, leaving the list it's given alone", () => {
    const none: readonly ('rooted' | 'marked')[] = [];
    const rooted = addStatus(none, 'rooted');
    expect(rooted).toEqual(['rooted']);
    expect(none).toEqual([]);
    expect(addStatus(rooted, 'rooted')).toBe(rooted);
    expect(addStatus(rooted, 'marked')).toEqual(['rooted', 'marked']);
  });
});

describe('clearStatuses', () => {
  it('drops the statuses of one kind, keeping the rest', () => {
    expect(clearStatuses(['rooted', 'guarded', 'marked', 'hastened'], 'debuff')).toEqual(['guarded', 'hastened']);
    expect(clearStatuses(['rooted', 'guarded'], 'buff')).toEqual(['rooted']);
  });
});

describe('hastened', () => {
  it('adds 2 MOV, but not to a rooted unit', () => {
    expect(getStatusMovement({ statuses: ['hastened'] })).toBe(2);
    expect(getStatusMovement({})).toBe(0);
    expect(getPhaseMovement({ movement: 5, statuses: ['hastened'] })).toBe(7);
    expect(getPhaseMovement({ movement: 5, statuses: ['hastened', 'rooted'] })).toBe(0);
  });
});

describe('getStatusModifiers', () => {
  it("is each status's modifiers, and none for none", () => {
    expect(getStatusModifiers(undefined)).toEqual([]);
    expect(getStatusModifiers(['rooted'])).toEqual([]);
    expect(getStatusModifiers(['sundered', 'marked'])).toEqual([
      { kind: 'combat', term: 'guard', amount: -3 },
      { kind: 'combat', term: 'avoid', amount: -15 },
    ]);
  });
});

describe('rooted', () => {
  it('stops a unit moving on its phase', () => {
    expect(isRooted({ statuses: ['rooted'] })).toBe(true);
    expect(isRooted({})).toBe(false);
    expect(getPhaseMovement({ movement: 5, statuses: ['rooted'] })).toBe(0);
    expect(getPhaseMovement({ movement: 5, statuses: ['marked'] })).toBe(5);
  });
});

describe('statuses in combat', () => {
  it('lets Sundered take 3 more damage and Marked be hit more often', () => {
    const foe = { strength: 5, defense: 0 };
    expect(getFighterBonus({ ...foe, statuses: ['sundered'] }, foe, false)?.guard).toBe(-3);
    expect(getFighterBonus(foe, foe, false)).toBeUndefined();
    expect(getFighterBonus({ ...foe, statuses: ['marked'] }, foe, true)?.avoid).toBe(-15);
  });
});

describe('Lurking', () => {
  it('is a weaker Veiled: a buff with +15 avoid', () => {
    expect(STATUSES.lurking.kind).toBe('buff');
    expect(STATUSES.lurking.modifiers).toEqual([{ kind: 'combat', term: 'avoid', amount: 15 }]);
    expect(STATUSES.veiled.modifiers).toEqual([{ kind: 'combat', term: 'avoid', amount: 30 }]);
  });
});
