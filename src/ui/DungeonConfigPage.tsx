import { useEffect, useMemo, useRef, useState } from 'react';
import { customDungeonStore, readDungeonUpload } from '../data/customDungeon.ts';
import { DUNGEON_SETTINGS, DUNGEON_TEXT } from '../data/dungeon.ts';
import { CAN_SAVE_TO_PROJECT, saveConfigToProject } from '../data/projectSave.ts';
import { DUNGEON_LIMITS, formatDungeonSettings, parseDungeonSettings } from '../game/dungeonConfigFile.ts';
import { getConfigFloors, type DungeonSettings } from '../game/dungeonConfigs.ts';
import { randomSeed } from '../game/dungeonLevel.ts';
import { BUILDING_PALETTES } from '../game/tileset.ts';
import { ConfigLayout } from './ConfigLayout.tsx';
import { plural } from './configCatalog.ts';
import { NumberField, type DraftForm } from './DraftFields.tsx';
import {
  checkDraft,
  draftFromSettings,
  draftText,
  getIn,
  insertAt,
  moveItem,
  NEW_FLOOR,
  removeAt,
  readableError,
  setIn,
  type Json,
} from './dungeonDraft.ts';
import { DungeonFloorEditor } from './DungeonFloorEditor.tsx';
import { FIELD_HELP } from './dungeonFieldHelp.tsx';
import { routeHash } from './route.ts';
import { downloadText, STORAGE_UNAVAILABLE, UploadDrop, type UploadNotice } from './UploadDrop.tsx';

const FILE_NAME = 'dungeon.json';
const PROJECT_FILE = 'src/data/dungeon.json';
const CONFIG_ID = 'dungeon-floors';

// A save to the project rewrites dungeon.json, which makes the dev server
// reload the page; this carries the "saved" message across the reload.
const SAVED_FLASH_KEY = 'rogue-emblem:dungeon-saved';

type SaveStatus = { kind: 'saving' } | { kind: 'saved' | 'error'; message: string } | null;

function readFlash(): string | null {
  try {
    const message = sessionStorage.getItem(SAVED_FLASH_KEY);
    sessionStorage.removeItem(SAVED_FLASH_KEY);
    return message;
  } catch {
    return null;
  }
}

function writeFlash(message: string | null) {
  try {
    if (message === null) sessionStorage.removeItem(SAVED_FLASH_KEY);
    else sessionStorage.setItem(SAVED_FLASH_KEY, message);
  } catch {
    // Without session storage the message is just lost on the reload.
  }
}

// A file's JSON for naming floors in its error, or null if it isn't JSON.
function readJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function floorLabel(first: number, last: number | null): string {
  if (last === null) return `Floor ${first}+`;
  return first === last ? `Floor ${first}` : `Floors ${first}–${last}`;
}

