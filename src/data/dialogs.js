// Loads every dialog file in ./dialog/ at build time, so a new file is
// picked up without being listed anywhere. Each is parsed against the
// character roster in characters.json (see src/game/dialogScript.js); a
// mistake in any file throws on load with its file and line number.

import { parseCharacters, parseDialogScript } from '../game/dialogScript.js';
import characterData from './characters.json';

export const CHARACTERS = parseCharacters(characterData);

const files = import.meta.glob('./dialog/*.txt', { query: '?raw', import: 'default', eager: true });

// Dialog file name (without .txt) -> { trigger: lines }, e.g.
// DIALOGS.demo.opening.
export const DIALOGS = Object.freeze(
  Object.fromEntries(
    Object.entries(files).map(([path, text]) => {
      const name = path.replace(/^.*\//, '').replace(/\.txt$/, '');
      return [name, parseDialogScript(text, CHARACTERS, `src/data/dialog/${name}.txt`)];
    }),
  ),
);
