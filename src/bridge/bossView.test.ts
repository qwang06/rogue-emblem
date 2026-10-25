import { describe, expect, it } from 'vitest';
import { ORC_WARLORD, type BossState } from '../game/bosses.ts';
import type { Objective } from '../game/objectives.ts';
import { isSameBossBar, toBossBarView, toBossIntroView } from './bossView.ts';

const WARLORD: Objective = { kind: 'boss', unitId: 'enemy-1', name: 'Orc Warlord' };
const CHIEF: Objective = { kind: 'boss', unitId: 'enemy-3', name: 'Goblin Chief' };
const CALM: BossState = { unitId: 'enemy-1', rulesId: 'orc-warlord', enraged: false, incoming: null, called: 0 };

describe('toBossIntroView', () => {
  it('names the Warlord on his card, with his taunt', () => {
    expect(toBossIntroView({ id: 3, objective: WARLORD, durationMs: 2000 })).toEqual({
      id: 3,
      name: 'Grukk',
      title: 'Orc Warlord',
      taunt: ORC_WARLORD.taunt,
      durationMs: 2000,
    });
  });

  it('gives a boss without rules its one name and no taunt', () => {
    expect(toBossIntroView({ id: 1, objective: CHIEF, durationMs: 2000 })).toMatchObject({
      name: 'Goblin Chief',
      title: null,
      taunt: [],
    });
  });

  it('is null for any other objective', () => {
    expect(toBossIntroView({ id: 1, objective: { kind: 'rout' }, durationMs: 2000 })).toBeNull();
  });
});

describe('toBossBarView', () => {
  const unit = { health: 30, maxHealth: 40 };

  it('shows the boss’s health and its rules’ state', () => {
    expect(toBossBarView(WARLORD, CALM, unit)).toEqual({
      name: 'Grukk',
      title: 'Orc Warlord',
      health: 30,
      maxHealth: 40,
      enraged: false,
      hornSounded: false,
    });
    const raging = { ...CALM, enraged: true, incoming: { x: 1, y: 2 } };
    expect(toBossBarView(WARLORD, raging, unit)).toMatchObject({ enraged: true, hornSounded: true });
  });

  it('shows a hit the map is playing ahead of the battle, kept in bounds', () => {
    expect(toBossBarView(WARLORD, CALM, unit, 12)?.health).toBe(12);
    expect(toBossBarView(WARLORD, CALM, unit, -4)?.health).toBe(0);
    expect(toBossBarView(WARLORD, CALM, unit, 99)?.health).toBe(40);
  });

  it('shows a boss without rules calm', () => {
    expect(toBossBarView(CHIEF, null, unit)).toMatchObject({
      name: 'Goblin Chief',
      enraged: false,
      hornSounded: false,
    });
  });

  it('is gone once the boss falls, and for any other objective', () => {
    expect(toBossBarView(WARLORD, CALM, undefined)).toBeNull();
    expect(toBossBarView({ kind: 'rout' }, null, unit)).toBeNull();
  });
});

describe('isSameBossBar', () => {
  it('compares what the bar shows', () => {
    const bar = toBossBarView(WARLORD, CALM, { health: 30, maxHealth: 40 });
    expect(isSameBossBar(bar, toBossBarView(WARLORD, CALM, { health: 30, maxHealth: 40 }))).toBe(true);
    expect(isSameBossBar(bar, toBossBarView(WARLORD, CALM, { health: 29, maxHealth: 40 }))).toBe(false);
    expect(isSameBossBar(null, null)).toBe(true);
    expect(isSameBossBar(bar, null)).toBe(false);
  });
});
