import { describe, expect, it } from 'vitest';
import { parseCharacters, parseDialogScript } from './dialogScript.ts';
import { applyCustomDialogs, checkDialogUpload, compareTriggers, dialogNameOf } from './dialogUploads.ts';

const characters = parseCharacters({
  alden: { name: 'Alden', team: 'player' },
  guard: { name: 'Guard', team: 'enemy' },
});

const builtIn = Object.freeze({
  demo: parseDialogScript('[opening]\nalden: Built-in.', characters),
  training: parseDialogScript('[opening]\nguard: Spar!', characters),
});

describe('dialogNameOf', () => {
  it('strips the .txt extension', () => {
    expect(dialogNameOf('demo.txt')).toBe('demo');
  });

  it('ignores folders and the extension case', () => {
    expect(dialogNameOf('C:\\dialog\\Demo.TXT')).toBe('demo');
    expect(dialogNameOf('dialog/training.txt')).toBe('training');
  });

  it('rejects files that are not .txt', () => {
    expect(dialogNameOf('demo.json')).toBeNull();
    expect(dialogNameOf('demo')).toBeNull();
    expect(dialogNameOf('.txt')).toBeNull();
  });
});

describe('checkDialogUpload', () => {
  const known = ['demo', 'training'];

  it('accepts a file that replaces a level dialog file', () => {
    const result = checkDialogUpload('demo.txt', '[victory]\nalden: Won!', characters, known);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.name).toBe('demo');
    expect(result.scripts.victory[0]).toMatchObject({ speaker: 'Alden', text: 'Won!' });
  });

  it('rejects other file types', () => {
    const result = checkDialogUpload('demo.md', '[opening]\nalden: Hi', characters, known);
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('.txt') });
  });

  it('rejects names no level uses, listing the ones it expects', () => {
    const result = checkDialogUpload('chapter9.txt', '[opening]\nalden: Hi', characters, known);
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('demo.txt, training.txt') });
  });

  it('reports parse errors with the line number', () => {
    const result = checkDialogUpload('demo.txt', '[opening]\nnobody: Hi', characters, known);
    expect(result).toMatchObject({ ok: false, error: 'demo.txt:2: unknown speaker "nobody"' });
  });

  it('accepts an empty file (a level with no dialog)', () => {
    const result = checkDialogUpload('demo.txt', '', characters, known);
    expect(result).toMatchObject({ ok: true, scripts: {} });
  });
});

describe('applyCustomDialogs', () => {
  it('keeps the built-in files when nothing is uploaded', () => {
    const { files, errors } = applyCustomDialogs(builtIn, {}, characters);
    expect(files).toEqual(builtIn);
    expect(errors).toEqual({});
  });

  it('replaces the built-in file of the same name', () => {
    const { files } = applyCustomDialogs(builtIn, { demo: '[opening]\nguard: Custom.' }, characters);
    expect(files.demo.opening[0].text).toBe('Custom.');
    expect(files.training).toBe(builtIn.training);
  });

  it('falls back to the built-in file when an upload no longer parses', () => {
    const { files, errors } = applyCustomDialogs(builtIn, { demo: '[opening]\nbryn: Gone.' }, characters);
    expect(files.demo).toBe(builtIn.demo);
    expect(errors.demo).toContain('unknown speaker "bryn"');
  });

  it('ignores uploads for files the game does not have', () => {
    const { files, errors } = applyCustomDialogs(builtIn, { extra: '[opening]\nalden: Hi' }, characters);
    expect(Object.keys(files)).toEqual(['demo', 'training']);
    expect(errors.extra).toBeDefined();
  });
});

describe('compareTriggers', () => {
  it('orders opening, turns by number, victory, defeat', () => {
    const triggers = ['defeat', 'turn 10', 'victory', 'turn 2', 'opening'];
    expect(triggers.sort(compareTriggers)).toEqual(['opening', 'turn 2', 'turn 10', 'victory', 'defeat']);
  });
});
