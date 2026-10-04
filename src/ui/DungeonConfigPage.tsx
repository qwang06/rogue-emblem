import { useMemo, useState } from 'react';
import { customDungeonStore, readDungeonUpload } from '../data/customDungeon.ts';
import { DUNGEON_TEXT } from '../data/dungeon.ts';
import { DUNGEON_LIMITS, parseDungeonSettings } from '../game/dungeonConfigFile.ts';
import { getConfigFloors, type DungeonConfig } from '../game/dungeonConfigs.ts';
import { createDungeonLevel, randomSeed } from '../game/dungeonLevel.ts';
import { BUILDING_PALETTES } from '../game/tileset.ts';
import { ConfigLayout } from './ConfigLayout.tsx';
import { plural } from './configCatalog.ts';
import { getMapPreview } from './mapPreview.ts';
import { routeHash } from './route.ts';
import { downloadText, STORAGE_UNAVAILABLE, UploadDrop, type UploadNotice } from './UploadDrop.tsx';

const FILE_NAME = 'dungeon.json';

// The terrain counts a floor card lists, with their labels.
const TERRAIN_COUNTS = [
  ['lakes', 'Lakes'],
  ['mountains', 'Mountain ranges'],
  ['forests', 'Forests'],
  ['meadows', 'Meadows'],
  ['ruins', 'Ruins'],
  ['buildings', 'Buildings'],
] as const;

function floorLabel(first: number, last: number | null): string {
  if (last === null) return `Floor ${first}+`;
  return first === last ? `Floor ${first}` : `Floors ${first}–${last}`;
}

// #/configs/dungeon-floors: upload a JSON file replacing Dungeon Mode's
// floor configs. Uploads are checked field by field (and test-generated)
// before they're kept in this browser's storage (src/data/customDungeon.ts);
// the next dungeon run uses them. Each floor config is shown with its
// settings and a map generated from it, re-rolled on demand.
export function DungeonConfigPage() {
  const [stored, setStored] = useState(() => customDungeonStore.load());
  const [notices, setNotices] = useState<readonly UploadNotice[]>([]);
  const [seed, setSeed] = useState(1);

  const { settings, error } = useMemo(() => readDungeonUpload(stored), [stored]);
  const uploaded = stored !== null && error === null;

  async function upload([file]: File[]) {
    const text = await file.text();
    let notice: UploadNotice;
    try {
      const parsed = parseDungeonSettings(text);
      notice = customDungeonStore.save(text)
        ? {
            fileName: file.name,
            ok: true,
            message: `Replaces the dungeon floors (${plural(parsed.floors.length, 'floor config')})`,
          }
        : { fileName: file.name, ok: false, message: STORAGE_UNAVAILABLE };
    } catch (parseError) {
      notice = { fileName: file.name, ok: false, message: (parseError as Error).message };
    }
    setNotices([notice]);
    setStored(customDungeonStore.load());
  }

  function reset() {
    if (!window.confirm('Remove your uploaded dungeon floors and go back to the built-in ones?')) return;
    customDungeonStore.clear();
    setStored(customDungeonStore.load());
    setNotices([]);
  }

  return (
    <ConfigLayout
      title="Dungeon Floors"
      lede="Upload a JSON file to replace Dungeon Mode's floors: map size, terrain, enemies, trees and colors. Changes apply to the next dungeon run."
      back={{ href: routeHash({ page: 'configs' }), label: 'All Configs' }}
    >
      <section className="configs-group">
        <UploadDrop
          accept=".json,application/json"
          title="Drop a dungeon settings file here, or click to choose"
          hint="A .json file in the format below. Download the current floors to start from them."
          notices={notices}
          onFiles={(files) => void upload(files)}
        />
        <DungeonFormat />
      </section>

      <section className="configs-group" aria-labelledby="dungeon-settings-title">
        <h2 id="dungeon-settings-title" className="configs-group__title">
          Current Floors
        </h2>
        <div className="config-card dungeon-summary">
          <div className="config-card__head">
            <h3 className="config-card__title">{FILE_NAME}</h3>
            <span className={uploaded ? 'config-card__badge config-card__badge--ready' : 'config-card__badge'}>
              {uploaded ? 'Uploaded' : 'Built-in'}
            </span>
          </div>
          {error && (
            <p className="upload-notice upload-notice--error">
              Your upload no longer loads, so the built-in floors are used: {error}
            </p>
          )}
          <p className="config-card__description">
            {plural(settings.floors.length, 'floor config')}, each used for {plural(settings.floorsPerConfig, 'floor')}{' '}
            in a row; the last one repeats from then on.
          </p>
          <div className="dialog-files__actions">
            <button
              type="button"
              className="header-button"
              onClick={() => downloadText(FILE_NAME, stored ?? DUNGEON_TEXT, 'application/json')}
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

        <ul className="configs-group__list dungeon-floors">
          {settings.floors.map((floor, i) => {
            const { first, last } = getConfigFloors(i, settings.floors.length, settings.floorsPerConfig);
            return <FloorCard key={i} label={floorLabel(first, last)} floor={floor} seed={seed} />;
          })}
        </ul>
      </section>
    </ConfigLayout>
  );
}

function FloorCard({ label, floor, seed }: { label: string; floor: DungeonConfig; seed: number }) {
  const { terrain } = floor;
  const stats: [string, string | number][] = [
    ['Map', `${terrain.width}×${terrain.height}`],
    ['Enemies', floor.enemyCount],
    ['Trees', `${Math.round(floor.treeChance * 100)}%`],
    ['Palette', floor.palette],
    ...TERRAIN_COUNTS.filter(([key]) => terrain[key] !== undefined).map(([key, name]): [string, number] => [
      name,
      terrain[key]!,
    ]),
  ];
  return (
    <li className="config-card">
      <div className="config-card__head">
        <h3 className="config-card__title">{floor.name}</h3>
        <span className="config-card__badge">{label}</span>
      </div>
      {floor.description && <p className="config-card__description">{floor.description}</p>}
      <MapPreview floor={floor} seed={seed} />
      <dl className="dungeon-stats">
        {stats.map(([name, value]) => (
          <div key={name} className="dungeon-stats__pair">
            <dt>{name}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </li>
  );
}

// The floor's map generated from `seed`, a square per tile.
function MapPreview({ floor, seed }: { floor: DungeonConfig; seed: number }) {
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
      "enemyCount": 2,
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
          <code>enemyCount</code>: {DUNGEON_LIMITS.enemyCount[0]} to {DUNGEON_LIMITS.enemyCount[1]}.{' '}
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
