import { useRef, useState } from 'react';
import { cleanName, MAX_NAME_LENGTH } from '../game/warband/names.ts';

// A 10x10 pixel icon, drawn from rows where '#' is a filled pixel.
function PixelIcon({ rows }: { rows: readonly string[] }) {
  const path = rows
    .flatMap((row, y) => [...row].map((pixel, x) => (pixel === '#' ? `M${x} ${y}h1v1h-1z` : '')))
    .join('');
  return (
    <svg className="name-field__icon" viewBox="0 0 10 10" shapeRendering="crispEdges" aria-hidden="true">
      <path fill="currentColor" d={path} />
    </svg>
  );
}

// A die showing five: a new name.
const DIE = [
  '.########.',
  '#........#',
  '#.##..##.#',
  '#.##..##.#',
  '#...##...#',
  '#...##...#',
  '#.##..##.#',
  '#.##..##.#',
  '#........#',
  '.########.',
];

// A pencil, point down-left: rename.
const PENCIL = [
  '.......##.',
  '......####',
  '.....#.###',
  '....#.#.#.',
  '...#.#.#..',
  '..#.#.#...',
  '.##..#....',
  '.###.#....',
  '####......',
  '##........',
];

// The name the New Run unit will go by, with a button to roll a new one
// and one to type your own. While editing, Enter or leaving the box keeps
// what was typed (cleaned up by cleanName; a blank box keeps the old name)
// and Esc puts the old name back.
export function NameField({
  name,
  editing,
  onReroll,
  onEdit,
  onRename,
  onCancel,
}: {
  name: string;
  editing: boolean;
  onReroll: () => void;
  onEdit: () => void;
  onRename: (name: string) => void;
  onCancel: () => void;
}) {
  return (
    <div className="name-field">
      <span className="name-field__label" id="name-field-label">
        Name
      </span>
      {editing ? (
        <NameInput name={name} onRename={onRename} onCancel={onCancel} />
      ) : (
        <span className="name-field__name" aria-live="polite">
          {name}
        </span>
      )}
      <button
        type="button"
        className="name-field__button"
        title="New name (R)"
        aria-label="New name"
        disabled={editing}
        onMouseDown={keepFocus}
        onClick={onReroll}
      >
        <PixelIcon rows={DIE} />
      </button>
      <button
        type="button"
        className="name-field__button"
        title="Rename (E)"
        aria-label="Rename"
        disabled={editing}
        onMouseDown={keepFocus}
        onClick={onEdit}
      >
        <PixelIcon rows={PENCIL} />
      </button>
    </div>
  );
}

// The icon buttons don't take focus on click, so Enter keeps confirming the
// menu rather than pressing them again.
function keepFocus(event: { preventDefault: () => void }) {
  event.preventDefault();
}

// The box `name` is typed into, starting from `name` with it all selected.
function NameInput({
  name,
  onRename,
  onCancel,
}: {
  name: string;
  onRename: (name: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(name);
  // Set once the edit is kept or cancelled, so the blur as the box goes
  // away doesn't keep it a second time.
  const done = useRef(false);
  function finish(keep: boolean) {
    if (done.current) return;
    done.current = true;
    if (keep) onRename(cleanName(draft) ?? name);
    else onCancel();
  }
  return (
    <input
      className="draft-input name-field__input"
      aria-labelledby="name-field-label"
      value={draft}
      maxLength={MAX_NAME_LENGTH}
      autoFocus
      spellCheck={false}
      autoComplete="off"
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(event) => {
        // Typing here isn't menu input: Enter mustn't also start the run.
        event.stopPropagation();
        if (event.key === 'Enter') {
          event.preventDefault();
          finish(true);
        } else if (event.key === 'Escape') {
          event.preventDefault();
          finish(false);
        }
      }}
    />
  );
}
