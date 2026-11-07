import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { getSiteIconUrl, INK_STAMP_URLS } from '../assets/realmIcons.ts';
import { REWARD_ICON_URLS } from '../assets/rewardIcons.ts';
import { gameStore } from '../bridge/gameStore.ts';
import {
  getOverworldZoom,
  toEventView,
  toOverworldView,
  type OverworldView,
  type SiteDetailView,
  type SpoilKind,
} from '../bridge/overworldView.ts';
import { publishRunRelics } from '../bridge/runRelics.ts';
import { enterRun, getRunScreen } from '../bridge/warbandFlow.ts';
import { getActiveContent } from '../data/customContent.ts';
import { loadSavedRun } from '../data/runSave.ts';
import type { Point } from '../game/grid.ts';
import { TILE_SIZE } from '../game/tileset.ts';
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
import { GlyphIcon, type GlyphKind } from './GlyphIcon.tsx';
import { KeyHint } from './KeyHint.tsx';
import { OverworldRoster } from './OverworldRoster.tsx';
import { UnitSprite } from './UnitSprite.tsx';
import { useGameStore } from './useGameStore.ts';
import './Overworld.css';

const KEYS = [
  ['←→', 'Road'],
  ['R', 'Roster'],
  ['Enter', 'Travel'],
] as const;

// How long the warband takes per road tile when it travels, and how long
// auto play waits on the map before it picks a road, at 1x: the header's
// game speed divides both.
const STEP_MS = 70;
const AUTO_DELAY_MS = 700;

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

// The Warband run's realm, between battles, as an old parchment map in
// the manner of Tactics Ogre and Final Fantasy Tactics: the land the
// warband crosses, an illustrated icon with a pennant on every site, the
// roads it has come along and the ones on from where it stands. Picking a
// site (arrows or its number, then Enter, or a click) walks the warband there along the
// road and carries on with what's there (warbandFlow.ts). With auto play
// on, it picks a road itself. The map is painted on a canvas (realmInk.ts,
// inkRaster.ts) at native size and scaled up whole, with the place names,
// route lines and sites laid over it in layers of the same size. Roster
// (or R) opens the roster screen over the map to manage the warband's
// items before choosing (OverworldRoster).
export function OverworldScreen() {
  const [run, setRun] = useState(() => loadSavedRun());
  const realm = useMemo(() => (run ? getRealm(run.seed, getActiveContent().regions) : null), [run]);
  // The relic bar under the header follows the run (a wayside event can grant a relic).
  useEffect(() => publishRunRelics(run), [run]);

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
  return <Overworld key={getCurrentSiteId(run)} run={run} realm={realm} onRun={carryOn} onRoster={setRun} />;
}