// #/configs/dungeon-floors: Dungeon Mode's floor configs as a form. Edits
// go to a draft that's checked as it changes (field by field and
// test-generated, as uploads are) and saved on demand: on the dev server
// into src/data/dungeon.json (the built-in floors; see vite/saveConfigs.ts),
// elsewhere into this browser's storage (src/data/customDungeon.ts). A JSON
// file can also be uploaded in place of the floors, or downloaded. Each
// floor shows a map generated from it, re-rolled on demand.
export function DungeonConfigPage() {
  const [stored, setStored] = useState(() => customDungeonStore.load());
  const [base, setBase] = useState<DungeonSettings>(() => readDungeonUpload(stored).settings);
  const [draft, setDraft] = useState<Json>(() => draftFromSettings(base));
  const [notices, setNotices] = useState<readonly UploadNotice[]>([]);
  const [status, setStatus] = useState<SaveStatus>(() => {
    const flash = readFlash();
    return flash ? { kind: 'saved', message: flash } : null;
  });
  const [seed, setSeed] = useState(1);

  const { error: storedError } = useMemo(() => readDungeonUpload(stored), [stored]);
  const uploaded = stored !== null && storedError === null;

  const check = useMemo(() => checkDraft(draft), [draft]);
  const message = useMemo(() => check.error && readableError(check.error, draft), [check.error, draft]);
  // The previews keep showing the last draft that parsed while there's an error.
  const lastValid = useRef(base);
  if (check.settings) lastValid.current = check.settings;
  const shown = check.settings ?? lastValid.current;

  const baseDraft = useMemo(() => draftFromSettings(base), [base]);
  const dirty = useMemo(() => draftText(draft) !== draftText(baseDraft), [draft, baseDraft]);

  // Ask before leaving with unsaved edits, except for the reload a save causes.
  const leaving = useRef({ dirty, saving: false });
  leaving.current.dirty = dirty;
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (leaving.current.dirty && !leaving.current.saving) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const form: DraftForm = {
    draft,
    error: check.error,
    message,
    help: FIELD_HELP,
    edit: (path, value) => setDraft((current) => setIn(current, path, value)),
    update: (change) => setDraft(change),
  };

  function startFrom(settings: DungeonSettings) {
    setBase(settings);
    setDraft(draftFromSettings(settings));
  }

  const confirmDiscard = () => !dirty || window.confirm('Discard your unsaved changes?');

  async function upload([file]: File[]) {
    if (!confirmDiscard()) return;
    const text = await file.text();
    let notice: UploadNotice;
    try {
      const parsed = parseDungeonSettings(text);
      if (customDungeonStore.save(text)) {
        notice = {
          fileName: file.name,
          ok: true,
          message: `Replaces the dungeon floors (${plural(parsed.floors.length, 'floor config')})`,
        };
        startFrom(parsed);
      } else notice = { fileName: file.name, ok: false, message: STORAGE_UNAVAILABLE };
    } catch (parseError) {
      notice = {
        fileName: file.name,
        ok: false,
        message: readableError((parseError as Error).message, readJson(text)),
      };
    }
    setNotices([notice]);
    setStatus(null);
    setStored(customDungeonStore.load());
  }

  function reset() {
    if (!window.confirm('Remove your uploaded dungeon floors and go back to the built-in ones?')) return;
    customDungeonStore.clear();
    setStored(customDungeonStore.load());
    setNotices([]);
    setStatus(null);
    startFrom(DUNGEON_SETTINGS);
  }

  function discard() {
    if (!window.confirm('Discard your unsaved changes?')) return;
    setDraft(draftFromSettings(base));
    setStatus(null);
  }

  async function save() {
    const { settings } = check;
    if (!settings) return;
    const text = formatDungeonSettings(settings);
    if (!CAN_SAVE_TO_PROJECT) {
      if (!customDungeonStore.save(text)) {
        setStatus({ kind: 'error', message: STORAGE_UNAVAILABLE });
        return;
      }
      setStored(customDungeonStore.load());
      startFrom(settings);
      setStatus({
        kind: 'saved',
        message: 'Saved in this browser; the next dungeon run uses it. Download the file to keep a copy.',
      });
      return;
    }
    // The browser's upload would hide the saved file from the game, so it goes.
    const message = `Saved to ${PROJECT_FILE}.${stored !== null ? ' Your browser upload was removed, so the game plays the saved floors.' : ''}`;
    setStatus({ kind: 'saving' });
    leaving.current.saving = true;
    writeFlash(message);
    const error = await saveConfigToProject(CONFIG_ID, text);
    leaving.current.saving = false;
    if (error) {
      writeFlash(null);
      setStatus({ kind: 'error', message: error });
      return;
    }
    customDungeonStore.clear();
    setStored(customDungeonStore.load());
    startFrom(settings);
    setStatus({ kind: 'saved', message });
  }

  const floors = getIn(draft, ['floors']);
  const floorCount = Array.isArray(floors) ? floors.length : 0;
  const floorsPerConfig = getIn(draft, ['floorsPerConfig']);
  const perConfig =
    typeof floorsPerConfig === 'number' && Number.isInteger(floorsPerConfig) && floorsPerConfig >= 1
      ? floorsPerConfig
      : 1;
  const [, maxFloors] = DUNGEON_LIMITS.floors;
  const floorSaved = (i: number) =>
    JSON.stringify(getIn(draft, ['floors', i])) === JSON.stringify(getIn(baseDraft, ['floors', i]));

  return (
    <ConfigLayout
      title="Dungeon Floors"
      lede={`Edit Dungeon Mode's floors: map size, terrain, enemies, trees and colors. Save writes ${CAN_SAVE_TO_PROJECT ? PROJECT_FILE : 'them to this browser'}, and changes apply to the next dungeon run.`}
      back={{ href: routeHash({ page: 'configs' }), label: 'All Configs' }}
    >
      <section className="configs-group" aria-labelledby="dungeon-settings-title">
        <h2 id="dungeon-settings-title" className="configs-group__title">
          Floors
        </h2>
        <div className="config-card dungeon-summary">
          <div className="config-card__head">
            <h3 className="config-card__title">{FILE_NAME}</h3>
            <span className={uploaded ? 'config-card__badge config-card__badge--ready' : 'config-card__badge'}>
              {uploaded ? 'Uploaded' : 'Built-in'}
            </span>
          </div>
          {storedError && (
            <p className="upload-notice upload-notice--error">
              Your upload no longer loads, so the built-in floors are used: {storedError}
            </p>
          )}
          <p className="config-card__description">
            {plural(floorCount, 'floor config')}, each used for {plural(perConfig, 'floor')} in a row; the last one
            repeats from then on.
          </p>
          <div className="dungeon-summary__fields">
            <NumberField form={form} path={['floorsPerConfig']} label="Floors per config" />
          </div>
          <div className="dialog-files__actions">
            <button
              type="button"
              className="header-button"
              onClick={() => downloadText(FILE_NAME, stored ?? DUNGEON_TEXT, 'application/json')}
              title="Downloads the saved floors, not unsaved edits"
            >
              Download
            </button>
            {stored !== null && (
              <button type="button" className="header-button" onClick={reset}>
                Reset to Built-in
              </button>
            )}
            <button type="button" className="header-button" onClick={() => setSeed(randomSeed())}>
              New Preview Maps
            </button>
          </div>
        </div>

        <ul className="dungeon-floors">
          {Array.from({ length: floorCount }, (_, i) => {
            const { first, last } = getConfigFloors(i, floorCount, perConfig);
            return (
              <DungeonFloorEditor
                key={i}
                form={form}
                index={i}
                label={floorLabel(first, last)}
                floor={shown.floors[i] ?? null}
                seed={seed}
                saved={!dirty || floorSaved(i)}
                actions={{
                  moveUp: i > 0 ? () => setDraft((d) => moveItem(d, ['floors'], i, i - 1)) : undefined,
                  moveDown: i < floorCount - 1 ? () => setDraft((d) => moveItem(d, ['floors'], i, i + 1)) : undefined,
                  duplicate: () =>
                    setDraft((d) => insertAt(d, ['floors'], getIn(d, ['floors', i]) ?? NEW_FLOOR, i + 1)),
                  remove:
                    floorCount > 1
                      ? () => {
                          if (window.confirm(`Remove this floor config?`)) setDraft((d) => removeAt(d, ['floors'], i));
                        }
                      : undefined,
                }}
              />
            );
          })}
        </ul>
        <button
          type="button"
          className="header-button"
          disabled={floorCount >= maxFloors}
          onClick={() => setDraft((d) => insertAt(d, ['floors'], NEW_FLOOR))}
        >
          Add Floor
        </button>
      </section>

      <section className="configs-group" aria-labelledby="dungeon-upload-title">
        <h2 id="dungeon-upload-title" className="configs-group__title">
          Upload a File
        </h2>
        <UploadDrop
          accept=".json,application/json"
          title="Drop a dungeon settings file here, or click to choose"
          hint="A .json file in the format below replaces the floors in this browser."
          notices={notices}
          onFiles={(files) => void upload(files)}
        />
        <DungeonFormat />
      </section>

      {(dirty || status) && (
        <div className="save-bar" role="region" aria-label="Save changes">
          <p className="save-bar__status" aria-live="polite">
            {status?.kind === 'saving'
              ? 'Saving…'
              : status && !dirty
                ? status.message
                : check.error
                  ? `Fix before saving: ${message}`
                  : status?.kind === 'error'
                    ? `Couldn't save: ${status.message}`
                    : 'Unsaved changes'}
          </p>
          {dirty && (
            <div className="dialog-files__actions">
              <button type="button" className="header-button" onClick={discard} disabled={status?.kind === 'saving'}>
                Discard
              </button>
              <button
                type="button"
                className="header-button save-bar__save"
                onClick={() => void save()}
                disabled={check.error !== null || status?.kind === 'saving'}
              >
                {CAN_SAVE_TO_PROJECT ? `Save to ${FILE_NAME}` : 'Save in Browser'}
              </button>
            </div>
          )}
          {!dirty && status && (
            <button type="button" className="header-button" onClick={() => setStatus(null)}>
              Dismiss
            </button>
          )}
        </div>
      )}
    </ConfigLayout>
  );
}

