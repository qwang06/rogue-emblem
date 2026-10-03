// Pure state for conversations shown in the dialog box. A script is a list
// of lines, each { speaker, unitClass, side, text }: `speaker` is the name
// shown, `unitClass` picks the art standing in for a portrait (none if null), and `side` ('left' |
// 'right') is where the speaker's portrait sits. A dialog is a frozen
// { lines, index, revealed } — which line is showing, and whether its text
// has been fully typed out (by time passing, or by the player skipping).
// Showing the dialog and timing the typing belong to the caller.

export type DialogSide = 'left' | 'right';

export interface DialogLine {
  speaker: string;
  unitClass: string | null;
  side: DialogSide;
  text: string;
}

// A line as written in a script: everything but the text has a default.
export interface DialogLineInput {
  speaker?: string;
  unitClass?: string | null;
  side?: DialogSide;
  text: string;
}

export interface Dialog {
  lines: readonly DialogLine[];
  index: number;
  revealed: boolean;
}

// How fast a line's text types out, in characters per second.
export const DIALOG_CHARS_PER_SECOND = 45;

export const DIALOG_SIDES: readonly DialogSide[] = Object.freeze(['left', 'right']);

// A script frozen as written, line by line, for level data.
export function freezeScript(lines: readonly DialogLineInput[]): readonly DialogLineInput[] {
  return Object.freeze(lines.map((line) => Object.freeze({ ...line })));
}

// Starts a dialog on its first line. Throws on an empty script or a line
// without text or with an unknown side.
export function createDialog(lines: readonly DialogLineInput[]): Dialog {
  if (!lines || lines.length === 0) throw new Error('A dialog needs at least one line');
  const frozen = lines.map((line, i) => {
    if (!line.text) throw new Error(`Dialog line ${i} has no text`);
    const side = line.side ?? 'left';
    if (!DIALOG_SIDES.includes(side)) throw new Error(`Dialog line ${i} has unknown side "${side}"`);
    return Object.freeze({ speaker: line.speaker ?? '', unitClass: line.unitClass ?? null, side, text: line.text });
  });
  return Object.freeze({ lines: Object.freeze(frozen), index: 0, revealed: false });
}

export function getCurrentLine(dialog: Dialog): DialogLine {
  return dialog.lines[dialog.index];
}

export function isLastLine(dialog: Dialog): boolean {
  return dialog.index === dialog.lines.length - 1;
}

// How long `text` takes to type out fully.
export function getRevealDurationMs(text: string, charsPerSecond = DIALOG_CHARS_PER_SECOND): number {
  if (charsPerSecond <= 0) return 0;
  return Math.ceil((text.length * 1000) / charsPerSecond);
}

// How many characters of `text` show `elapsedMs` after its line started.
export function getRevealedLength(text: string, elapsedMs: number, charsPerSecond = DIALOG_CHARS_PER_SECOND): number {
  if (charsPerSecond <= 0) return text.length;
  const shown = Math.floor((Math.max(0, elapsedMs) * charsPerSecond) / 1000);
  return Math.min(text.length, shown);
}

// What confirm does, `elapsedMs` after the current line started: a line
// still typing out finishes at once; a fully shown line moves on to the
// next one; confirm on the last line ends the dialog (returns null).
export function advanceDialog(
  dialog: Dialog,
  elapsedMs: number,
  charsPerSecond = DIALOG_CHARS_PER_SECOND,
): Dialog | null {
  const { text } = getCurrentLine(dialog);
  const revealed = dialog.revealed || elapsedMs >= getRevealDurationMs(text, charsPerSecond);
  if (!revealed) return Object.freeze({ ...dialog, revealed: true });
  if (isLastLine(dialog)) return null;
  return Object.freeze({ ...dialog, index: dialog.index + 1, revealed: false });
}
