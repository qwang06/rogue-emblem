// Parses dialog written as plain text into the scripts src/game/dialog.js
// plays. A dialog file holds a level's conversations, each under a header
// naming when it plays, with one spoken line per row:
//
//   # comments and blank lines are ignored
//   [opening]
//   alden: Enemy soldiers have taken the old gate.
//   enemy_soldier: Hold the line!
//   bryn (right): Speakers can stand on the other side for a line.
//
// Speakers are ids from the character roster (see parseCharacters), which
// gives each one a display name, a team, a unit class, and a portrait; a
// line sits on the team's default side unless it says otherwise. Mistakes
// throw with the file and line number, so a typo points straight at itself.

import { DIALOG_SIDES } from './dialog.js';

// Which side of the dialog box each team's speakers stand on by default.
export const DEFAULT_SIDES = Object.freeze({ player: 'left', enemy: 'right' });

// When a conversation can play: at the start of a level, before its
// victory or defeat screen, or at the start of a turn ('turn 3').
const TRIGGER_PATTERN = /^(opening|victory|defeat|turn [1-9]\d*)$/;

const ID_PATTERN = /^[a-z0-9_]+$/;
const HEADER_PATTERN = /^\[(.*)\]$/;
// speaker_id, an optional (side), a colon, then the text.
const LINE_PATTERN = /^([a-z0-9_]+)\s*(?:\(\s*(\w+)\s*\))?\s*:\s*(.*)$/;

export function isDialogTrigger(name) {
  return TRIGGER_PATTERN.test(name);
}

// The trigger for the conversation at the start of turn `turn` ('turn 3').
export function turnTrigger(turn) {
  return `turn ${turn}`;
}

// The conversation a level's dialogs (from parseDialogScript) have for
// `trigger`, or null when there's none. `dialogs` may be missing.
export function getTriggeredDialog(dialogs, trigger) {
  const lines = dialogs?.[trigger];
  return lines?.length ? lines : null;
}

// Checks a character roster — { id: { name, team, unitClass?, portrait? } },
// as in characters.json — and returns it frozen, with `unitClass` (the
// class whose unit art stands in for a missing portrait) and `portrait` (a
// sprite key) always present, null when there is none. Throws on a
// malformed id, a missing name, or an unknown team.
export function parseCharacters(json) {
  if (!json || typeof json !== 'object') throw new Error('Characters must be an object of id -> character');
  const characters = {};
  for (const [id, character] of Object.entries(json)) {
    if (!ID_PATTERN.test(id)) throw new Error(`Character id "${id}" must be lowercase letters, digits, or _`);
    const { name, team, unitClass = null, portrait = null } = character ?? {};
    if (!name) throw new Error(`Character "${id}" has no name`);
    if (!(team in DEFAULT_SIDES)) throw new Error(`Character "${id}" has unknown team "${team}"`);
    characters[id] = Object.freeze({ name, team, unitClass, portrait });
  }
  return Object.freeze(characters);
}

// Parses a dialog file into { trigger: lines }, frozen, where each line is
// { speaker, team, unitClass, side, portrait, text } ready for createDialog.
// `characters` comes from parseCharacters; `source` names the file in
// error messages.
export function parseDialogScript(text, characters, source = 'dialog') {
  const scripts = {};
  let current = null;

  const fail = (lineNumber, message) => {
    throw new Error(`${source}:${lineNumber}: ${message}`);
  };

  text.split(/\r?\n/).forEach((raw, i) => {
    const lineNumber = i + 1;
    const row = raw.trim();
    if (row === '' || row.startsWith('#')) return;

    const header = row.match(HEADER_PATTERN);
    if (header) {
      const trigger = header[1].trim().toLowerCase().replace(/\s+/g, ' ');
      if (!isDialogTrigger(trigger)) {
        fail(lineNumber, `unknown section [${header[1]}] (expected opening, victory, defeat, or turn N)`);
      }
      if (trigger in scripts) fail(lineNumber, `section [${trigger}] appears twice`);
      current = scripts[trigger] = [];
      return;
    }

    const line = row.match(LINE_PATTERN);
    if (!line) fail(lineNumber, 'expected "speaker: text" or a [section] header');
    if (!current) fail(lineNumber, 'line comes before any [section] header');

    const [, speakerId, sideOverride, spoken] = line;
    const character = characters[speakerId];
    if (!character) fail(lineNumber, `unknown speaker "${speakerId}"`);
    if (sideOverride && !DIALOG_SIDES.includes(sideOverride)) {
      fail(lineNumber, `unknown side "${sideOverride}" (expected left or right)`);
    }
    if (!spoken) fail(lineNumber, `"${speakerId}" has nothing to say`);

    current.push(
      Object.freeze({
        speaker: character.name,
        team: character.team,
        unitClass: character.unitClass,
        side: sideOverride ?? DEFAULT_SIDES[character.team],
        portrait: character.portrait,
        text: spoken,
      }),
    );
  });

  for (const [trigger, lines] of Object.entries(scripts)) {
    if (lines.length === 0) throw new Error(`${source}: section [${trigger}] has no lines`);
    scripts[trigger] = Object.freeze(lines);
  }
  return Object.freeze(scripts);
}
