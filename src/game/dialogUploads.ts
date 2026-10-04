// Rules for dialog files the player uploads to replace the built-in ones.
// An upload replaces the level dialog file with the same name (demo.txt
// replaces the demo battle's), so only names a level uses are accepted, and
// the text must parse against the character roster like a built-in file.
// Storing uploads is src/data/customDialogs.ts's job; this module only
// decides what's valid and what the game ends up playing.

import { parseDialogScript, type Characters, type DialogFiles, type DialogScripts } from './dialogScript.ts';

// Uploaded dialog text by dialog file name (without .txt).
export type DialogTexts = Readonly<Record<string, string>>;

export type DialogUploadResult =
  | { ok: true; fileName: string; name: string; text: string; scripts: DialogScripts }
  | { ok: false; fileName: string; error: string };

// The dialog file name an uploaded file stands for: its base name without
// .txt ('demo' for 'demo.txt' or 'C:\\dialog\\Demo.TXT'), or null when it
// isn't a .txt file.
export function dialogNameOf(fileName: string): string | null {
  const base = fileName.split(/[\\/]/).pop() ?? '';
  const match = base.match(/^(.+)\.txt$/i);
  return match ? match[1].toLowerCase() : null;
}

// Checks an uploaded file: a .txt named after one of `knownNames` (the
// level dialog files) whose text parses. Parse errors carry the file name
// and line number.
export function checkDialogUpload(
  fileName: string,
  text: string,
  characters: Characters,
  knownNames: readonly string[],
): DialogUploadResult {
  const name = dialogNameOf(fileName);
  if (!name) return { ok: false, fileName, error: `${fileName} isn't a .txt dialog file` };
  if (!knownNames.includes(name)) {
    const expected = knownNames.map((known) => `${known}.txt`).join(', ');
    return {
      ok: false,
      fileName,
      error: `No level uses a dialog file named ${name}.txt (expected one of ${expected})`,
    };
  }
  try {
    return { ok: true, fileName, name, text, scripts: parseDialogScript(text, characters, `${name}.txt`) };
  } catch (error) {
    return { ok: false, fileName, error: (error as Error).message };
  }
}

// The dialog files the game plays: the built-in ones, with each uploaded
// text that still parses in place of the built-in file of the same name.
// Uploads for names the game doesn't have, or that no longer parse (say,
// after a character was removed), are left out and reported in `errors`
// by name, so the built-in file plays instead.
export function applyCustomDialogs(
  builtIn: DialogFiles,
  custom: DialogTexts,
  characters: Characters,
): { files: DialogFiles; errors: Readonly<Record<string, string>> } {
  const files: Record<string, DialogScripts> = { ...builtIn };
  const errors: Record<string, string> = {};
  for (const [name, text] of Object.entries(custom)) {
    const result = checkDialogUpload(`${name}.txt`, text, characters, Object.keys(builtIn));
    if (result.ok) files[name] = result.scripts;
    else errors[name] = result.error;
  }
  return { files: Object.freeze(files), errors: Object.freeze(errors) };
}

// Orders triggers the way they play: opening, then turns in order, then
// victory and defeat.
export function compareTriggers(a: string, b: string): number {
  return triggerRank(a) - triggerRank(b) || a.localeCompare(b);
}

function triggerRank(trigger: string): number {
  if (trigger === 'opening') return 0;
  const turn = trigger.match(/^turn (\d+)$/);
  if (turn) return Number(turn[1]);
  if (trigger === 'victory') return Number.MAX_SAFE_INTEGER - 1;
  return Number.MAX_SAFE_INTEGER;
}
