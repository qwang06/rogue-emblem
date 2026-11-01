import { useEffect, useMemo, useRef, useState } from 'react';
import { SPRITE_URLS } from '../assets/sprites.ts';
import { gameCommands } from '../bridge/commands.ts';
import { gameStore } from '../bridge/gameStore.ts';
import {
  advancePlayback,
  getFrameRect,
  getStageRect,
  getViewerArts,
  stepFrame,
  type Playback,
  type Rect,
} from '../game/animationViewer.ts';
import { FACINGS, type Facing } from '../game/facing.ts';
import { getAllUnitSheets, TILE_SIZE, type UnitSheet } from '../game/tileset.ts';
import { ConfigLayout } from './ConfigLayout.tsx';
import { routeHash } from './route.ts';
import './AnimationViewer.css';

const ZOOMS = [2, 3, 4, 6] as const;
const SPEEDS = [0.25, 0.5, 1, 2] as const;
const FACING_LABELS: Readonly<Record<Facing, string>> = { down: 'Down', left: 'Left', right: 'Right', up: 'Up' };
const ALL_FACINGS = 'all';
type FacingPick = Facing | typeof ALL_FACINGS;

// #/animations[/<art>]: every animation of a unit's art, played the way
// the map plays it, on a stage of tiles with the unit's own tile marked.
// Pick the art, the animation (idle, move and, for art that has them,
// attack, hit, die and their layers), the facing (or all four at once),
// zoom and speed, or pause and step frame by frame.
export function AnimationViewer({ art }: { art: string | null }) {
  // A battle left running underneath would keep taking keyboard input, so
  // opening the viewer ends it, as the config editor does.
  useEffect(() => {
    if (gameStore.getState().screen === 'battle') gameCommands.send({ type: 'main-menu' });
  }, []);

  const arts = useMemo(getViewerArts, []);
  const current = arts.find((entry) => entry.art === art) ?? arts[0];

  return (
    <ConfigLayout
      title="Animations"
      lede="Every unit animation, as the map plays it. The marked tile is the one the unit stands on."
      back={{ href: routeHash({ page: 'game' }), label: 'Back to title' }}
    >
      <div className="anim-viewer">
        <label className="anim-viewer__field">
          <span className="anim-viewer__label">Unit</span>
          <select
            className="anim-viewer__select"
            value={current.art}
            onChange={(event) => (window.location.hash = routeHash({ page: 'animations', art: event.target.value }))}
          >
            {arts.map((entry) => (
              <option key={entry.art} value={entry.art}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
        {/* A fresh body per art, so its picks start over on idle. */}
        <ViewerBody key={current.art} art={current.art} />
      </div>
    </ConfigLayout>
  );
}

function ViewerBody({ art }: { art: string }) {
  const sheets = useMemo(() => getAllUnitSheets(art), [art]);
  // One stage for every animation of the art, so switching never resizes it.
  const stage = useMemo(() => getStageRect(sheets), [sheets]);
  const [sheetKey, setSheetKey] = useState(sheets[0].key);
  const [facing, setFacing] = useState<FacingPick>(ALL_FACINGS);
  const [zoom, setZoom] = useState<number>(4);
  const [speed, setSpeed] = useState<number>(1);
  const [playing, setPlaying] = useState(true);
  const [playback, setPlayback] = useState<Playback>({ frame: 0, elapsedMs: 0 });
  const sheet = sheets.find((entry) => entry.key === sheetKey) ?? sheets[0];
  const image = useImage(SPRITE_URLS[sheet.key]);

  usePlaybackClock(playing, (elapsedMs) => setPlayback((before) => advancePlayback(before, sheet, elapsedMs, speed)));

  function pickSheet(key: string) {
    setSheetKey(key);
    setPlayback({ frame: 0, elapsedMs: 0 });
  }

  function step(by: number) {
    setPlaying(false);
    setPlayback((before) => ({ frame: stepFrame(sheet, before.frame, by), elapsedMs: 0 }));
  }

  const frame = Math.min(playback.frame, sheet.frames - 1);
  const facings = facing === ALL_FACINGS ? FACINGS : [facing];

  return (
    <>
      <div className="anim-viewer__field">
        <span className="anim-viewer__label">Animation</span>
        <div className="anim-viewer__choices" role="group" aria-label="Animation">
          {sheets.map((entry) => (
            <button
              key={entry.key}
              type="button"
              className="header-button anim-viewer__choice"
              aria-pressed={entry.key === sheet.key}
              onClick={() => pickSheet(entry.key)}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      <div className="anim-viewer__field">
        <span className="anim-viewer__label">Facing</span>
        <div className="anim-viewer__choices" role="group" aria-label="Facing">
          {[ALL_FACINGS, ...FACINGS].map((entry) => (
            <button
              key={entry}
              type="button"
              className="header-button anim-viewer__choice"
              aria-pressed={entry === facing}
              onClick={() => setFacing(entry as FacingPick)}
            >
              {entry === ALL_FACINGS ? 'All' : FACING_LABELS[entry as Facing]}
            </button>
          ))}
        </div>
      </div>

      <div className="anim-viewer__toolbar">
        <div className="anim-viewer__choices" role="group" aria-label="Playback">
          <button type="button" className="header-button anim-viewer__choice" onClick={() => step(-1)}>
            ◀ Frame
          </button>
          <button
            type="button"
            className="header-button anim-viewer__choice anim-viewer__play"
            onClick={() => setPlaying((before) => !before)}
          >
            {playing ? 'Pause' : 'Play'}
          </button>
          <button type="button" className="header-button anim-viewer__choice" onClick={() => step(1)}>
            Frame ▶
          </button>
        </div>
        <label className="anim-viewer__inline">
          Speed
          <select
            className="anim-viewer__select"
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
          >
            {SPEEDS.map((value) => (
              <option key={value} value={value}>
                {value}x
              </option>
            ))}
          </select>
        </label>
        <label className="anim-viewer__inline">
          Zoom
          <select
            className="anim-viewer__select"
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          >
            {ZOOMS.map((value) => (
              <option key={value} value={value}>
                {value}x
              </option>
            ))}
          </select>
        </label>
        <span className="anim-viewer__counter">
          Frame {frame + 1} / {sheet.frames}
        </span>
      </div>

      <p className="anim-viewer__info">
        <code>{sheet.key}</code> · {sheet.frames} frame{sheet.frames === 1 ? '' : 's'} of {sheet.frameWidth}x
        {sheet.frameHeight} · {sheet.frameMs} ms each · {sheet.loop ? 'loops' : 'plays once'}
      </p>

      <div className="anim-viewer__stages">
        {facings.map((entry) => (
          <figure key={entry} className="anim-viewer__stage">
            <FrameCanvas image={image} sheet={sheet} facing={entry} frame={frame} stage={stage} zoom={zoom} />
            <figcaption className="anim-viewer__caption">{FACING_LABELS[entry]}</figcaption>
          </figure>
        ))}
      </div>
    </>
  );
}

// Calls onTick with the milliseconds since the last animation frame while
// `running`.
function usePlaybackClock(running: boolean, onTick: (elapsedMs: number) => void) {
  const tick = useRef(onTick);
  tick.current = onTick;
  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    let id = requestAnimationFrame(function loop(now) {
      tick.current(now - last);
      last = now;
      id = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(id);
  }, [running]);
}

// The image at `url`, once it has loaded (null until then).
function useImage(url: string | undefined): HTMLImageElement | null {
  const [loaded, setLoaded] = useState<{ url: string; image: HTMLImageElement } | null>(null);
  useEffect(() => {
    if (!url) return;
    const image = new Image();
    image.onload = () => setLoaded({ url, image });
    image.src = url;
    return () => {
      image.onload = null;
    };
  }, [url]);
  return loaded && loaded.url === url ? loaded.image : null;
}

const CHECKER_LIGHT = '#6b8f4e';
const CHECKER_DARK = '#5f8245';
const TILE_MARK = '#f0d9a8';

// One facing's frame on the stage: a checkerboard of tiles, the unit's
// tile outlined, and the frame placed by its tile, all at `zoom` with
// crisp pixels.
function FrameCanvas({
  image,
  sheet,
  facing,
  frame,
  stage,
  zoom,
}: {
  image: HTMLImageElement | null;
  sheet: UnitSheet;
  facing: Facing;
  frame: number;
  stage: Rect;
  zoom: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (!context) return;
    context.imageSmoothingEnabled = false;
    const tiles = { x: stage.width / TILE_SIZE, y: stage.height / TILE_SIZE };
    for (let ty = 0; ty < tiles.y; ty++) {
      for (let tx = 0; tx < tiles.x; tx++) {
        context.fillStyle = (tx + ty) % 2 === 0 ? CHECKER_LIGHT : CHECKER_DARK;
        context.fillRect(tx * TILE_SIZE * zoom, ty * TILE_SIZE * zoom, TILE_SIZE * zoom, TILE_SIZE * zoom);
      }
    }
    context.strokeStyle = TILE_MARK;
    context.lineWidth = Math.max(1, zoom / 2);
    const inset = context.lineWidth / 2;
    context.strokeRect(
      -stage.x * zoom + inset,
      -stage.y * zoom + inset,
      TILE_SIZE * zoom - inset * 2,
      TILE_SIZE * zoom - inset * 2,
    );
    if (!image) return;
    const source = getFrameRect(sheet, facing, frame);
    context.drawImage(
      image,
      source.x,
      source.y,
      source.width,
      source.height,
      (-stage.x - sheet.tileX) * zoom,
      (-stage.y - sheet.tileY) * zoom,
      source.width * zoom,
      source.height * zoom,
    );
  }, [image, sheet, facing, frame, stage, zoom]);
  return (
    <canvas
      ref={canvas}
      className="anim-viewer__canvas"
      width={stage.width * zoom}
      height={stage.height * zoom}
      aria-label={`${sheet.label}, facing ${FACING_LABELS[facing]}, frame ${frame + 1}`}
    />
  );
}
