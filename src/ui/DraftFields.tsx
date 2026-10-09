// Form controls bound to one setting in a JSON draft (see regionsDraft.ts):
// each reads its value at `path`, writes edits back through `form.edit`,
// and is marked invalid when the draft's error names its path.

import { useEffect, useId, useState, type ReactNode } from 'react';
import {
  errorReason,
  getIn,
  isErrorAt,
  readNumberText,
  type DraftPath,
  type DraftValue,
  type Json,
} from './regionsDraft.ts';
import { InfoPopover } from './InfoPopover.tsx';

export interface DraftForm {
  draft: Json;
  // The parser's error, path first, which fields match themselves against.
  error: string | null;
  // The same error with its path in the form's words (see readableError).
  message: string | null;
  edit: (path: DraftPath, value: DraftValue) => void;
  // Explanations by setting name (a path's last key), shown in an info
  // popover beside each field that has one.
  help?: Readonly<Record<string, { title: string; body: ReactNode }>>;
  // For edits beyond one field, e.g. adding to a list.
  update: (change: (draft: Json) => Json) => void;
}

interface FieldProps {
  form: DraftForm;
  path: DraftPath;
  label: string;
  hint?: string;
}

function display(value: DraftValue): string {
  return value === undefined || value === null ? '' : String(value);
}

// A labeled control. When the draft's error names it, the control is
// marked and the error shows beneath, worded with the field's own label.
// A setting with help gets an info button beside its label.
function Field({
  form,
  path,
  label,
  hint,
  invalid,
  children,
}: {
  form: DraftForm;
  path: DraftPath;
  label: string;
  hint?: string;
  invalid: boolean;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  const key = path[path.length - 1];
  const help = typeof key === 'string' ? form.help?.[key] : undefined;
  return (
    <div className={invalid ? 'draft-field draft-field--invalid' : 'draft-field'}>
      <div className="draft-field__head">
        <label className="draft-field__label" htmlFor={id}>
          {label}
        </label>
        {help && <InfoPopover title={help.title}>{help.body}</InfoPopover>}
      </div>
      {children(id)}
      {invalid && form.error && (
        <span className="draft-field__error" role="alert">
          {label} {errorReason(form.error)}
        </span>
      )}
      {hint && <span className="draft-field__hint">{hint}</span>}
    </div>
  );
}

// A number box. It keeps what's typed (e.g. "0." on the way to "0.5")
// and writes the number it reads as: blank clears the setting, and text
// that isn't a number goes to the draft as is, for the parser to flag.
function NumberInput({
  id,
  value,
  onChange,
  placeholder,
  invalid,
  label,
}: {
  id?: string;
  value: DraftValue;
  onChange: (value: DraftValue) => void;
  placeholder?: string;
  invalid: boolean;
  label?: string;
}) {
  const [text, setText] = useState(display(value));
  // Follow the draft when it changes from elsewhere (discard, upload).
  useEffect(() => {
    setText((current) => (readNumberText(current) === (value ?? undefined) ? current : display(value)));
  }, [value]);
  return (
    <input
      id={id}
      className="draft-input draft-input--number"
      type="text"
      inputMode="decimal"
      value={text}
      placeholder={placeholder}
      aria-invalid={invalid}
      aria-label={label}
      onChange={(event) => {
        setText(event.target.value);
        onChange(readNumberText(event.target.value));
      }}
    />
  );
}

export function NumberField({ form, path, label, hint, placeholder }: FieldProps & { placeholder?: string }) {
  const invalid = isErrorAt(form.error, path);
  return (
    <Field form={form} path={path} label={label} hint={hint} invalid={invalid}>
      {(id) => (
        <NumberInput
          id={id}
          value={getIn(form.draft, path)}
          onChange={(value) => form.edit(path, value)}
          placeholder={placeholder}
          invalid={invalid}
        />
      )}
    </Field>
  );
}

// Two numbers stored as a [first, second] pair, e.g. a patch's [min, max]
// size or a region's [from, to]. Both blank clears the setting.
export function PairField({
  form,
  path,
  label,
  hint,
  placeholders = ['', ''],
  names = ['min', 'max'],
}: FieldProps & { placeholders?: readonly [string, string]; names?: readonly [string, string] }) {
  const value = getIn(form.draft, path);
  const pair = Array.isArray(value) ? value : [];
  const invalid = [0, 1].map((i) => isErrorAt(form.error, [...path, i]));
  const pairInvalid = isErrorAt(form.error, path);
  function change(index: number, next: DraftValue) {
    const items: DraftValue[] = [pair[0] ?? undefined, pair[1] ?? undefined];
    items[index] = next ?? undefined;
    form.edit(path, items.every((item) => item === undefined) ? undefined : items.map((item) => item ?? null));
  }
  return (
    <Field form={form} path={path} label={label} hint={hint} invalid={pairInvalid || invalid.some(Boolean)}>
      {(id) => (
        <span className="draft-pair">
          <NumberInput
            id={id}
            value={pair[0] ?? undefined}
            onChange={(next) => change(0, next)}
            placeholder={placeholders[0]}
            invalid={pairInvalid || invalid[0]}
            label={`${label} ${names[0]}`}
          />
          <span aria-hidden="true">–</span>
          <NumberInput
            value={pair[1] ?? undefined}
            onChange={(next) => change(1, next)}
            placeholder={placeholders[1]}
            invalid={pairInvalid || invalid[1]}
            label={`${label} ${names[1]}`}
          />
        </span>
      )}
    </Field>
  );
}

export function TextField({ form, path, label, hint, multiline = false }: FieldProps & { multiline?: boolean }) {
  const invalid = isErrorAt(form.error, path);
  const value = display(getIn(form.draft, path));
  // A blank optional setting is left out of the file.
  const change = (text: string) => form.edit(path, multiline && text === '' ? undefined : text);
  return (
    <Field form={form} path={path} label={label} hint={hint} invalid={invalid}>
      {(id) =>
        multiline ? (
          <textarea
            id={id}
            className="draft-input draft-input--text"
            rows={2}
            value={value}
            aria-invalid={invalid}
            onChange={(event) => change(event.target.value)}
          />
        ) : (
          <input
            id={id}
            className="draft-input draft-input--text"
            type="text"
            value={value}
            aria-invalid={invalid}
            onChange={(event) => change(event.target.value)}
          />
        )
      }
    </Field>
  );
}

export function SelectField({ form, path, label, options }: FieldProps & { options: readonly string[] }) {
  const invalid = isErrorAt(form.error, path);
  const value = display(getIn(form.draft, path));
  return (
    <Field form={form} path={path} label={label} invalid={invalid}>
      {(id) => (
        <select
          id={id}
          className="draft-input"
          value={value}
          aria-invalid={invalid}
          onChange={(event) => form.edit(path, event.target.value)}
        >
          {!options.includes(value) && <option value={value}>{value || '—'}</option>}
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

// A true/false setting that's `fallback` when unset.
export function CheckboxField({ form, path, label, fallback }: FieldProps & { fallback: boolean }) {
  const invalid = isErrorAt(form.error, path);
  const value = getIn(form.draft, path);
  return (
    <Field form={form} path={path} label={label} invalid={invalid}>
      {(id) => (
        <input
          id={id}
          className="draft-checkbox"
          type="checkbox"
          checked={typeof value === 'boolean' ? value : fallback}
          aria-invalid={invalid}
          onChange={(event) => form.edit(path, event.target.checked)}
        />
      )}
    </Field>
  );
}
