// Loads every dialog file in ./dialog/ at build time, so a new file is
// picked up without being listed anywhere. Each is parsed against the
// character roster in characters.json (see src/game/dialogScript.ts); a
// mistake in any file throws on load with its file and line number.

import { parseCharacters, parseDialogScript, type DialogFiles } from '../game/dialogScript.ts';
import characterData from './characters.json';

export const CHARACTERS = parseCharacters(characterData);

const files = import.meta.glob<string>('./dialog/*.txt', { query: '?raw', import: 'default', eager: true });

// Dialog file name (without .txt) -> the file's text as written, which the
// config editor offers as a download.
export const DIALOG_TEXTS: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    Object.entries(files).map(([path, text]) => [path.replace(/^.*\//, '').replace(/\.txt$/, ''), text]),
  ),
);

// Dialog file name (without .txt) -> { trigger: lines }, e.g.
// DIALOGS.demo.opening.
export const DIALOGS: DialogFiles = Object.freeze(
  Object.fromEntries(
    Object.entries(DIALOG_TEXTS).map(([name, text]) => [
      name,
      parseDialogScript(text, CHARACTERS, `src/data/dialog/${name}.txt`),
    ]),
  ),
);
