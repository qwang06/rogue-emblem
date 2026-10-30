import { useMemo, useState } from 'react';
import { getActiveRegionSettings } from '../data/customRegions.ts';
import { DEFAULT_CONTENT, describeBattle, generatedMap } from '../game/battleSetup.ts';
import { randomSeed } from '../game/rng.ts';
import { Frame } from './Frame.tsx';
import { MapPreview } from './RegionPreview.tsx';
import { routeHash } from './route.ts';

type GeneratorRoute = { region: number | null; seed: number };

const TITLE_PAGE = routeHash({ page: 'game' });
const HINT = 'Click a unit to see its reach, or Esc to go back.';
const ANY_REGION = 'any';

// Shows a fresh map, on a new random seed, in `region` (null for any).
function generate(region: number | null) {
  window.location.hash = routeHash({ page: 'map-generator', region, seed: randomSeed() });
}

function useGeneratedMap({ region, seed }: GeneratorRoute) {
  return useMemo(() => {
    const regions = getActiveRegionSettings();
    const setup = generatedMap(seed, regions, region);
    return { setup, title: setup && describeBattle(setup, { ...DEFAULT_CONTENT, regions }) };
  }, [region, seed]);
}

// #/map-generator/[<index>/]<seed>: the map the procedural generator makes
// from `seed`, in region `index` or one the seed picks, shown read-only on
// the battle stage so maps can be looked over without playing. Esc (or a
// region that doesn't exist) goes back to the title.
export function MapGenerator(route: GeneratorRoute) {
  const { setup } = useGeneratedMap(route);
  return <MapPreview setup={setup} exitHash={TITLE_PAGE} />;
}

// Header status on the Map Generator: which region and stage the map is
// for, and its seed.
export function MapGeneratorBanner(route: GeneratorRoute) {
  const { title } = useGeneratedMap(route);
  return (
    <div className="deployment-banner">
      <h2 className="deployment-banner__title">Map Generator</h2>
      <p className="deployment-banner__hint" title={HINT}>
        {title}, seed {route.seed}. {HINT}
      </p>
    </div>
  );
}

// The Map Generator's window over the map: the region to generate in (any,
// or one of Warband Mode's regions) and Generate, a whole new map there.
// Picking a region generates a map in it straight away.
export function MapGeneratorPanel({ region }: GeneratorRoute) {
  const names = useMemo(() => getActiveRegionSettings().regions.map((entry) => entry.name), []);
  const [picked, setPicked] = useState(region);

  function pick(value: string) {
    const next = value === ANY_REGION ? null : Number(value);
    setPicked(next);
    generate(next);
  }

  return (
    <Frame className="map-generator">
      <h2 className="map-generator__title">Generator</h2>
      <label className="map-generator__field">
        <span>Region</span>
        <select
          className="map-generator__select"
          value={picked === null ? ANY_REGION : String(picked)}
          onChange={(event) => pick(event.target.value)}
        >
          <option value={ANY_REGION}>Any region</option>
          {names.map((name, index) => (
            <option key={index} value={index}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="map-generator__button" onClick={() => generate(picked)}>
        Generate
      </button>
    </Frame>
  );
}

// Header button on the Map Generator: back to the title.
export function MapGeneratorActions() {
  return (
    <a className="header-button" href={TITLE_PAGE}>
      Main Menu
    </a>
  );
}
