import { useMemo } from 'react';
import { getActiveRegionSettings } from '../data/customRegions.ts';
import { DEFAULT_CONTENT, describeBattle, generatedMap } from '../game/battleSetup.ts';
import { randomSeed } from '../game/rng.ts';
import { MapPreview } from './RegionPreview.tsx';
import { routeHash } from './route.ts';

type GeneratorRoute = { seed: number };

const TITLE_PAGE = routeHash({ page: 'game' });
const HINT = 'Click a unit to see its reach, or Esc to go back.';

// The hash of a fresh Map Generator map, on a new random seed.
export function newGeneratedMapHash(): string {
  return routeHash({ page: 'map-generator', seed: randomSeed() });
}

function useGeneratedMap(seed: number) {
  return useMemo(() => {
    const regions = getActiveRegionSettings();
    const setup = generatedMap(seed, regions);
    return { setup, title: describeBattle(setup, { ...DEFAULT_CONTENT, regions }) };
  }, [seed]);
}

// #/map-generator/<seed>: the map the procedural generator makes from
// `seed`, in a region the seed picks, shown read-only on the battle stage
// so maps can be looked over without playing. Esc goes back to the title.
export function MapGenerator({ seed }: GeneratorRoute) {
  const { setup } = useGeneratedMap(seed);
  return <MapPreview setup={setup} exitHash={TITLE_PAGE} />;
}

// Header status on the Map Generator: which region and stage the map is
// for, and its seed.
export function MapGeneratorBanner({ seed }: GeneratorRoute) {
  const { title } = useGeneratedMap(seed);
  return (
    <div className="deployment-banner">
      <h2 className="deployment-banner__title">Map Generator</h2>
      <p className="deployment-banner__hint" title={HINT}>
        {title}, seed {seed}. {HINT}
      </p>
    </div>
  );
}

// Header buttons on the Map Generator: a whole new map, and back to the title.
export function MapGeneratorActions() {
  return (
    <>
      <button type="button" className="header-button" onClick={() => (window.location.hash = newGeneratedMapHash())}>
        Generate
      </button>
      <a className="header-button" href={TITLE_PAGE}>
        Main Menu
      </a>
    </>
  );
}
