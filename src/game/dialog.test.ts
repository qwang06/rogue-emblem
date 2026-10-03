import { describe, expect, it } from 'vitest';
import {
  advanceDialog,
  createDialog,
  getCurrentLine,
  getRevealDurationMs,
  getRevealedLength,
  isLastLine,
  type DialogLineInput,
} from './dialog.ts';

const SCRIPT: DialogLineInput[] = [
  { speaker: 'Alden', team: 'player', unitClass: 'villager', side: 'left', text: 'Hello.' },
  { speaker: 'Foe', team: 'enemy', unitClass: 'soldier', side: 'right', text: 'Begone!' },
];

describe('createDialog', () => {
  it('starts on the first line, not yet revealed', () => {
    const dialog = createDialog(SCRIPT);
    expect(dialog.index).toBe(0);
    expect(dialog.revealed).toBe(false);
    expect(getCurrentLine(dialog)).toEqual({ ...SCRIPT[0], portrait: null });
  });

  it('freezes the dialog and its lines', () => {
    const dialog = createDialog(SCRIPT);
    expect(Object.isFrozen(dialog)).toBe(true);
    expect(Object.isFrozen(dialog.lines)).toBe(true);
    expect(dialog.lines.every(Object.isFrozen)).toBe(true);
  });

  it('defaults a missing speaker, team, unitClass, portrait, and side', () => {
    const line = getCurrentLine(createDialog([{ text: 'Narration.' }]));
    expect(line).toEqual({
      speaker: '',
      team: null,
      unitClass: null,
      side: 'left',
      portrait: null,
      text: 'Narration.',
    });
  });

  it('throws on an empty script, a line without text, or an unknown side', () => {
    expect(() => createDialog([])).toThrow();
    // @ts-expect-error a script is required
    expect(() => createDialog(undefined)).toThrow();
    expect(() => createDialog([{ speaker: 'A', text: '' }])).toThrow();
    // @ts-expect-error not a side
    expect(() => createDialog([{ text: 'Hi', side: 'up' }])).toThrow();
  });
});

describe('getRevealDurationMs / getRevealedLength', () => {
  it('types one character per 1000 / speed ms', () => {
    expect(getRevealDurationMs('abcd', 10)).toBe(400);
    expect(getRevealedLength('abcd', 0, 10)).toBe(0);
    expect(getRevealedLength('abcd', 250, 10)).toBe(2);
    expect(getRevealedLength('abcd', 400, 10)).toBe(4);
  });

  it('never shows more than the text or less than nothing', () => {
    expect(getRevealedLength('abcd', 10_000, 10)).toBe(4);
    expect(getRevealedLength('abcd', -50, 10)).toBe(0);
  });

  it('shows everything at once with no speed', () => {
    expect(getRevealDurationMs('abcd', 0)).toBe(0);
    expect(getRevealedLength('abcd', 0, 0)).toBe(4);
  });

  it('takes no time for empty text', () => {
    expect(getRevealDurationMs('', 10)).toBe(0);
  });
});

describe('advanceDialog', () => {
  const speed = 10; // 'Hello.' takes 600ms

  it('finishes typing a line that is still typing out', () => {
    const dialog = createDialog(SCRIPT);
    const next = advanceDialog(dialog, 100, speed);
    expect(next!.index).toBe(0);
    expect(next!.revealed).toBe(true);
    expect(dialog.revealed).toBe(false); // input untouched
  });

  it('moves to the next line once the line is shown', () => {
    const next = advanceDialog(createDialog(SCRIPT), 600, speed);
    expect(next!.index).toBe(1);
    expect(next!.revealed).toBe(false);
  });

  it('moves on from a line the player already revealed, however little time passed', () => {
    const revealed = advanceDialog(createDialog(SCRIPT), 0, speed);
    expect(advanceDialog(revealed!, 0, speed)!.index).toBe(1);
  });

  it('ends the dialog after the last line', () => {
    const last = advanceDialog(createDialog(SCRIPT), 600, speed);
    expect(isLastLine(last!)).toBe(true);
    expect(advanceDialog(last!, 10_000, speed)).toBeNull();
  });

  it('ends a one-line dialog after one reveal and one confirm', () => {
    const dialog = createDialog([{ text: 'Only line.' }]);
    const revealed = advanceDialog(dialog, 0, speed);
    expect(revealed!.revealed).toBe(true);
    expect(advanceDialog(revealed!, 0, speed)).toBeNull();
  });
});
