// One floor config on the Dungeon Floors page, as a form: its name and
// notes, a sample map, the map and terrain settings, and its enemy groups.
// Every field edits the page's draft (see dungeonDraft.ts); blank optional
// fields are left out of the file, so the generator's defaults (shown as
// placeholders) apply.

import { useMemo } from 'react';
import type { DungeonConfig } from '../game/dungeonConfigs.ts';
import { DUNGEON_LIMITS } from '../game/dungeonConfigFile.ts';
import { createDungeonLevel } from '../game/dungeonLevel.ts';
import { MAP_GEN_DEFAULTS } from '../game/mapGen.ts';
import { BUILDING_PALETTES } from '../game/tileset.ts';
import { CheckboxField, NumberField, PairField, SelectField, TextField, type DraftForm } from './DraftFields.tsx';
import {
  getIn,
  insertAt,
  isErrorAt,
  isErrorWithin,
  NEW_ENEMY_GROUP,
  removeAt,
  type DraftPath,
} from './dungeonDraft.ts';
import { describeEnemyGroup } from './enemyGroups.ts';
import { InfoPopover } from './InfoPopover.tsx';
import { getMapPreview } from './mapPreview.ts';
import { routeHash } from './route.ts';

// The terrain patches, each a count and a [min, max] size.
const PATCHES = [
  ['lakes', 'lakeSize', 'Lakes'],
  ['mountains', 'mountainSize', 'Mountain ranges'],
  ['forests', 'forestSize', 'Forests'],
  ['meadows', 'meadowSize', 'Meadows'],
] as const;

const PALETTES = Object.keys(BUILDING_PALETTES);
const [MIN_SIZE, MAX_SIZE] = DUNGEON_LIMITS.mapSize;

const defaultHint = (value: number | boolean) => `default ${value}`;

export interface FloorActions {
  moveUp?: () => void;
  moveDown?: () => void;
  duplicate: () => void;
  remove?: () => void;
}

