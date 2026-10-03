import { describe, expect, it } from 'vitest';
import { createDialog } from './dialog.ts';
import {
  getTriggeredDialog,
  isDialogTrigger,
  parseCharacters,
  parseDialogScript,
  turnTrigger,
} from './dialogScript.ts';

const CHARACTERS = parseCharacters({
  alden: { name: 'Alden', team: 'player' },
  foe: { name: 'Enemy Soldier', team: 'enemy', unitClass: 'soldier', portrait: 'Foe_Portrait' },
});

const parse = (text: string) => parseDialogScript(text, CHARACTERS, 'test.txt');

describe('parseCharacters', () => {
  it('fills in a missing unit class and portrait and freezes the roster', () => {
    expect(CHARACTERS.alden).toEqual({ name: 'Alden', team: 'player', unitClass: null, portrait: null });
    expect(CHARACTERS.foe.unitClass).toBe('soldier');
    expect(CHARACTERS.foe.portrait).toBe('Foe_Portrait');
    expect(Object.isFrozen(CHARACTERS)).toBe(true);
    expect(Object.isFrozen(CHARACTERS.alden)).toBe(true);
  });

  it('accepts an empty roster', () => {
    expect(parseCharacters({})).toEqual({});
  });

  it('throws on a malformed id, a missing name, or an unknown team', () => {
    expect(() => parseCharacters({ Alden: { name: 'A', team: 'player' } })).toThrow(/id "Alden"/);
    expect(() => parseCharacters({ a: { team: 'player' } })).toThrow(/no name/);
    expect(() => parseCharacters({ a: { name: 'A', team: 'neutral' } })).toThrow(/unknown team/);
    expect(() => parseCharacters({ a: null })).toThrow(/no name/);
    expect(() => parseCharacters(null)).toThrow();
  });
});

describe('isDialogTrigger', () => {
  it('knows opening, victory, defeat, and turn N', () => {
    for (const name of ['opening', 'victory', 'defeat', 'turn 1', 'turn 12']) expect(isDialogTrigger(name)).toBe(true);
    for (const name of ['turn 0', 'turn', 'turn x', 'ending', '']) expect(isDialogTrigger(name)).toBe(false);
  });
});

describe('turnTrigger', () => {
  it('names the section for a turn, which parses as a trigger', () => {
    expect(turnTrigger(3)).toBe('turn 3');
    expect(isDialogTrigger(turnTrigger(1))).toBe(true);
  });
});

describe('getTriggeredDialog', () => {
  const dialogs = parse('[opening]\nalden: Hi.\n[turn 2]\nfoe: Again?');

  it('returns the conversation for a trigger', () => {
    expect(getTriggeredDialog(dialogs, 'opening')).toBe(dialogs.opening);
    expect(getTriggeredDialog(dialogs, turnTrigger(2))![0].text).toBe('Again?');
  });

  it('returns null for a trigger the level has no conversation for', () => {
    expect(getTriggeredDialog(dialogs, 'victory')).toBeNull();
    expect(getTriggeredDialog(dialogs, turnTrigger(3))).toBeNull();
  });

  it('returns null for a level without dialog or an empty conversation', () => {
    expect(getTriggeredDialog(undefined, 'opening')).toBeNull();
    expect(getTriggeredDialog(null, 'opening')).toBeNull();
    expect(getTriggeredDialog({ opening: [] }, 'opening')).toBeNull();
  });
});

describe('parseDialogScript', () => {
  it('groups lines under their section, with the speaker filled in from the roster', () => {
    const scripts = parse(`
[opening]
alden: Onward!
foe: Hold the line!

[victory]
alden: It's over.
`);
    expect(Object.keys(scripts)).toEqual(['opening', 'victory']);
    expect(scripts.opening).toEqual([
      { speaker: 'Alden', team: 'player', unitClass: null, side: 'left', portrait: null, text: 'Onward!' },
      {
        speaker: 'Enemy Soldier',
        team: 'enemy',
        unitClass: 'soldier',
        side: 'right',
        portrait: 'Foe_Portrait',
        text: 'Hold the line!',
      },
    ]);
    expect(scripts.victory[0].text).toBe("It's over.");
  });

  it('produces scripts createDialog accepts', () => {
    const scripts = parse('[opening]\nalden: Hi.\nfoe: Bye.');
    expect(() => createDialog(scripts.opening)).not.toThrow();
  });

  it('ignores comments, blank lines, and surrounding whitespace, including CRLF endings', () => {
    const scripts = parse('# a comment\r\n\r\n  [opening]  \r\n   alden:   Spaced out.   \r\n# another\r\n');
    expect(scripts.opening).toHaveLength(1);
    expect(scripts.opening[0].text).toBe('Spaced out.');
  });

  it('keeps everything after the first colon as text', () => {
    expect(parse('[opening]\nalden: Orders: hold, then strike.').opening[0].text).toBe('Orders: hold, then strike.');
  });

  it('lets a line override the side', () => {
    const scripts = parse('[opening]\nalden (right): Over here.\nfoe(left): And me.');
    expect(scripts.opening.map((line) => line.side)).toEqual(['right', 'left']);
  });

  it('normalizes section headers', () => {
    expect(Object.keys(parse('[ Turn   3 ]\nalden: Hi.'))).toEqual(['turn 3']);
  });

  it('returns no sections for an empty file', () => {
    expect(parse('')).toEqual({});
    expect(parse('# just a comment')).toEqual({});
  });

  it('freezes the result', () => {
    const scripts = parse('[opening]\nalden: Hi.');
    expect(Object.isFrozen(scripts)).toBe(true);
    expect(Object.isFrozen(scripts.opening)).toBe(true);
    expect(Object.isFrozen(scripts.opening[0])).toBe(true);
  });

  describe('reports mistakes with the file and line number', () => {
    const cases = [
      ['an unknown speaker', '[opening]\naldn: Hi.', /test\.txt:2: unknown speaker "aldn"/],
      ['an unknown section', '\n[ending]\nalden: Hi.', /test\.txt:2: unknown section \[ending\]/],
      ['a repeated section', '[opening]\nalden: A\n[opening]\nalden: B', /test\.txt:3: .*appears twice/],
      ['a line before any section', 'alden: Hi.', /test\.txt:1: .*before any \[section\]/],
      ['a line that is not speech', '[opening]\nJust some words', /test\.txt:2: expected "speaker: text"/],
      ['an unknown side', '[opening]\nalden (up): Hi.', /test\.txt:2: unknown side "up"/],
      ['a speaker with nothing to say', '[opening]\nalden:   ', /test\.txt:2: "alden" has nothing to say/],
      ['an empty section', '[opening]\n[victory]\nalden: Hi.', /test\.txt: section \[opening\] has no lines/],
    ];
    for (const [name, text, error] of cases as [string, string, RegExp][]) {
      it(name, () => expect(() => parse(text)).toThrow(error));
    }
  });
});
