import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import terrainSheetUrl from '../assets/overworld.png';
import { SPRITE_URLS } from '../assets/sprites.ts';
import { gameStore } from '../bridge/gameStore.ts';
import { getOverworldZoom, toOverworldView, type OverworldView } from '../bridge/overworldView.ts';
import { enterRun } from '../bridge/warbandFlow.ts';
import { getActiveContent } from '../data/customContent.ts';
import { loadSavedRun } from '../data/runSave.ts';
import type { Point } from '../game/grid.ts';
import { getUnitSprite, MAP_PROPS_SHEET, TERRAIN_AUTOTILES, TERRAIN_SHEET, TILE_SIZE } from '../game/tileset.ts';
import { getRealm, type Realm } from '../game/warband/realm/realm.ts';
import { getRealmDrawList, REALM_WATER_FRAMES } from '../game/warband/realm/realmArt.ts';
import type { RunState } from '../game/warband/run.ts';
import { applyRunCommand, resumeRunSession } from '../game/warband/runCommands.ts';
import { planTravel } from '../game/warband/runPolicy.ts';
import { Frame } from './Frame.tsx';
import { KeyHint } from './KeyHint.tsx';
import { UnitSprite } from './UnitSprite.tsx';
import { useGameStore } from './useGameStore.ts';
import './Overworld.css';

const KEYS = [
  ['←→', 'Choose'],
  ['Enter', 'Travel'],
] as const;

// How long the warband takes per road tile when it travels, and how long
// auto play waits on the map before it picks a road.
const STEP_MS = 70;
const AUTO_DELAY_MS = 700;
const WATER_FRAME_MS = TERRAIN_AUTOTILES.water.animation?.frameMs ?? 180;

const SHEET_URLS: Readonly<Record<string, string>> = {
  [TERRAIN_SHEET.key]: terrainSheetUrl,
  [MAP_PROPS_SHEET.key]: SPRITE_URLS[MAP_PROPS_SHEET.key],
};

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

// The Warband run's realm, between battles: the land the warband crosses,
// the sites it has been and the roads on from where it stands. Picking a
// site (arrows and Enter, or a click) walks the warband there along the
// road and carries on with what's there (warbandFlow.ts). With auto play
// on, it picks a road itself. The map is painted on a canvas from the
// realm's draw list (realmArt.ts) at native size and scaled up whole,
// with site markers laid over it in a layer of the same size.
export function OverworldScreen() {
  const [run] = useState(() => loadSavedRun());
  const realm = useMemo(() => (run ? getRealm(run.seed, getActiveContent().regions) : null), [run]);

  if (!run || !realm) {
    return (
      <div className="overworld overworld--empty">
        <p>No run to continue.</p>
        <button type="button" className="header-button" onClick={() => gameStore.setState({ screen: 'title' })}>
          Main Menu
        </button>
      </div>
    );
  }
  return <Overworld run={run} realm={realm} />;
}