function DungeonFormat() {
  const [minSize, maxSize] = DUNGEON_LIMITS.mapSize;
  return (
    <details className="dialog-format">
      <summary>File format</summary>
      <pre>{`{
  "floorsPerConfig": 1,
  "floors": [
    {
      "name": "Meadowlands",
      "description": "Open fields and a farming village.",
      "terrain": {
        "width": 14, "height": 12,
        "lakes": 1, "lakeSize": [4, 8],
        "mountains": 1, "forests": 3, "meadows": 4,
        "ruins": 0, "buildings": 3,
        "castle": true, "turnChance": 0.35
      },
      "enemies": [
        { "count": 2, "region": { "y": [0, 0.34] } },
        { "count": 1, "minDistance": 4, "maxDistance": 6 }
      ],
      "treeChance": 0.05,
      "palette": "a-stone"
    }
  ]
}`}</pre>
      <ul>
        <li>
          <code>floorsPerConfig</code>: how many floors in a row use each config; the last config repeats forever.
        </li>
        <li>
          <code>terrain.width</code> / <code>height</code>: {minSize} to {maxSize} tiles. Every other terrain setting is
          optional: patch counts (<code>lakes</code>, <code>mountains</code>, <code>forests</code>, <code>meadows</code>
          , <code>ruins</code>, <code>buildings</code>), patch sizes as <code>[min, max]</code> tiles (
          <code>lakeSize</code>, <code>mountainSize</code>, <code>forestSize</code>, <code>meadowSize</code>),{' '}
          <code>castle</code> (true/false), and <code>turnChance</code> (0–1, how much the path winds).
        </li>
        <li>
          <code>enemies</code>: {DUNGEON_LIMITS.enemyGroups[0]} to {DUNGEON_LIMITS.enemyGroups[1]} groups, up to{' '}
          {DUNGEON_LIMITS.enemyCount[1]} enemies in all, placed in order. Each has a <code>count</code> and optional
          limits on where they stand: <code>region</code>, a box as <code>[from, to]</code> fractions of the map&apos;s
          columns (<code>x</code>) and rows (<code>y</code>), 0 being the west or north edge; and{' '}
          <code>minDistance</code> / <code>maxDistance</code>, how many steps a unit walks from the deployment zone to
          reach them ({DUNGEON_LIMITS.enemyDistance[0]} to {DUNGEON_LIMITS.enemyDistance[1]}). A file whose limits leave
          too little room for its enemies is turned away.
        </li>
        <li>
          <code>treeChance</code>: 0–1.
        </li>
        <li>
          <code>palette</code>: one of {Object.keys(BUILDING_PALETTES).join(', ')}.
        </li>
        <li>
          <code>description</code>: optional notes on the floor, shown on its card.
        </li>
      </ul>
    </details>
  );
}
