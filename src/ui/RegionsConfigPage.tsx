import { useEffect, useMemo, useRef, useState } from 'react';
import { customRegionsStore, readRegionsUpload } from '../data/customRegions.ts';
import { CAN_SAVE_TO_PROJECT, saveConfigToProject } from '../data/projectSave.ts';
import { REGION_SETTINGS, REGIONS_TEXT } from '../data/regions.ts';
import { randomSeed } from '../game/rng.ts';
import { BUILDING_PALETTES } from '../game/tileset.ts';
import { getRegionStages, type RegionSettings } from '../game/warband/regions.ts';
import { formatRegionSettings, parseRegionSettings, REGION_LIMITS } from '../game/warband/regionsFile.ts';
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
  NEW_REGION,
  removeAt,
  readableError,
  setIn,
  type Json,
} from './regionsDraft.ts';
import { RegionEditor } from './RegionEditor.tsx';
import { FIELD_HELP } from './regionFieldHelp.tsx';
import { routeHash } from './route.ts';
import { downloadText, STORAGE_UNAVAILABLE, UploadDrop, type UploadNotice } from './UploadDrop.tsx';

const FILE_NAME = 'regions.json';
const PROJECT_FILE = 'src/data/regions.json';
const CONFIG_ID = 'regions';

// A save to the project rewrites regions.json, which makes the dev server
// reload the page; this carries the "saved" message across the reload.
const SAVED_FLASH_KEY = 'rogue-emblem:regions-saved';

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

// A file's JSON for naming regions in its error, or null if it isn't JSON.
function readJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function stageLabel(first: number, last: number | null): string {
  if (last === null) return `Stage ${first}+`;
  return first === last ? `Stage ${first}` : `Stages ${first}–${last}`;
}

