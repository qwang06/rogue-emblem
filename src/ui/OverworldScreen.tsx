import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { INK_STAMP_URLS, SITE_ICON_URLS } from '../assets/realmIcons.ts';
import { gameStore } from '../bridge/gameStore.ts';
import { getOverworldZoom, toEventView, toOverworldView, type OverworldView } from '../bridge/overworldView.ts';
import { enterRun, getRunScreen } from '../bridge/warbandFlow.ts';
import { getActiveContent } from '../data/customContent.ts';
import { loadSavedRun } from '../data/runSave.ts';
import type { Point } from '../game/grid.ts';
import { getUnitSprite, TILE_SIZE } from '../game/tileset.ts';
import { paintRealmInk, type RgbaImage } from '../game/warband/realm/inkRaster.ts';
import { BATTLE_SITES, getRealm, type Realm } from '../game/warband/realm/realm.ts';
import {
  getRealmInk,
  getRouteLine,
  INK_STAMPS,
  pointAlong,
  type InkStamp,
  type RealmInk,
} from '../game/warband/realm/realmInk.ts';
import type { RunState } from '../game/warband/run.ts';
import { getCurrentSiteId } from '../game/warband/travel.ts';
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

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

// The Warband run's realm, between battles, as an old parchment map in
// the manner of Tactics Ogre and Final Fantasy Tactics: the land the
// warband crosses, an illustrated icon with a pennant on every site, the
// roads it has come along and the ones on from where it stands. Picking a
// site (arrows and Enter, or a click) walks the warband there along the
// road and carries on with what's there (warbandFlow.ts). With auto play
// on, it picks a road itself. The map is painted on a canvas (realmInk.ts,
// inkRaster.ts) at native size and scaled up whole, with the place names,
// route lines and sites laid over it in layers of the same size.
export function OverworldScreen() {
  const [run, setRun] = useState(() => loadSavedRun());
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
  // Saves `next` and carries on with it: staying here (a wayside event, or
  // its outcome settled) or on to the map scene.
  function carryOn(next: RunState) {
    enterRun(next);
    if (getRunScreen(next) === 'overworld') setRun(next);
  }
  return <Overworld key={getCurrentSiteId(run)} run={run} realm={realm} onRun={carryOn} />;
}

