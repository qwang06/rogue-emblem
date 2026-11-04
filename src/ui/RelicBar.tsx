import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { RelicView } from '../bridge/views.ts';
import { KeyHint, type KeyHintEntry } from './KeyHint.tsx';
import { RelicIcon } from './RelicIcon.tsx';
import { RELIC_BAR_KEY, stepRelicBar } from './relicBarKeys.ts';
import { useGameStore } from './useGameStore.ts';
import './RelicBar.css';

// The relics a Warband run holds (its keystone first), as a row of icons in
// the page header, like Slay the Spire's relic bar, through the run's
// battles, camp and overworld. Pointing at a relic, or focusing it, shows
// its name and what it does in a tooltip below it. From the keyboard, Q
// opens the bar on the relic last looked at; ←/→ step through them and Q,
// Esc, X or Enter close it (relicBarKeys.ts). While it's open the bar
// takes every key first, so the map or overworld under it doesn't move.
// Tab also reaches the icons, as plain buttons.
export function RelicBar() {
  const relics = useGameStore((state) => (state.screen === 'title' ? null : state.runRelics));
  // The equipment screen steps through units with Q and E, so while it's
  // open Q is left to it and doesn't open the bar.
  const keysTaken = useGameStore((state) => state.equipmentScreen !== null);
  if (!relics || relics.length === 0) return null;
  return <RelicRow relics={relics} keysTaken={keysTaken} />;
}

// How far a tooltip keeps from the window's edges, and its widest.
const TOOLTIP_MARGIN = 8;
const TOOLTIP_WIDTH = 256;
// The tooltip's key hint: one line either way, so it keeps its height.
const OPEN_KEYS: readonly KeyHintEntry[] = [['Q', 'Browse relics']];
const BROWSE_KEYS: readonly KeyHintEntry[] = [
  ['←→', 'Browse'],
  ['Q', 'Close'],
];

function RelicRow({ relics, keysTaken }: { relics: readonly RelicView[]; keysTaken: boolean }) {
  // The relic the keyboard is on (kept while closed, to reopen there), and
  // whether keyboard browsing is open.
  const [index, setIndex] = useState(0);
  const [browsing, setBrowsing] = useState(false);
  // The relic the pointer or focus is on, if any.
  const [pointed, setPointed] = useState<number | null>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  // Bumped when the row scrolls, so the tooltip follows its relic.
  const [scrolled, setScrolled] = useState(0);
  const shown = browsing ? index : pointed;

  // Q and the browsing keys, ahead of the map's (Phaser) and the
  // overworld's own window listeners: a capture listener on the window
  // runs before them, and stops the keys it uses.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      if (target instanceof HTMLSelectElement) return;
      if (!browsing && (keysTaken || event.ctrlKey || event.metaKey || event.altKey)) return;
      const step = stepRelicBar(browsing, index, relics.length, event.key);
      if (!step) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (step.open) {
        setIndex(step.index);
        setBrowsing(true);
      } else close();
    }
    // Keys let go while browsing are the bar's too.
    function onKeyUp(event: KeyboardEvent) {
      if (browsing || (!keysTaken && event.key.toLowerCase() === RELIC_BAR_KEY)) event.stopImmediatePropagation();
    }
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
    };
  });

  function close() {
    setBrowsing(false);
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && buttons.current.includes(focused as HTMLButtonElement)) focused.blur();
  }

  // Browsing moves focus with the relic, so screen readers read it out
  // and the bar scrolls it into view.
  useEffect(() => {
    if (!browsing) return;
    const button = buttons.current[index];
    button?.focus({ preventScroll: true });
    button?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [browsing, index]);

  return (
    <div className={`relic-bar${browsing ? ' relic-bar--browsing' : ''}`} role="group" aria-label="Relics">
      <span className="relic-bar__key" aria-hidden="true" title="Q: browse relics">
        <kbd>Q</kbd>
      </span>
      {/* The wheel scrolls the row sideways when the header is too narrow for it. */}
      <ul
        className="relic-bar__list"
        onWheel={(event) => {
          event.currentTarget.scrollLeft += event.deltaY + event.deltaX;
        }}
        onScroll={() => setScrolled((count) => count + 1)}
      >
        {relics.map((relic, i) => (
          <li key={relic.id}>
            <button
              type="button"
              ref={(button) => {
                buttons.current[i] = button;
              }}
              className={`relic-bar__relic${relic.keystoneId ? ' relic-bar__relic--keystone' : ''}${
                shown === i ? ' relic-bar__relic--shown' : ''
              }`}
              aria-label={relic.name}
              aria-describedby={shown === i ? 'relic-bar-tooltip' : undefined}
              onPointerEnter={() => setPointed(i)}
              onPointerLeave={() => setPointed((current) => (current === i ? null : current))}
              onFocus={() => {
                setPointed(i);
                if (browsing) setIndex(i);
              }}
              onBlur={(event) => {
                setPointed((current) => (current === i ? null : current));
                // Focus leaving the bar (a click elsewhere) ends browsing.
                if (!buttons.current.includes(event.relatedTarget as HTMLButtonElement)) setBrowsing(false);
              }}
              onClick={() => {
                setIndex(i);
                setBrowsing(true);
              }}
            >
              <RelicIcon id={relic.id} keystoneId={relic.keystoneId} />
              {relic.copies > 1 && <span className="relic-bar__copies">{relic.copies}</span>}
            </button>
          </li>
        ))}
      </ul>
      {shown !== null && relics[shown] && (
        <RelicTooltip
          relic={relics[shown]}
          anchor={buttons.current[shown] ?? null}
          browsing={browsing}
          scrolled={scrolled}
        />
      )}
    </div>
  );
}

// The shown relic's name and description, hung below its icon in a fixed
// box (so the header's scrolling row never clips it), kept on screen.
function RelicTooltip({
  relic,
  anchor,
  browsing,
  scrolled,
}: {
  relic: RelicView;
  anchor: HTMLElement | null;
  browsing: boolean;
  scrolled: number;
}) {
  const [place, setPlace] = useState<CSSProperties | null>(null);
  useLayoutEffect(() => {
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(TOOLTIP_WIDTH, window.innerWidth - 2 * TOOLTIP_MARGIN);
    const center = rect.left + rect.width / 2;
    const left = Math.min(Math.max(center - width / 2, TOOLTIP_MARGIN), window.innerWidth - TOOLTIP_MARGIN - width);
    setPlace({ top: rect.bottom + 6, left, width });
  }, [anchor, relic.id, scrolled]);
  return (
    <div
      id="relic-bar-tooltip"
      role="tooltip"
      className="panel relic-bar__tooltip"
      style={place ?? { visibility: 'hidden' }}
    >
      <p className="relic-bar__name">{relic.name}</p>
      <p className="relic-bar__description">{relic.description}</p>
      <KeyHint className="relic-bar__hint" entries={browsing ? BROWSE_KEYS : OPEN_KEYS} />
    </div>
  );
}
