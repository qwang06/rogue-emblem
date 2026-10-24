import { describe, expect, it } from 'vitest';
import { addPlayTime, EMPTY_CHRONICLE, parseChronicle, recordBattle, type ChronicleBattle } from './chronicle.ts';

const battle = (overrides: Partial<ChronicleBattle> = {}): ChronicleBattle => ({
  stage: 2,
  kills: new Map(),
  unitIds: ['alden', 'bryn'],
  fallenIds: [],
  bossDefeated: false,
  elapsedMs: 0,
  ...overrides,
});

describe('recordBattle', () => {
  it("adds the warband's kills, leaving out units that didn't fight for it", () => {
    const kills = new Map([
      ['alden', 2],
      ['enemy-1', 1],
      ['guest', 3],
    ]);
    const once = recordBattle(EMPTY_CHRONICLE, battle({ kills }));
    expect(once.kills).toEqual({ alden: 2 });
    expect(
      recordBattle(
        once,
        battle({
          kills: new Map([
            ['alden', 1],
            ['bryn', 1],
          ]),
        }),
      ).kills,
    ).toEqual({
      alden: 3,
      bryn: 1,
    });
  });

  it('notes the stage each fallen unit fell on', () => {
    expect(recordBattle(EMPTY_CHRONICLE, battle({ stage: 5, fallenIds: ['bryn'] })).fallenOn).toEqual({ bryn: 5 });
  });

  it('counts a boss beaten and adds the time', () => {
    const after = recordBattle(EMPTY_CHRONICLE, battle({ bossDefeated: true, elapsedMs: 1500.4 }));
    expect(after.bossesDefeated).toBe(1);
    expect(after.playMs).toBe(1500);
    expect(recordBattle(after, battle()).bossesDefeated).toBe(1);
  });

  it('leaves its input alone and returns a frozen chronicle', () => {
    const after = recordBattle(EMPTY_CHRONICLE, battle({ kills: new Map([['alden', 1]]) }));
    expect(EMPTY_CHRONICLE.kills).toEqual({});
    expect(Object.isFrozen(after)).toBe(true);
    expect(Object.isFrozen(after.kills)).toBe(true);
    expect(Object.isFrozen(after.fallenOn)).toBe(true);
  });
});

describe('addPlayTime', () => {
  it('adds whole milliseconds and never takes time away', () => {
    expect(addPlayTime(EMPTY_CHRONICLE, 2000).playMs).toBe(2000);
    expect(addPlayTime(addPlayTime(EMPTY_CHRONICLE, 2000), -500).playMs).toBe(2000);
    expect(addPlayTime(EMPTY_CHRONICLE, Number.NaN).playMs).toBe(0);
  });
});

describe('parseChronicle', () => {
  it('reads a saved chronicle back', () => {
    const chronicle = recordBattle(EMPTY_CHRONICLE, battle({ kills: new Map([['alden', 2]]), fallenIds: ['bryn'] }));
    expect(parseChronicle(JSON.parse(JSON.stringify(chronicle)))).toEqual(chronicle);
  });

  it.each([
    ['null', null],
    ['a list', []],
    ['missing fields', { kills: {} }],
    ['negative kills', { kills: { a: -1 }, fallenOn: {}, bossesDefeated: 0, playMs: 0 }],
    ['a fractional time', { kills: {}, fallenOn: {}, bossesDefeated: 0, playMs: 1.5 }],
    ['a stage as text', { kills: {}, fallenOn: { a: 'two' }, bossesDefeated: 0, playMs: 0 }],
  ])('rejects %s', (_, value) => {
    expect(parseChronicle(value)).toBeNull();
  });
});