function Overworld({ run, realm, onRun }: { run: RunState; realm: Realm; onRun: (run: RunState) => void }) {
  const view = useMemo(() => toOverworldView(run, realm, getActiveContent().regions), [run, realm]);
  const ink = useMemo(() => getRealmInk(realm), [realm]);
  const autoPlay = useGameStore((state) => state.autoPlay);
  const [selected, setSelected] = useState(0);
  // The road the warband is walking (as the line drawn for it, in map
  // pixels), and how far along it is, from 0 to 1.
  const [walk, setWalk] = useState<{ line: readonly Point[]; t: number; siteId: string; ms: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const zoom = useZoom(viewportRef, view.height);
  const choice = view.choices[selected] ?? null;
  const routes = useMemo(
    () => ({
      travelled: view.travelled.map((road) => getRouteLine(ink, road)),
      choices: view.choices.map((site) => getRouteLine(ink, site.road)),
    }),
    [ink, view],
  );

  function travel(index: number) {
    const target = view.choices[index];
    if (!target || walk) return;
    setSelected(index);
    if (prefersReducedMotion() || target.road.length < 2) arrive(target.siteId);
    else setWalk({ line: routes.choices[index], t: 0, siteId: target.siteId, ms: (target.road.length - 1) * STEP_MS });
  }

  function arrive(siteId: string) {
    const { session } = applyRunCommand(resumeRunSession(run), { type: 'travel', siteId }, { realm });
    onRun(session.run);
  }

  // Walks the warband along the road, then arrives.
  useEffect(() => {
    if (!walk) return;
    let frame = 0;
    const start = performance.now() - walk.t * walk.ms;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / walk.ms);
      if (t >= 1) arrive(walk.siteId);
      else {
        setWalk((current) => current && { ...current, t });
        frame = requestAnimationFrame(step);
      }
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [walk?.siteId]);

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

  const current = view.sites.find((site) => site.id === view.currentSiteId);
  const tileCenter = (point: Point): Point => ({
    x: (point.x + 0.5) * TILE_SIZE,
    y: (point.y + 0.5) * TILE_SIZE,
  });
  // Where the warband stands, in map pixels: on its site, or on the road.
  const leaderAt = walk ? pointAlong(walk.line, walk.t) : current ? tileCenter(current) : { x: 0, y: 0 };

  // Keeps the warband and its choices in view: scrolled to the selected
  // site, or the warband while it walks.
  const focusSite = view.sites.find((site) => site.id === (choice?.siteId ?? view.currentSiteId));
  const focusX = walk ? leaderAt.x : focusSite ? tileCenter(focusSite).x : 0;
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const left = focusX * zoom - viewport.clientWidth / 2;
    viewport.scrollTo({ left, behavior: walk || prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [Math.round(focusX / 8), zoom, walk !== null]);

  const scale = TILE_SIZE * zoom;
  const at = (point: Point): CSSProperties => ({ left: point.x * zoom, top: point.y * zoom });

  return (
    <div className="overworld on-dark">
      <header className="overworld__bar">
        <div className="overworld__title">
          <h1 className="overworld__realm">{view.realmName}</h1>
          <p className="overworld__stat">
            {view.depth === 0 ? `Setting out · ${view.finalStage} stages` : `Stage ${view.depth} of ${view.finalStage}`}
          </p>
        </div>
        <TeamStrip view={view} />
        <p className="overworld__stat overworld__gold">{view.gold} G</p>
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
          <RealmCanvas realm={realm} ink={ink} zoom={zoom} />
          {ink.labels.map((label) => (
            <span
              key={label.text}
              className={`overworld__land overworld__land--${label.kind}`}
              style={at(label)}
              aria-hidden="true"
            >
              {label.text}
            </span>
          ))}
          <svg
            className="overworld__routes"
            viewBox={`0 0 ${view.width * TILE_SIZE} ${view.height * TILE_SIZE}`}
            aria-hidden="true"
          >
            {routes.travelled.map((line, i) => (
              <polyline
                key={`t${i}`}
                className="overworld__route overworld__route--travelled"
                points={toPoints(line)}
              />
            ))}
            {!walk &&
              routes.choices.map((line, i) =>
                i === selected ? null : (
                  <polyline
                    key={`c${i}`}
                    className="overworld__route overworld__route--choice"
                    points={toPoints(line)}
                  />
                ),
              )}
            {(walk ? walk.line : routes.choices[selected]) && (
              <>
                <polyline
                  className="overworld__route overworld__route--chosen-edge"
                  points={toPoints(walk ? walk.line : routes.choices[selected])}
                />
                <polyline
                  className="overworld__route overworld__route--chosen"
                  points={toPoints(walk ? walk.line : routes.choices[selected])}
                />
              </>
            )}
          </svg>
          {view.sites.map((site) => {
            const index = view.choices.findIndex((c) => c.siteId === site.id);
            const isSelected = index >= 0 && index === selected && !walk;
            const classes = ['overworld__site', `overworld__site--${site.state}`, `overworld__site--${site.kind}`];
            if (isSelected) classes.push('overworld__site--selected');
            const labelled = isSelected || site.state === 'current' || site.kind === 'hold';
            return (
              <button
                key={site.id}
                type="button"
                className={classes.join(' ')}
                style={at(tileCenter(site))}
                aria-label={site.name}
                disabled={index < 0 || walk !== null}
                onMouseEnter={() => index >= 0 && !walk && setSelected(index)}
                onClick={() => index >= 0 && travel(index)}
              >
                <img className="overworld__icon" src={SITE_ICON_URLS[site.kind]} alt="" draggable={false} />
                <span className={`overworld__pennant overworld__pennant--${pennantOf(site)}`} aria-hidden="true" />
                {isSelected && <span className="overworld__pointer" aria-hidden="true" />}
                {labelled && <span className="overworld__label">{site.name}</span>}
              </button>
            );
          })}
          {view.leaderSprite && (
            <span
              className={walk ? 'overworld__leader overworld__leader--walking' : 'overworld__leader'}
              style={at(leaderAt)}
            >
              <UnitSprite sprite={view.leaderSprite} scale={zoom} animated />
            </span>
          )}
        </div>
      </div>

      <SiteBanner choice={choice} />
      <KeyHint className="overworld__hint" entries={KEYS} />
      {run.pendingEvent && <EventPanel run={run} autoPlay={autoPlay} onDone={onRun} />}
    </div>
  );
}

// The highlighted site's name and what waits there, across the foot of
// the screen like Final Fantasy Tactics' map: a fixed height, so moving
// between sites never moves the map.
function SiteBanner({ choice }: { choice: OverworldView['choices'][number] | null }) {
  return (
    <section className="overworld__banner" aria-live="polite">
      {choice ? (
        <>
          <p className="overworld__kind">
            {choice.kindLabel} · Stage {choice.stage}
          </p>
          <h2 className="overworld__name">{choice.name}</h2>
          <p className="overworld__blurb">{choice.blurb}</p>
          <dl className="overworld__facts">
            <div>
              <dt>Region</dt>
              <dd>{choice.region ?? '—'}</dd>
            </div>
            <div>
              <dt>Enemies</dt>
              <dd>{choice.enemies ?? '—'}</dd>
            </div>
            <div>
              <dt>Objective</dt>
              <dd>{choice.objective ?? '—'}</dd>
            </div>
          </dl>
        </>
      ) : (
        <p className="overworld__blurb">The road ends here.</p>
      )}
    </section>
  );
}

// The flag over a site: blue where the warband has been, red over a fight
// ahead, black and gold over an elite lair or the Hold, and white over a
// stop with no battle.
function pennantOf(site: OverworldView['sites'][number]): 'blue' | 'red' | 'black' | 'white' {
  if (site.state === 'visited' || site.state === 'current') return 'blue';
  if (site.kind === 'elite' || site.kind === 'hold') return 'black';
  return BATTLE_SITES.has(site.kind) ? 'red' : 'white';
}

function toPoints(line: readonly Point[]): string {
  return line.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

const EVENT_KEYS = [
  ['↑↓', 'Choose'],
  ['Enter', 'Confirm'],
] as const;

// A wayside event over the map: its story and choices (blocked ones
// disabled, with why), then what came of the one taken. Arrows and Enter,
// or the mouse; with auto play on, it takes the first choice it can.
function EventPanel({ run, autoPlay, onDone }: { run: RunState; autoPlay: boolean; onDone: (run: RunState) => void }) {
  const view = toEventView(run)!;
  const [selected, setSelected] = useState(() =>
    Math.max(
      0,
      view.choices.findIndex((c) => !c.blocked),
    ),
  );
  const [outcome, setOutcome] = useState<{ run: RunState; text: string } | null>(null);

  function choose(index: number) {
    if (outcome || view.choices[index]?.blocked) return;
    const { session, events } = applyRunCommand(resumeRunSession(run), { type: 'pick-event', index });
    const said = events.find((event) => event.type === 'event-outcome');
    setOutcome({ run: session.run, text: said?.type === 'event-outcome' ? said.text : '' });
  }

  function confirm() {
    if (outcome) onDone(outcome.run);
    else choose(selected);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        const count = view.choices.length;
        setSelected((current) => (current + (event.key === 'ArrowUp' ? -1 : 1) + count) % count);
      } else if (event.key === 'Enter' || event.key === 'z' || event.key === 'Z' || event.key === ' ') {
        event.preventDefault();
        confirm();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  useEffect(() => {
    if (!autoPlay) return;
    const timer = window.setTimeout(() => {
      if (outcome) onDone(outcome.run);
      else
        choose(
          Math.max(
            0,
            view.choices.findIndex((c) => !c.blocked),
          ),
        );
    }, AUTO_DELAY_MS * 2);
    return () => window.clearTimeout(timer);
  });

  return (
    <div className="overworld-event">
      <Frame className="overworld-event__panel" role="dialog" aria-label={view.title}>
        <h2 className="overworld-event__title">{view.title}</h2>
        <p className="overworld-event__text">{view.text}</p>
        <ul className="overworld-event__choices">
          {view.choices.map((choice, index) => {
            const classes = ['overworld-event__choice'];
            if (index === selected && !outcome) classes.push('overworld-event__choice--selected');
            return (
              <li key={choice.label}>
                <button
                  type="button"
                  className={classes.join(' ')}
                  disabled={choice.blocked !== null || outcome !== null}
                  onMouseEnter={() => setSelected(index)}
                  onClick={() => choose(index)}
                >
                  <span className="overworld-event__label">{choice.label}</span>
                  <span className="overworld-event__detail">{choice.blocked ?? choice.detail}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {/* Reserved whether or not a choice has been taken, so the panel keeps its size. */}
        <p className="overworld-event__outcome" aria-live="polite">
          {outcome?.text ?? ' '}
        </p>
        <button
          type="button"
          className="header-button overworld-event__continue"
          style={{ visibility: outcome ? 'visible' : 'hidden' }}
          onClick={() => outcome && onDone(outcome.run)}
        >
          Continue
        </button>
      </Frame>
      <KeyHint className="overworld__hint" entries={EVENT_KEYS} />
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

let cachedStamps: Record<InkStamp, RgbaImage> | null = null;
let stampsPromise: Promise<Record<InkStamp, RgbaImage>> | null = null;

function loadInkStamps(): Promise<Record<InkStamp, RgbaImage>> {
  if (cachedStamps) return Promise.resolve(cachedStamps);
  if (!stampsPromise) {
    stampsPromise = Promise.all(
      INK_STAMPS.map(
        (stamp) =>
          new Promise<[InkStamp, RgbaImage]>((resolve, reject) => {
            const image = new Image();
            image.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = image.width;
              canvas.height = image.height;
              const context = canvas.getContext('2d')!;
              context.drawImage(image, 0, 0);
              const { width, height, data } = context.getImageData(0, 0, image.width, image.height);
              resolve([stamp, { width, height, data }]);
            };
            image.onerror = reject;
            image.src = INK_STAMP_URLS[stamp];
          }),
      ),
    ).then((loaded) => {
      cachedStamps = Object.fromEntries(loaded) as Record<InkStamp, RgbaImage>;
      return cachedStamps;
    });
  }
  return stampsPromise;
}

// The realm's parchment map (realmInk.ts) painted once at native size by
// inkRaster.ts, from the ink stamps' pixels, and scaled with the map.
function RealmCanvas({ realm, ink, zoom }: { realm: Realm; ink: RealmInk; zoom: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stamps, setStamps] = useState<Record<InkStamp, RgbaImage> | null>(() => cachedStamps);

  useEffect(() => {
    if (stamps) return;
    let live = true;
    loadInkStamps().then((loaded) => live && setStamps(loaded));
    return () => {
      live = false;
    };
  }, [stamps]);

  useLayoutEffect(() => {
    const context = canvasRef.current?.getContext('2d');
    if (!context || !stamps) return;
    const { width, height, data } = paintRealmInk(ink, realm.seed, stamps);
    context.putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0);
  }, [ink, realm.seed, stamps]);

  return (
    <canvas
      ref={canvasRef}
      className="overworld__canvas"
      width={ink.width}
      height={ink.height}
      style={{ width: ink.width * zoom, height: ink.height * zoom }}
      aria-label={`Map of ${realm.name}`}
      role="img"
    />
  );
}