export function DungeonFloorEditor({
  form,
  index,
  label,
  floor,
  seed,
  saved,
  actions,
}: {
  form: DraftForm;
  index: number;
  label: string;
  // The floor as last checked (null while the draft has never parsed), for
  // the sample map and group summaries; may lag the form while it has an error.
  floor: DungeonConfig | null;
  seed: number;
  // Whether the floor matches what's saved, so the full map preview (which
  // plays saved floors) shows it.
  saved: boolean;
  actions: FloorActions;
}) {
  const path: DraftPath = ['floors', index];
  const at = (...rest: (string | number)[]): DraftPath => [...path, ...rest];
  const name = getIn(form.draft, at('name'));
  const groups = getIn(form.draft, at('enemies'));
  const groupCount = Array.isArray(groups) ? groups.length : 0;
  const hasError = isErrorWithin(form.error, path);
  const previewHref = routeHash({ page: 'dungeon-preview', index, seed });
  const maxGroups = DUNGEON_LIMITS.enemyGroups[1];

  return (
    <li className={hasError ? 'config-card floor-editor floor-editor--invalid' : 'config-card floor-editor'}>
      <div className="config-card__head">
        <h3 className="config-card__title">{typeof name === 'string' && name.trim() ? name : 'Untitled floor'}</h3>
        <span className="config-card__badge">{label}</span>
      </div>
      <div className="floor-editor__actions" role="group" aria-label="Floor order">
        <button type="button" className="header-button" onClick={actions.moveUp} disabled={!actions.moveUp}>
          Move Up
        </button>
        <button type="button" className="header-button" onClick={actions.moveDown} disabled={!actions.moveDown}>
          Move Down
        </button>
        <button type="button" className="header-button" onClick={actions.duplicate}>
          Duplicate
        </button>
        <button type="button" className="header-button" onClick={actions.remove} disabled={!actions.remove}>
          Remove
        </button>
      </div>
      {hasError && isErrorAt(form.error, path) && <p className="upload-notice upload-notice--error">{form.message}</p>}

      <TextField form={form} path={at('name')} label="Name" />
      <TextField form={form} path={at('description')} label="Description" multiline />

      {floor && (
        <figure className="floor-editor__preview">
          {saved ? (
            // The link below is the accessible way in; the thumbnail is a shortcut.
            <a
              className="map-preview-link"
              href={previewHref}
              title="View the full map"
              tabIndex={-1}
              aria-hidden="true"
            >
              <MapPreview floor={floor} seed={seed} />
            </a>
          ) : (
            <MapPreview floor={floor} seed={seed} />
          )}
          <figcaption>
            {saved ? (
              <a className="header-button" href={previewHref}>
                View Full Map
              </a>
            ) : (
              <span className="draft-field__hint">
                {form.error ? 'Showing the last valid version. ' : ''}Save to open the full map.
              </span>
            )}
          </figcaption>
        </figure>
      )}

      <fieldset className="floor-editor__section">
        <legend>Map</legend>
        <div className="floor-editor__grid">
          <NumberField form={form} path={at('terrain', 'width')} label="Width" hint={`${MIN_SIZE}–${MAX_SIZE} tiles`} />
          <NumberField
            form={form}
            path={at('terrain', 'height')}
            label="Height"
            hint={`${MIN_SIZE}–${MAX_SIZE} tiles`}
          />
          <SelectField form={form} path={at('palette')} label="Palette" options={PALETTES} />
          <NumberField form={form} path={at('treeChance')} label="Tree chance" hint="0–1 per free grass tile" />
          <NumberField
            form={form}
            path={at('terrain', 'turnChance')}
            label="Path winding"
            hint="0–1"
            placeholder={String(MAP_GEN_DEFAULTS.turnChance)}
          />
          <CheckboxField form={form} path={at('terrain', 'castle')} label="Castle" fallback={MAP_GEN_DEFAULTS.castle} />
        </div>
      </fieldset>

      <fieldset className="floor-editor__section">
        <legend>Terrain</legend>
        <p className="draft-field__hint">Blank uses the default shown.</p>
        <div className="floor-editor__grid">
          {PATCHES.map(([count, size, title]) => (
            <div key={count} className="floor-editor__patch">
              <NumberField
                form={form}
                path={at('terrain', count)}
                label={title}
                placeholder={String(MAP_GEN_DEFAULTS[count])}
              />
              <PairField
                form={form}
                path={at('terrain', size)}
                label="Size (tiles)"
                placeholders={[String(MAP_GEN_DEFAULTS[size][0]), String(MAP_GEN_DEFAULTS[size][1])]}
              />
            </div>
          ))}
          <NumberField
            form={form}
            path={at('terrain', 'ruins')}
            label="Walled ruins"
            placeholder={String(MAP_GEN_DEFAULTS.ruins)}
          />
          <NumberField
            form={form}
            path={at('terrain', 'buildings')}
            label="Buildings"
            placeholder={String(MAP_GEN_DEFAULTS.buildings)}
          />
        </div>
      </fieldset>

      <fieldset className="floor-editor__section">
        <legend>
          Enemies
          {form.help?.enemies && <InfoPopover title={form.help.enemies.title}>{form.help.enemies.body}</InfoPopover>}
        </legend>
        {isErrorAt(form.error, at('enemies')) && <p className="upload-notice upload-notice--error">{form.message}</p>}
        <p className="draft-field__hint">
          Placed group by group; blank limits mean anywhere. Use the <span aria-hidden="true">ⓘ</span> buttons for what
          each setting means.
        </p>
        <ol className="enemy-groups">
          {Array.from({ length: groupCount }, (_, g) => {
            const group = floor?.enemies[g];
            return (
              <li
                key={g}
                className={
                  isErrorWithin(form.error, at('enemies', g)) ? 'enemy-group enemy-group--invalid' : 'enemy-group'
                }
              >
                <div className="enemy-group__head">
                  <span className="enemy-group__title">
                    Group {g + 1}
                    {group && <span className="draft-field__hint"> · {describeEnemyGroup(group)}</span>}
                  </span>
                  <button
                    type="button"
                    className="header-button"
                    disabled={groupCount <= 1}
                    onClick={() => form.update((draft) => removeAt(draft, at('enemies'), g))}
                  >
                    Remove
                  </button>
                </div>
                {isErrorAt(form.error, at('enemies', g)) && (
                  <p className="upload-notice upload-notice--error">{form.message}</p>
                )}
                <div className="floor-editor__grid">
                  <NumberField form={form} path={at('enemies', g, 'count')} label="Count" />
                  <NumberField
                    form={form}
                    path={at('enemies', g, 'minDistance')}
                    label="Min distance"
                    placeholder="any"
                  />
                  <NumberField
                    form={form}
                    path={at('enemies', g, 'maxDistance')}
                    label="Max distance"
                    placeholder="any"
                  />
                  <PairField
                    form={form}
                    path={at('enemies', g, 'region', 'x')}
                    label="Region x"
                    placeholders={['0', '1']}
                    names={['from', 'to']}
                  />
                  <PairField
                    form={form}
                    path={at('enemies', g, 'region', 'y')}
                    label="Region y"
                    placeholders={['0', '1']}
                    names={['from', 'to']}
                  />
                </div>
              </li>
            );
          })}
        </ol>
        <button
          type="button"
          className="header-button"
          disabled={groupCount >= maxGroups}
          onClick={() => form.update((draft) => insertAt(draft, at('enemies'), NEW_ENEMY_GROUP))}
        >
          Add Enemy Group
        </button>
      </fieldset>
    </li>
  );
}

// The floor's map generated from `seed`, a square per tile.
export function MapPreview({ floor, seed }: { floor: DungeonConfig; seed: number }) {
  const level = useMemo(() => createDungeonLevel(seed, floor), [seed, floor]);
  const cells = useMemo(() => getMapPreview(level), [level]);
  return (
    <div
      className="map-preview"
      style={{ gridTemplateColumns: `repeat(${level.grid.width}, 1fr)` }}
      role="img"
      aria-label={`Sample ${level.grid.width} by ${level.grid.height} map for ${floor.name}`}
    >
      {cells.map((cell) => (
        <span
          key={`${cell.x},${cell.y}`}
          className={`map-preview__cell map-preview__cell--${cell.terrain}${cell.marker ? ` map-preview__cell--${cell.marker}` : ''}`}
        />
      ))}
    </div>
  );
}
