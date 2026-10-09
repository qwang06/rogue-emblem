import { useEffect, useMemo, useRef } from 'react';
import { BATTLE_STATE_DEFAULTS, gameStore } from '../bridge/gameStore.ts';
import { getActiveRegionSettings } from '../data/customRegions.ts';
import { regionPreview } from '../game/battleSetup.ts';
import { randomSeed } from '../game/rng.ts';
import { getRegionStages } from '../game/warband/regions.ts';
import { LoadingScreen } from './LoadingScreen.tsx';
import { stageLabel } from './RegionsConfigPage.tsx';
import { routeHash } from './route.ts';
import { useGameStore } from './useGameStore.ts';

type PreviewRoute = { index: number; seed: number };

const REGIONS_PAGE = routeHash({ page: 'config', id: 'regions' });
const HINT = 'Click a unit to see its reach · Esc Back';

// #/configs/regions/preview/<index>/<seed>: region `index` (from the
// regions Warband Mode plays, uploads included) on the map `seed` makes,
// drawn by the map scene on the battle stage. The store's screen is
// 'preview', so GridScene shows the map read-only (no deployment, dialog
// or turns). A new seed in the route restarts the scene on that map;
// leaving the route ends the preview, and the scene ending it (Esc) leaves
// for the regions page.
export function RegionPreview({ index, seed }: PreviewRoute) {
  const setup = useMemo(() => regionPreview(index, seed, getActiveRegionSettings()), [index, seed]);
  const screen = useGameStore((state) => state.screen);
  const started = useRef(false);

  useEffect(() => {
    if (screen !== 'title') started.current = true;
    else if (started.current) window.location.hash = REGIONS_PAGE;
  }, [screen]);

  useEffect(() => {
    if (setup) gameStore.setState({ ...BATTLE_STATE_DEFAULTS, screen: 'preview', battleSetup: setup });
    else window.location.hash = REGIONS_PAGE;
  }, [setup]);

  // Set straight in the store rather than sent as 'main-menu', so the
  // preview ends even if the scene is still loading and can't hear it.
  useEffect(
    () => () => {
      if (gameStore.getState().screen !== 'title') {
        gameStore.setState({ ...BATTLE_STATE_DEFAULTS, screen: 'title', battleSetup: null });
      }
    },
    [],
  );

  return <LoadingScreen />;
}

// Header status during a preview: the region's name and the stages it covers.
export function RegionPreviewBanner({ index }: PreviewRoute) {
  const settings = useMemo(() => getActiveRegionSettings(), []);
  const region = settings.regions[index];
  if (!region) return null;
  const { first, last } = getRegionStages(index, settings.regions.length, settings.stagesPerRegion);

  return (
    <div className="deployment-banner">
      <h2 className="deployment-banner__title">Preview · {region.name}</h2>
      <p className="deployment-banner__hint" title={HINT}>
        {stageLabel(first, last)} · {HINT}
      </p>
    </div>
  );
}

// Header buttons during a preview: another map from the same region, and
// back to the regions page.
export function RegionPreviewActions({ index }: PreviewRoute) {
  return (
    <>
      <button
        type="button"
        className="header-button"
        onClick={() => (window.location.hash = routeHash({ page: 'region-preview', index, seed: randomSeed() }))}
      >
        New Map
      </button>
      <a className="header-button" href={REGIONS_PAGE}>
        Back to Regions
      </a>
    </>
  );
}