// #/configs/regions: Warband Mode's regions as a form. Edits
// go to a draft that's checked as it changes (field by field and
// test-generated, as uploads are) and saved on demand: on the dev server
// into src/data/regions.json (the built-in regions; see vite/saveConfigs.ts),
// elsewhere into this browser's storage (src/data/customRegions.ts). A JSON
// file can also be uploaded in place of the regions, or downloaded. Each
// region shows a map generated from it, re-rolled on demand.
export function RegionsConfigPage() {
  const [stored, setStored] = useState(() => customRegionsStore.load());
  const [base, setBase] = useState<RegionSettings>(() => readRegionsUpload(stored).settings);
  const [draft, setDraft] = useState<Json>(() => draftFromSettings(base));
  const [notices, setNotices] = useState<readonly UploadNotice[]>([]);
  const [status, setStatus] = useState<SaveStatus>(() => {
    const flash = readFlash();
    return flash ? { kind: 'saved', message: flash } : null;
  });
  const [seed, setSeed] = useState(1);

  const { error: storedError } = useMemo(() => readRegionsUpload(stored), [stored]);
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

  function startFrom(settings: RegionSettings) {
    setBase(settings);
    setDraft(draftFromSettings(settings));
  }

  const confirmDiscard = () => !dirty || window.confirm('Discard your unsaved changes?');

  async function upload([file]: File[]) {
    if (!confirmDiscard()) return;
    const text = await file.text();
    let notice: UploadNotice;
    try {
      const parsed = parseRegionSettings(text);
      if (customRegionsStore.save(text)) {
        notice = {
          fileName: file.name,
          ok: true,
          message: `Replaces the regions (${plural(parsed.regions.length, 'region')})`,
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
    setStored(customRegionsStore.load());
  }

  function reset() {
    if (!window.confirm('Remove your uploaded regions and go back to the built-in ones?')) return;
    customRegionsStore.clear();
    setStored(customRegionsStore.load());
    setNotices([]);
    setStatus(null);
    startFrom(REGION_SETTINGS);
  }

  function discard() {
    if (!window.confirm('Discard your unsaved changes?')) return;
    setDraft(draftFromSettings(base));
    setStatus(null);
  }

  async function save() {
    const { settings } = check;
    if (!settings) return;
    const text = formatRegionSettings(settings);
    if (!CAN_SAVE_TO_PROJECT) {
      if (!customRegionsStore.save(text)) {
        setStatus({ kind: 'error', message: STORAGE_UNAVAILABLE });
        return;
      }
      setStored(customRegionsStore.load());
      startFrom(settings);
      setStatus({
        kind: 'saved',
        message: 'Saved in this browser; the next Warband Mode run uses it. Download the file to keep a copy.',
      });
      return;
    }
    // The browser's upload would hide the saved file from the game, so it goes.
    const message = `Saved to ${PROJECT_FILE}.${stored !== null ? ' Your browser upload was removed, so the game plays the saved regions.' : ''}`;
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
    customRegionsStore.clear();
    setStored(customRegionsStore.load());
    startFrom(settings);
    setStatus({ kind: 'saved', message });
  }

  const regions = getIn(draft, ['regions']);
  const regionCount = Array.isArray(regions) ? regions.length : 0;
  const stagesPerRegion = getIn(draft, ['stagesPerRegion']);
  const perRegion =
    typeof stagesPerRegion === 'number' && Number.isInteger(stagesPerRegion) && stagesPerRegion >= 1
      ? stagesPerRegion
      : 1;
  const [, maxRegions] = REGION_LIMITS.regions;
  const regionSaved = (i: number) =>
    JSON.stringify(getIn(draft, ['regions', i])) === JSON.stringify(getIn(baseDraft, ['regions', i]));

  return (
    <ConfigLayout
      title="Regions"
      lede={`Edit Warband Mode's regions: map size, terrain, enemies, trees and colors. Save writes ${CAN_SAVE_TO_PROJECT ? PROJECT_FILE : 'them to this browser'}, and changes apply to the next run.`}
      back={{ href: routeHash({ page: 'configs' }), label: 'All Configs' }}
    >
      <section className="configs-group" aria-labelledby="regions-settings-title">
        <h2 id="regions-settings-title" className="configs-group__title">
          Regions
        </h2>
        <div className="config-card regions-summary">
          <div className="config-card__head">
            <h3 className="config-card__title">{FILE_NAME}</h3>
            <span className={uploaded ? 'config-card__badge config-card__badge--ready' : 'config-card__badge'}>
              {uploaded ? 'Uploaded' : 'Built-in'}
            </span>
          </div>
          {storedError && (
            <p className="upload-notice upload-notice--error">
              Your upload no longer loads, so the built-in regions are used: {storedError}
            </p>
          )}
          <p className="config-card__description">
            {plural(regionCount, 'region')}, each lasting {plural(perRegion, 'stage')} of a run; the last one repeats
            from then on.
          </p>
          <div className="regions-summary__fields">
            <NumberField form={form} path={['stagesPerRegion']} label="Stages per region" />
          </div>
          <div className="dialog-files__actions">
            <button
              type="button"
              className="header-button"
              onClick={() => downloadText(FILE_NAME, stored ?? REGIONS_TEXT, 'application/json')}
              title="Downloads the saved regions, not unsaved edits"
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

        <ul className="region-list">
          {Array.from({ length: regionCount }, (_, i) => {
            const { first, last } = getRegionStages(i, regionCount, perRegion);
            return (
              <RegionEditor
                key={i}
                form={form}
                index={i}
                label={stageLabel(first, last)}
                region={shown.regions[i] ?? null}
                seed={seed}
                saved={!dirty || regionSaved(i)}
                actions={{
                  moveUp: i > 0 ? () => setDraft((d) => moveItem(d, ['regions'], i, i - 1)) : undefined,
                  moveDown: i < regionCount - 1 ? () => setDraft((d) => moveItem(d, ['regions'], i, i + 1)) : undefined,
                  duplicate: () =>
                    setDraft((d) => insertAt(d, ['regions'], getIn(d, ['regions', i]) ?? NEW_REGION, i + 1)),
                  remove:
                    regionCount > 1
                      ? () => {
                          if (window.confirm(`Remove this region?`)) setDraft((d) => removeAt(d, ['regions'], i));
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
          disabled={regionCount >= maxRegions}
          onClick={() => setDraft((d) => insertAt(d, ['regions'], NEW_REGION))}
        >
          Add Region
        </button>
      </section>

      <section className="configs-group" aria-labelledby="regions-upload-title">
        <h2 id="regions-upload-title" className="configs-group__title">
          Upload a File
        </h2>
        <UploadDrop
          accept=".json,application/json"
          title="Drop a regions file here, or click to choose"
          hint="A .json file in the format below replaces the regions in this browser. Dungeon Mode files still load."
          notices={notices}
          onFiles={(files) => void upload(files)}
        />
        <RegionsFormat />
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

function RegionsFormat() {
  const [minSize, maxSize] = REGION_LIMITS.mapSize;
  return (
    <details className="dialog-format">
      <summary>File format</summary>
      <pre>{`{
  "stagesPerRegion": 1,
  "regions": [
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
        { "count": 2, "area": { "y": [0, 0.34] } },
        { "count": 1, "minDistance": 4, "maxDistance": 6 }
      ],
      "treeChance": 0.05,
      "palette": "a-stone"
    }
  ]
}`}</pre>
      <ul>
        <li>
          <code>stagesPerRegion</code>: how many stages of a run each region lasts; the last region repeats forever.
        </li>
        <li>
          <code>terrain.width</code> / <code>height</code>: {minSize} to {maxSize} tiles. Every other terrain setting is
          optional: patch counts (<code>lakes</code>, <code>mountains</code>, <code>forests</code>, <code>meadows</code>
          , <code>ruins</code>, <code>buildings</code>), patch sizes as <code>[min, max]</code> tiles (
          <code>lakeSize</code>, <code>mountainSize</code>, <code>forestSize</code>, <code>meadowSize</code>),{' '}
          <code>castle</code> (true/false), and <code>turnChance</code> (0–1, how much the path winds).
        </li>
        <li>
          <code>enemies</code>: {REGION_LIMITS.enemyGroups[0]} to {REGION_LIMITS.enemyGroups[1]} groups, up to{' '}
          {REGION_LIMITS.enemyCount[1]} enemies in all, placed in order. Each has a <code>count</code> and optional
          limits on where they stand: <code>area</code>, a box as <code>[from, to]</code> fractions of the map&apos;s
          columns (<code>x</code>) and rows (<code>y</code>), 0 being the west or north edge; and{' '}
          <code>minDistance</code> / <code>maxDistance</code>, how many steps a unit walks from the deployment zone to
          reach them ({REGION_LIMITS.enemyDistance[0]} to {REGION_LIMITS.enemyDistance[1]}). Optional{' '}
          <code>health</code> starts them wounded, and <code>levelUpOnKill</code> (true/false) makes killing one give
          the killer exactly a level up. A file whose limits leave too little room for its enemies is turned away.
        </li>
        <li>
          <code>treeChance</code>: 0–1.
        </li>
        <li>
          <code>palette</code>: one of {Object.keys(BUILDING_PALETTES).join(', ')}.
        </li>
        <li>
          <code>description</code>: optional notes on the region, shown on its card.
        </li>
      </ul>
    </details>
  );
}
