import { useEffect, useMemo, useRef } from 'react';
import { BATTLE_STATE_DEFAULTS, gameStore } from '../bridge/gameStore.ts';
import { getActiveDungeonSettings } from '../data/customDungeon.ts';
import { dungeonConfigPreview } from '../game/battleSetup.ts';
import { getConfigFloors } from '../game/dungeonConfigs.ts';
import { randomSeed } from '../game/dungeonLevel.ts';
import { floorLabel } from './DungeonConfigPage.tsx';
import { LoadingScreen } from './LoadingScreen.tsx';
import { routeHash } from './route.ts';
import { useGameStore } from './useGameStore.ts';

type PreviewRoute = { index: number; seed: number };

const FLOORS_PAGE = routeHash({ page: 'config', id: 'dungeon-floors' });
const HINT = 'Click a unit to see its reach · Esc Back';

// #/configs/dungeon-floors/preview/<index>/<seed>: dungeon floor config
// `index` (from the floors Dungeon Mode plays, uploads included) on the
// map `seed` makes, drawn by the map scene on the battle stage. The store's
// screen is 'preview', so GridScene shows the map read-only (no deployment,
// dialog or turns). A new seed in the route restarts the scene on that map;
// leaving the route ends the preview, and the scene ending it (Esc) leaves
// for the floors page.
export function DungeonPreview({ index, seed }: PreviewRoute) {
  const setup = useMemo(() => dungeonConfigPreview(index, seed, getActiveDungeonSettings()), [index, seed]);
  const screen = useGameStore((state) => state.screen);
  const started = useRef(false);

  useEffect(() => {
    if (screen !== 'title') started.current = true;
    else if (started.current) window.location.hash = FLOORS_PAGE;
  }, [screen]);

  useEffect(() => {
    if (setup) gameStore.setState({ ...BATTLE_STATE_DEFAULTS, screen: 'preview', battleSetup: setup });
    else window.location.hash = FLOORS_PAGE;
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

// Header status during a preview: the config's name and the floors it covers.
export function DungeonPreviewBanner({ index }: PreviewRoute) {
  const settings = useMemo(() => getActiveDungeonSettings(), []);
  const config = settings.floors[index];
  if (!config) return null;
  const { first, last } = getConfigFloors(index, settings.floors.length, settings.floorsPerConfig);

  return (
    <div className="deployment-banner">
      <h2 className="deployment-banner__title">Preview · {config.name}</h2>
      <p className="deployment-banner__hint" title={HINT}>
        {floorLabel(first, last)} · {HINT}
      </p>
    </div>
  );
}

// Header buttons during a preview: another map from the same config, and
// back to the floors page.
export function DungeonPreviewActions({ index }: PreviewRoute) {
  return (
    <>
      <button
        type="button"
        className="header-button"
        onClick={() => (window.location.hash = routeHash({ page: 'dungeon-preview', index, seed: randomSeed() }))}
      >
        New Map
      </button>
      <a className="header-button" href={FLOORS_PAGE}>
        Back to Floors
      </a>
    </>
  );
}