function Overworld({
  run,
  realm,
  onRun,
  onRoster,
}: {
  run: RunState;
  realm: Realm;
  onRun: (run: RunState) => void;
  // Takes the run after the roster screen changed it (already saved).
  onRoster: (run: RunState) => void;
}) {
  const view = useMemo(() => toOverworldView(run, realm, getActiveContent().regions), [run, realm]);
  const ink = useMemo(() => getRealmInk(realm), [realm]);
  const autoPlay = useGameStore((state) => state.autoPlay);
  const speed = useGameStore((state) => state.autoSpeed);
  const [selected, setSelected] = useState(0);
  const [rosterOpen, setRosterOpen] = useState(false);
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
    else
      setWalk({
        line: routes.choices[index],
        t: 0,
        siteId: target.siteId,
        ms: ((target.road.length - 1) * STEP_MS) / speed,
      });
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
  // The roster can open while the warband stands at a site, not on the
  // road or in a wayside event.
  const canOpenRoster = !walk && !run.pendingEvent;
  function openRoster() {
    if (canOpenRoster) setRosterOpen(true);
  }

  useEffect(() => {
    if (!autoPlay || walk || rosterOpen || view.choices.length === 0) return;
    const timer = window.setTimeout(() => {
      const command = planTravel(resumeRunSession(run), realm);
      if (command.type !== 'travel') return;
      travel(
        Math.max(
          0,
          view.choices.findIndex((site) => site.siteId === command.siteId),
        ),
      );
    }, AUTO_DELAY_MS / speed);
    return () => window.clearTimeout(timer);
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || walk || rosterOpen || run.pendingEvent) return;
      if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        openRoster();
        return;
      }
      const count = view.choices.length;
      if (count === 0) return;
      const digit = /^[1-9]$/.test(event.key) ? Number(event.key) : 0;
      if (digit > 0 && digit <= count) {
        event.preventDefault();
        setSelected(digit - 1);
      } else if (['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].includes(event.key)) {
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
  const mapWidth = view.width * TILE_SIZE;
  const mapHeight = view.height * TILE_SIZE;
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
      <header className="overworld__strip">
        <span className="overworld__phase">Realm</span>
        <span className="overworld__vrule" aria-hidden="true" />
        <h1 className="overworld__realm">{view.realmName}</h1>
        <p className="overworld__stage">
          {view.depth === 0
            ? `Setting out · ${view.finalStage} stages`
            : [`Stage ${view.depth} of ${view.finalStage}`, view.currentRegion].filter(Boolean).join(' · ')}
        </p>
        <StageTape view={view} />
        <p className="overworld__gold" title={`${view.gold} gold`}>
          <GlyphIcon kind="gold" />
          {view.gold}
        </p>
        <button
          type="button"
          className="overworld__tool"
          disabled={!canOpenRoster}
          aria-expanded={rosterOpen}
          onClick={openRoster}
        >
          <kbd className="overworld__key">R</kbd>
          Roster
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
            {view.choices.length > 0 && (
              <>
                <defs>
                  <filter id="overworld-soft" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation={TILE_SIZE * 0.7} />
                  </filter>
                  <mask id="overworld-reach" maskUnits="userSpaceOnUse" x="0" y="0" width={mapWidth} height={mapHeight}>
                    <rect width={mapWidth} height={mapHeight} fill="#fff" />
                    <g filter="url(#overworld-soft)">
                      {current && <circle cx={tileCenter(current).x} cy={tileCenter(current).y} r={TILE_SIZE * 2.4} />}
                      {routes.choices.map((line, i) => (
                        <polyline
                          key={`m${i}`}
                          className="overworld__reach"
                          points={toPoints(line)}
                          strokeWidth={TILE_SIZE * 2.2}
                        />
                      ))}
                      {view.sites
                        .filter((site) => site.state === 'choice')
                        .map((site) => (
                          <circle key={site.id} cx={tileCenter(site).x} cy={tileCenter(site).y} r={TILE_SIZE * 2.6} />
                        ))}
                    </g>
                  </mask>
                </defs>
                <rect className="overworld__veil" width={mapWidth} height={mapHeight} mask="url(#overworld-reach)" />
              </>
            )}
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
                  <g key={`c${i}`}>
                    <polyline className="overworld__route overworld__route--choice-edge" points={toPoints(line)} />
                    <polyline className="overworld__route overworld__route--choice" points={toPoints(line)} />
                  </g>
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
            const choiceCard = index >= 0 && !walk ? view.choices[index] : null;
            const labelled = site.state === 'current' || site.kind === 'hold';
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
                {index >= 0 && !walk && <span className="overworld__ring" aria-hidden="true" />}
                <img
                  className="overworld__icon"
                  src={getSiteIconUrl(site.kind, site.season)}
                  alt=""
                  draggable={false}
                />
                <span className={`overworld__pennant overworld__pennant--${pennantOf(site)}`} aria-hidden="true" />
                {choiceCard && (
                  <span className={`overworld__callout${isSelected ? '' : ' overworld__callout--dim'}`}>
                    <kbd className="overworld__callout-key">{index + 1}</kbd>
                    {site.name}
                    <span className="overworld__callout-kind">
                      {isSelected ? `${choiceCard.kindLabel} · next` : choiceCard.kindLabel}
                    </span>
                  </span>
                )}
                {labelled && !choiceCard && <span className="overworld__label">{site.name}</span>}
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

      <RouteCard view={view} choice={choice} selected={selected} />
      <footer className="overworld__foot">
        <KeyHint className="overworld__hint" entries={KEYS} />
        <p className="overworld__other">{describeOtherRoads(view, selected)}</p>
        <button
          type="button"
          className="battle-bar__button battle-bar__button--end overworld__travel"
          disabled={!choice || walk !== null}
          onClick={() => travel(selected)}
        >
          {choice ? `Travel to ${choice.name}` : 'No road on'}
        </button>
      </footer>
      {run.pendingEvent && <EventPanel run={run} autoPlay={autoPlay} onDone={onRun} />}
      {rosterOpen && <OverworldRoster run={run} onRun={onRoster} onClose={() => setRosterOpen(false)} />}
    </div>
  );
}

// The stages as a tape of ticks across the header: the ones behind the
// warband filled, the one it stands on lit, depths with an elite lair
// marked, the Hold's red, and how far the Hold is.
function StageTape({ view }: { view: OverworldView }) {
  return (
    <p className="overworld__tape-wrap" title={`Stage ${view.depth} of ${view.finalStage}`}>
      <span className="overworld__tape" aria-hidden="true">
        {view.tape.map((tick, index) => (
          <i key={index} className={`overworld__tick overworld__tick--${tick}`} />
        ))}
      </span>
      <span className="overworld__tape-label">{view.holdIn === 0 ? 'The Hold' : `Hold in ${view.holdIn}`}</span>
    </p>
  );
}

// The highlighted road's card across the foot of the map, in four cells:
// where it leads, who fights there and what wins it, what it pays, and
// the warband as it stands. A fixed height, so moving between roads
// never moves the map; a road with no battle leaves the foes cell quiet.
function RouteCard({
  view,
  choice,
  selected,
}: {
  view: OverworldView;
  choice: SiteDetailView | null;
  selected: number;
}) {
  const hurt = view.team.filter((unit) => unit.health < unit.maxHealth).length;
  const foeCount = choice?.foes.reduce((sum, foe) => sum + foe.count, 0) ?? 0;
  const levels = choice?.foes.map((foe) => foe.level) ?? [];
  const low = Math.min(...levels);
  const high = Math.max(...levels);
  const site = choice ? view.sites.find((each) => each.id === choice.siteId) : undefined;
  return (
    <section className="overworld__card" aria-live="polite">
      <div className="overworld__cell overworld__cell--destination">
        <h3 className="overworld__cell-title">
          <span>Destination</span>
          <span className="overworld__cell-note">
            {view.choices.length > 0
              ? `${selected + 1} of ${view.choices.length} ${view.choices.length === 1 ? 'road' : 'roads'}`
              : 'no road on'}
          </span>
        </h3>
        <div className="overworld__destination">
          <span className="overworld__destination-icon">
            {site && <img src={getSiteIconUrl(site.kind, site.season)} alt="" draggable={false} />}
          </span>
          <span className="overworld__destination-lines">
            <span className="overworld__destination-name">{choice?.name ?? 'The road ends here'}</span>
            <span className="overworld__destination-meta">
              {choice ? (
                <>
                  {choice.kindLabel} · <b>Stage {choice.stage}</b>
                  {choice.region && ` · ${choice.region}`}
                </>
              ) : (
                ' '
              )}
            </span>
            <span className="overworld__destination-blurb">{choice?.blurb ?? ''}</span>
          </span>
        </div>
      </div>

      <div className="overworld__cell overworld__cell--foes">
        <h3 className="overworld__cell-title">
          <span>Foes</span>
          <span className="overworld__cell-note">
            {choice && foeCount > 0 ? `${foeCount} · LV ${low === high ? low : `${low}–${high}`}` : 'none'}
          </span>
        </h3>
        <ul className="overworld__foes">
          {choice?.foes.map((foe) => (
            <li key={foe.label} className={foe.leader ? 'overworld__foe overworld__foe--leader' : 'overworld__foe'}>
              <span className="overworld__foe-sprite">
                <UnitSprite sprite={foe.sprite} />
              </span>
              <span className="overworld__foe-name">{foe.label}</span>
              <span className="overworld__foe-level">
                LV {foe.level}
                {foe.leader ? ' · leader' : foe.count > 1 ? ` ×${foe.count}` : ''}
              </span>
            </li>
          ))}
          {choice && choice.foes.length === 0 && <li className="overworld__foes-none">No battle here.</li>}
        </ul>
        <p className="overworld__objective">
          {choice?.objective && (
            <span>
              <GlyphIcon kind="rout" /> <b>{choice.objective}</b>
            </span>
          )}
          {choice?.turns !== null && choice?.turns !== undefined && (
            <span>
              <GlyphIcon kind="turn" /> <b>{choice.turns}</b> turns
            </span>
          )}
        </p>
      </div>

      <div className="overworld__cell overworld__cell--spoils">
        <h3 className="overworld__cell-title">
          <span>Spoils</span>
          <span className="overworld__cell-note">{choice && choice.foes.length > 0 ? 'on victory' : 'on arrival'}</span>
        </h3>
        <ul className="overworld__spoils">
          {choice?.spoils.map((spoil) => (
            <li key={spoil.kind} className="overworld__spoil">
              <SpoilIcon kind={spoil.kind} />
              <span className="overworld__spoil-label">{spoil.label}</span>
              <span className="overworld__spoil-note">{spoil.note}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="overworld__cell overworld__cell--warband">
        <h3 className="overworld__cell-title">
          <span>Warband</span>
          <span className="overworld__cell-note">
            {view.team.length}
            {hurt > 0 && ` · ${hurt} hurt`}
          </span>
        </h3>
        <ul className="overworld__party">
          {view.team.map((unit) => {
            const percent = unit.maxHealth > 0 ? (unit.health / unit.maxHealth) * 100 : 0;
            const isHurt = unit.health < unit.maxHealth;
            const summary = `${unit.name}, ${unit.unitClass} · Lv ${unit.level} · ${unit.health}/${unit.maxHealth} HP`;
            return (
              <li
                key={unit.id}
                className={isHurt ? 'overworld__member overworld__member--hurt' : 'overworld__member'}
                title={summary}
              >
                <span className="visually-hidden">{summary}</span>
                <span className="overworld__member-sprite" aria-hidden="true">
                  <UnitSprite sprite={unit.sprite} />
                </span>
                <span className="overworld__member-name" aria-hidden="true">
                  {unit.name}
                </span>
                <span className="overworld__member-bar" aria-hidden="true">
                  <span style={{ width: `${percent}%` }} />
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

// A spoil plate's icon: a reward card's art, or a glyph.
const SPOIL_ICONS: Readonly<Record<SpoilKind, { reward: string } | { glyph: GlyphKind }>> = {
  gold: { reward: 'gold' },
  pick: { reward: 'scroll' },
  relic: { reward: 'relic' },
  exp: { glyph: 'exp' },
  recruit: { reward: 'draft' },
  rest: { reward: 'rest' },
  merchant: { glyph: 'item' },
  blessing: { reward: 'keystone' },
  choice: { glyph: 'book' },
  victory: { glyph: 'seize' },
};

function SpoilIcon({ kind }: { kind: SpoilKind }) {
  const icon = SPOIL_ICONS[kind];
  return (
    <span className="overworld__spoil-icon" aria-hidden="true">
      {'reward' in icon ? <img src={REWARD_ICON_URLS[icon.reward]} alt="" /> : <GlyphIcon kind={icon.glyph} />}
    </span>
  );
}

// The foot's line on the roads not highlighted: "Two other roads:
// Thornmere (village) and Greyfort (elite lair)".
function describeOtherRoads(view: OverworldView, selected: number): string {
  const others = view.choices.filter((_, index) => index !== selected);
  if (view.choices.length === 0) return 'No road leads on from here.';
  if (others.length === 0) return 'The only road on.';
  const named = others.map((site) => `${site.name} (${site.kindLabel.toLowerCase()})`);
  const list = named.length > 1 ? `${named.slice(0, -1).join(', ')} and ${named.at(-1)}` : named[0];
  return `${others.length === 1 ? 'One other road' : `${COUNT_WORDS[others.length] ?? others.length} other roads`}: ${list}`;
}

const COUNT_WORDS: Readonly<Record<number, string>> = { 2: 'Two', 3: 'Three', 4: 'Four' };

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
  const speed = useGameStore((state) => state.autoSpeed);
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
    const timer = window.setTimeout(
      () => {
        if (outcome) onDone(outcome.run);
        else
          choose(
            Math.max(
              0,
              view.choices.findIndex((c) => !c.blocked),
            ),
          );
      },
      (AUTO_DELAY_MS * 2) / speed,
    );
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