function Overworld({ run, realm }: { run: RunState; realm: Realm }) {
  const view = useMemo(() => toOverworldView(run, realm, getActiveContent().regions), [run, realm]);
  const autoPlay = useGameStore((state) => state.autoPlay);
  const [selected, setSelected] = useState(0);
  // The road the warband is walking, and how far along it is.
  const [walk, setWalk] = useState<{ road: readonly Point[]; step: number; siteId: string } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const zoom = useZoom(viewportRef, view.height);
  const choice = view.choices[selected] ?? null;

  function travel(index: number) {
    const target = view.choices[index];
    if (!target || walk) return;
    setSelected(index);
    if (prefersReducedMotion() || target.road.length < 2) arrive(target.siteId);
    else setWalk({ road: target.road, step: 0, siteId: target.siteId });
  }

  function arrive(siteId: string) {
    const { session } = applyRunCommand(resumeRunSession(run), { type: 'travel', siteId }, { realm });
    enterRun(session.run);
  }

  // Walks the warband a tile at a time, then arrives.
  useEffect(() => {
    if (!walk) return;
    const timer = window.setTimeout(() => {
      if (walk.step >= walk.road.length - 1) arrive(walk.siteId);
      else setWalk({ ...walk, step: walk.step + 1 });
    }, STEP_MS);
    return () => window.clearTimeout(timer);
  });

  // Auto play picks the road the run policy would.
  useEffect(() => {
    if (!autoPlay || walk || view.choices.length === 0) return;
    const timer = window.setTimeout(() => {
      const command = planTravel(resumeRunSession(run), realm);
      if (command.type !== 'travel') return;
      travel(
        Math.max(
          0,
          view.choices.findIndex((site) => site.siteId === command.siteId),
        ),
      );
    }, AUTO_DELAY_MS);
    return () => window.clearTimeout(timer);
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || walk) return;
      const count = view.choices.length;
      if (count === 0) return;
      if (['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
        const step = event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1;
        setSelected((current) => (current + step + count) % count);
      } else if (event.key === 'Enter' || event.key === 'z' || event.key === 'Z' || event.key === ' ') {
        event.preventDefault();
        travel(selected);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  // Keeps the warband and its choices in view: scrolled to the selected
  // site, or the warband while it walks.
  const focusId = choice?.siteId ?? view.currentSiteId;
  const focus: Point | undefined = walk ? walk.road[walk.step] : view.sites.find((site) => site.id === focusId);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !focus) return;
    const x = (focus.x + 0.5) * TILE_SIZE * zoom;
    const left = x - viewport.clientWidth / 2;
    viewport.scrollTo({ left, behavior: walk || prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [focus?.x, zoom, walk !== null]);

  const scale = TILE_SIZE * zoom;
  const leaderAt = walk
    ? walk.road[walk.step]
    : (view.sites.find((site) => site.id === view.currentSiteId) ?? { x: 0, y: 0 });
  const tileStyle = (point: Point): CSSProperties => ({ left: point.x * scale, top: point.y * scale });

  return (
    <div className="overworld on-dark">
      <header className="overworld__bar">
        <h1 className="overworld__realm">{view.realmName}</h1>
        <p className="overworld__stat">
          {view.depth === 0 ? `Setting out · ${view.finalStage} stages` : `Stage ${view.depth} of ${view.finalStage}`}
        </p>
        <p className="overworld__stat overworld__gold">{view.gold} G</p>
        <TeamStrip view={view} />
        <AutoToggle on={autoPlay} />
        <button type="button" className="header-button" onClick={() => gameStore.setState({ screen: 'title' })}>
          Main Menu
        </button>
      </header>

      <div className="overworld__viewport" ref={viewportRef}>
        <div
          className="overworld__map"
          style={{ width: view.width * scale, height: view.height * scale, '--tile': `${scale}px` } as CSSProperties}
        >
          <RealmCanvas realm={realm} zoom={zoom} />
          {view.travelled
            .flatMap((road) => road.slice(1, -1))
            .map((point, i) => (
              <span key={`t${i}`} className="overworld__dot overworld__dot--travelled" style={tileStyle(point)} />
            ))}
          {!walk &&
            view.choices.map((site, index) =>
              site.road
                .slice(1, -1)
                .map((point, i) => (
                  <span
                    key={`${site.siteId}-${i}`}
                    className={
                      index === selected
                        ? 'overworld__dot overworld__dot--chosen'
                        : 'overworld__dot overworld__dot--road'
                    }
                    style={tileStyle(point)}
                  />
                )),
            )}
          {view.sites.map((site) => {
            const index = view.choices.findIndex((c) => c.siteId === site.id);
            const classes = ['overworld__site', `overworld__site--${site.state}`];
            if (index >= 0 && index === selected) classes.push('overworld__site--selected');
            if (['battle', 'village', 'fort', 'hold'].includes(site.kind)) classes.push('overworld__site--battle');
            const labelled = site.state === 'choice' || site.state === 'current' || site.kind === 'hold';
            return (
              <button
                key={site.id}
                type="button"
                className={classes.join(' ')}
                style={tileStyle(site)}
                aria-label={site.name}
                disabled={index < 0 || walk !== null}
                onMouseEnter={() => index >= 0 && !walk && setSelected(index)}
                onClick={() => index >= 0 && travel(index)}
              >
                {site.state === 'choice' && <span className="overworld__arrow" aria-hidden="true" />}
                {labelled && <span className="overworld__label">{site.name}</span>}
              </button>
            );
          })}
          {view.leaderSprite && (
            <span className="overworld__leader" style={tileStyle(leaderAt)}>
              <UnitSprite sprite={view.leaderSprite} scale={zoom} animated />
            </span>
          )}
        </div>
      </div>

      <Frame className="overworld__card" aria-live="polite">
        {choice ? (
          <>
            <p className="overworld__kind">
              {choice.kindLabel} · Stage {choice.stage}
            </p>
            <h2 className="overworld__name">{choice.name}</h2>
            <p className="overworld__blurb">{choice.blurb}</p>
            <dl className="overworld__facts">
              <dt>Region</dt>
              <dd>{choice.region ?? '—'}</dd>
              <dt>Enemies</dt>
              <dd>{choice.enemies ?? '—'}</dd>
              <dt>Objective</dt>
              <dd>{choice.objective ?? '—'}</dd>
            </dl>
          </>
        ) : (
          <p className="overworld__blurb">The road ends here.</p>
        )}
      </Frame>

      <KeyHint className="overworld__hint" entries={KEYS} />
    </div>
  );
}

function TeamStrip({ view }: { view: OverworldView }) {
  return (
    <ul className="overworld__team" aria-label="Warband">
      {view.team.map((unit) => (
        <li key={unit.id} title={`${unit.name} · Lv ${unit.level} · ${unit.health}/${unit.maxHealth} HP`}>
          <UnitSprite sprite={getUnitSprite(unit.unitClass)} />
        </li>
      ))}
    </ul>
  );
}

function AutoToggle({ on }: { on: boolean }) {
  return (
    <button
      type="button"
      className="header-button"
      aria-pressed={on}
      title="Let the AI pick the road"
      onClick={() => gameStore.setState({ autoPlay: !on })}
    >
      Auto
    </button>
  );
}

// The scale that fits the realm's height in the viewport (getOverworldZoom),
// kept up to date as the window resizes.
function useZoom(ref: RefObject<HTMLDivElement | null>, rows: number): number {
  const [zoom, setZoom] = useState(1);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setZoom(getOverworldZoom(element.clientHeight, rows, TILE_SIZE));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, rows]);
  return zoom;
}

// The realm's land, roads and buildings painted at native size, scaled
// with the map; the water animates unless the player prefers less motion.
function RealmCanvas({ realm, zoom }: { realm: Realm; zoom: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [images, setImages] = useState<Record<string, HTMLImageElement> | null>(null);
  const [frame, setFrame] = useState(0);
  const drawLists = useMemo(
    () => Array.from({ length: REALM_WATER_FRAMES }, (_, i) => getRealmDrawList(realm, i)),
    [realm],
  );

  useEffect(() => {
    let live = true;
    const entries = Object.entries(SHEET_URLS).map(
      ([key, url]) =>
        new Promise<[string, HTMLImageElement]>((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve([key, image]);
          image.onerror = reject;
          image.src = url;
        }),
    );
    Promise.all(entries).then((loaded) => live && setImages(Object.fromEntries(loaded)));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const timer = window.setInterval(() => setFrame((current) => (current + 1) % REALM_WATER_FRAMES), WATER_FRAME_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const context = canvasRef.current?.getContext('2d');
    if (!context || !images) return;
    context.imageSmoothingEnabled = false;
    for (const draw of drawLists[frame]) {
      const image = images[draw.sheet];
      if (!image) continue;
      const columns = Math.floor(image.width / draw.size);
      const sx = (draw.frame % columns) * draw.size;
      const sy = Math.floor(draw.frame / columns) * draw.size;
      context.drawImage(image, sx, sy, draw.size, draw.size, draw.x, draw.y, draw.size, draw.size);
    }
  }, [images, drawLists, frame]);

  const width = realm.grid.width * TILE_SIZE;
  const height = realm.grid.height * TILE_SIZE;
  return (
    <canvas
      ref={canvasRef}
      className="overworld__canvas"
      width={width}
      height={height}
      style={{ width: width * zoom, height: height * zoom }}
      aria-label={`Map of ${realm.name}`}
      role="img"
    />
  );
}
